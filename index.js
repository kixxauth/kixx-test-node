'use strict';

const OS = require(`os`);
const path = require(`path`);
const fs = require(`fs`);
const KixxTest = require(`kixx-test`);

const EOL = OS.EOL;

const RED = `\x1b[31m`;
const GREEN = `\x1b[32m`;
const YELLOW = `\x1b[33m`;
const COLOR_RESET = `\x1b[0m`;

function isNumber(n) {
	return typeof n === `number` && !isNaN(n);
}

function isFunction(fn) {
	return typeof fn === `function`;
}

function isFile(filepath) {
	let stats;

	try {
		stats = fs.statSync(filepath);
	} catch (e) {
		return false;
	}

	return stats.isFile();
}

function isDirectory(filepath) {
	let stats;
	
	try {
		stats = fs.statSync(filepath);
	} catch (e) {
		return false;
	}

	return stats.isDirectory();
}

function isTestFile(file) {
	return /test.(js|mjs)$/.test(file);
}

function createBlockTracker(event) {
	const id = getBlockId(event);

	return {
		id,
		name: id,
		type: event.type,
		test: event.test,
		beforeStartTime: null,
		afterStartTime: null
	};
}

function getBlockId(block) {
	if (Array.isArray(block.parents)) {
		return block.parents.join(` `);
	}
	return null;
}

function reportError(maxStack, err) {
	let stack = err.stack ? err.stack.split(EOL) : [];
	if (stack.length > maxStack) {
		stack = stack.slice(0, maxStack);
	}

	const testName = err.test ? ` ${err.test}` : ``;
	const id = getBlockId(err);

	let nameString = `Unexpected Testing Error`;
	if (testName && id) {
		nameString = `${id} ${testName}`;
	} else if (testName) {
		nameString = testName;
	} else if (id) {
		nameString = id;
	}

	process.stdout.write(`${RED}Error - [${nameString}]${COLOR_RESET}`);
	process.stdout.write(EOL + stack.join(EOL).trim() + EOL + EOL);
}

function exitWithError(err) {
	if (err && err.stack) {
		process.stdout.write(EOL + err.stack + EOL + EOL);
	}

	process.stdout.write(`Exiting${EOL}`);
	process.exit(1);
}

exports.main = function main(ARGV, DEFAULT_VALUES) {
	const directory = path.resolve(ARGV.directory || DEFAULT_VALUES.DIRECTORY);
	const timeout = isNumber(ARGV.timeout) ? ARGV.timeout : DEFAULT_VALUES.TIMEOUT;
	const pattern = ARGV.pattern;
	const maxErrors = isNumber(ARGV.maxErrors) ? ARGV.maxErrors : DEFAULT_VALUES.MAX_ERRORS;
	const maxStack = isNumber(ARGV.maxStack) ? ARGV.maxStack : DEFAULT_VALUES.MAX_STACK;
	const verbose = Boolean(ARGV.verbose);
	const quiet = Boolean(ARGV.quiet);

	let explicitFiles = null;

	if (Array.isArray(ARGV._) && ARGV._.length > 0) {
		explicitFiles = ARGV._.map((file) => {
			return path.resolve(file);
		});
	}

	const paths = explicitFiles ? explicitFiles : [ directory ];

	const blockTrackers = {};
	const pendingBlocks = [];

	let testFileLoadCount = 0;
	let testCount = 0;
	let errorCount = 0;
	let currentBlock = null;

	const runner = KixxTest.createRunner({
		timeout,
		pattern
	});

	function setBlock(ev) {
		const id = getBlockId(ev);
		let block = blockTrackers[id];
		let isNew = false;

		if (!block) {
			block = createBlockTracker(ev);
			blockTrackers[id] = block;
			isNew = true;
		}

		currentBlock = block;
		return isNew;
	}

	function isBlockChange(ev) {
		return !currentBlock || currentBlock.id !== getBlockId(ev);
	}

	runner.on(`error`, (err) => {
		errorCount += 1;
		reportError(maxStack, err);

		if (errorCount >= maxErrors) {
			process.stdout.write(`${EOL}maxErrors: ${maxErrors} exceeded. All Errors reported.${EOL}`);
			exitWithError();
		}
	});

	runner.on(`blockStart`, (ev) => {
		if (isBlockChange(ev)) {
			setBlock(ev);
		}

		const id = getBlockId(ev);
		const tracker = blockTrackers[id];

		switch (ev.type) {
			case `before`:
				tracker.beforeStartTime = Date.now();
				break;
			case `after`:
				tracker.afterStartTime = Date.now();
				break;
		}
	});

	runner.on(`blockComplete`, (ev) => {
		const id = getBlockId(ev);
		const tracker = blockTrackers[id];

		if (ev.type === `test`) {
			testCount += 1;
		}

		switch (ev.type) {
			case `before`:
				if (verbose) {
					process.stdout.write(`${EOL} - [${tracker.name}] - before() in ${Date.now() - tracker.beforeStartTime}ms${EOL}`);
				}
				break;
			case `after`:
				if (verbose) {
					process.stdout.write(`${EOL} - [${tracker.name}] - after() in ${Date.now() - tracker.afterStartTime}ms${EOL}`);
				}
				break;
			case `pendingTest`:
				pendingBlocks.push(` - [${tracker.name} ${ev.test}] - pending${COLOR_RESET}${EOL}`);
				break;
		}
	});

	runner.on(`end`, () => {
		if (!quiet && pendingBlocks.length > 0) {
			process.stdout.write(`${YELLOW}# Pending blocks:${EOL}`);
			pendingBlocks.forEach((msg) => {
				process.stdout.write(msg);
			});
			process.stdout.write(COLOR_RESET + EOL);
		}

		process.stdout.write(`${EOL}Test run complete. ${testCount} tests ran. ${errorCount} errors reported.${EOL}`);

		if (errorCount === 0) {
			process.stdout.write(`${EOL}${GREEN}PASS${COLOR_RESET}${EOL}`);
			process.exit(0);
		} else {
			process.stdout.write(`${EOL}${RED}FAIL${COLOR_RESET}${EOL}`);
			process.exit(1);
		}
	});

	function loadTestFile(filepath) {
		return import(filepath)
			.then((describeBlock) => {
				if (isFunction(describeBlock)) {
					testFileLoadCount += 1;
					runner.describe(describeBlock);
				} else {
					process.stdout.write(`${EOL}Test file ${filepath}${EOL}`);
					process.stdout.write(`must export a single function as the default export${EOL}`);
					exitWithError();
				}
			})
			.catch((err) => {
				process.stdout.write(`${EOL}Unable to load test file ${filepath}${EOL}`);
				exitWithError(err);
			});
	}

	function walkFilePath(filepath) {
		if (isFile(filepath) && isTestFile(filepath)) {
			return loadTestFile(filepath);
		}
		if (isDirectory(filepath)) {
			const entries = fs.readdirSync(filepath);

			return entries.reduce((promise, item) => {
				return promise.then(() => {
					return walkFilePath(path.join(filepath, item));
				});
			}, Promise.resolve(null));
		}
		return null;
	}

	function loadPath(promise, filepath) {
		return promise.then(() => {
			return walkFilePath(filepath);
		});
	}

	paths.reduce(loadPath, Promise.resolve(null)).then(() => {
		if (testFileLoadCount > 0) {
			runner.run();
		} else {
			process.stdout.write(`${EOL}No test files found in paths:${EOL}`);
			paths.forEach((filepath) => {
				process.stdout.write(filepath + EOL);
			});
			process.stdout.write(EOL);
			process.exit(0);
		}
	}).catch((err) => {
		process.stdout.write(`${EOL}Unexpected error while loading tests:${EOL}`);
		exitWithError(err);
	});
};
