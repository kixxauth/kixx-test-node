'use strict';

const OS = require(`os`);
const KixxTest = require(`kixx-test`);

const EOL = OS.EOL;

const RED = `\x1b[31m`;
const GREEN = `\x1b[32m`;
const YELLOW = `\x1b[33m`;
const COLOR_RESET = `\x1b[0m`;

const hasOwnProperty = Object.prototype.hasOwnProperty;

function isNumber(n) {
	return typeof n === `number` && !isNaN(n);
}

function isString(s) {
	return typeof s === `string`;
}

function isFunction(fn) {
	return typeof fn === `function`;
}

class UserError extends Error {
	constructor(message) {
		super(message);

		Object.defineProperties(this, {
			name: {
				enumerable: true,
				value: `UserError`
			},
			message: {
				enumerable: true,
				value: message
			},
			code: {
				enumerable: true,
				value: `USER_ERROR`
			}
		});
	}
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

	let nameString = 'Unexpected Testing Error';
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

function createTestRunner(args) {
	const {
		timeout,
		pattern,
		maxErrors,
		maxStack,
		verbose,
		quiet
	} = args;

	const runner = KixxTest.createRunner({
		timeout,
		pattern
	});

	let testCount = 0;
	const errors = [];
	const setupBlocks = [];
	const teardownBlocks = [];
	const pendingBlocks = [];
	const blockTrackers = {};
	let currentBlock = null;

	function isBlockChange(ev) {
		return !currentBlock || currentBlock.id !== getBlockId(ev);
	}

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

	runner.on(`error`, (err) => {
		errorCount += 1;
		reportError(maxStack, err);

		if (errorCount >= maxErrors) {
			process.stdout.write(`${EOL}maxErrors: ${maxErrors} exceeded. All Errors reported. Exiting.${EOL}`);
			process.exit(1);
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
				setupBlocks.push(`- [${tracker.name}] - before() in ${Date.now() - tracker.beforeStartTime}ms${EOL}`);
				break;
			case `after`:
				teardownBlocks.push(`- [${tracker.name}] - after() in ${Date.now() - tracker.afterStartTime}ms${EOL}`);
				break;
			case `pendingTest`:
				pendingBlocks.push(`- [${tracker.name} ${ev.test}] - pending${EOL}`);
				break;
		}
	});

	runner.on(`end`, () => {
		if (verbose && setupBlocks.length > 0) {
			process.stdout.write(`# Setup before() blocks:${EOL}`);
			setupBlocks.forEach((msg) => {
				process.stdout.write(msg);
			});
			process.stdout.write(EOL);
		}
		if (verbose && teardownBlocks.length > 0) {
			process.stdout.write(`# Teardown after() blocks:${EOL}`);
			teardownBlocks.forEach((msg) => {
				process.stdout.write(msg);
			});
			process.stdout.write(EOL);
		}
		if (!quiet && pendingBlocks.length > 0) {
			process.stdout.write(`${YELLOW}# Pending blocks:${EOL}`);
			pendingBlocks.forEach((msg) => {
				process.stdout.write(msg);
			});
			process.stdout.write(COLOR_RESET + EOL);
		}

		process.stdout.write(`${EOL}Test run complete. ${testCount} tests ran. ${errorCount} errors reported.${EOL}`);
	});

	return runner;
}

function isTestFile(file) {
	return /test.(js|mjs)$/.test(file.basename());
}

exports.main = function main(ARGV, DEFAULT_VALUES) {
	const directory = path.resolve(ARGV.directory || DEFAULT_VALUES.DEFAULT_DIRECTORY);
	const timeout = ARGV.timeout;
	const pattern = ARGV.pattern;
	const maxErrors = ARGV.maxErrors;
	const maxStack = ARGV.maxStack;
	const verbose = ARGV.verbose;
	const quiet = ARGV.quiet;
	const explicitFiles = ARGV._[0] ? path.resolve(ARGV._[0]) : null;

	const source = explicitFiles ? explicitFiles : directory;
	const files = [];

	const stats = getFileStat(source);

	if (!stats) {
		throw new UserError(`The given path does not exist: ${source}`);
	}

	process.stdout.write(`Initializing kixx-test-node runner:${EOL}`);
	process.stdout.write(`  ${source}${EOL}`);

	if (stats.isFile()) {
	} else if (stats.isDirectory()) {
	} else {
		throw new UserError(`The given path is not a file or directory: ${source}`);
	}

	if (directory.isDirectory()) {
		directory.recurse((file) => {
			if (isSetupFile(file)) {
				setupFiles.push(file);
			}
			if (isConfigFile(file)) {
				configFiles.push(file);
			}
			if (!explicitFiles && isTestFile(file)) {
				files.push(file);
			}
		});
	}

	let options = {
		timeout: DEFAULT_TIMEOUT,
		pattern: null,
		maxErrors: DEFAULT_MAX_ERRORS,
		maxStack: DEFAULT_MAX_STACK
	};

	options = configFiles.reduce((options, file) => {
		const extended = require(file.path);
		return Object.assign({}, options, extended);
	}, options);

	if (isNumber(timeout)) {
		options.timeout = timeout;
	}
	if (isString(pattern)) {
		options.pattern = pattern;
	}
	if (isNumber(maxErrors)) {
		options.maxErrors = maxErrors;
	}
	if (isNumber(maxStack)) {
		options.maxStack = maxStack;
	}

	if (options.maxErrors < 0) {
		options.maxErrors = Infinity;
	}

	if (verbose) {
		options.verbose = true;
	} else {
		options.verbose = options.verbose || false;
	}

	if (quiet) {
		options.quiet = true;
	} else {
		options.quiet = options.quiet || false;
	}

	const t = main(options);

	t.on(`error`, (err) => {
		errors.push(err);
	});

	t.on(`end`, () => {
		const passFail = errors.length === 0 ? `${GREEN}PASS${COLOR_RESET}` : `${RED}FAIL${COLOR_RESET}`;

		if (teardowns.length > 0) {
			const promises = teardowns.map((teardown) => teardown());

			return Promise.all(promises).then(() => {
				process.stdout.write(`Test tear down complete.${EOL}`);
				process.stdout.write(`${EOL}${passFail}${EOL}`);
				process.exit(errors.length > 0 ? 1 : 0);
			}).catch((err) => {
				process.stdout.write(`${EOL + RED}Tear down failure:${COLOR_RESET + EOL}`);
				reportErrors(maxStack, [err]);
				process.stdout.write(EOL);
				process.exit(1);
			});
		}

		process.stdout.write(`${EOL}${passFail}${EOL}`);
		process.exit(errors.length > 0 ? 1 : 0);
	});

	if (explicitFiles && explicitFiles.isFile()) {
		files.push(explicitFiles);
	} else if (explicitFiles && explicitFiles.isDirectory()) {
		explicitFiles.recurse((file) => {
			if (isTestFile(file)) {
				files.push(file);
			}
		});
	}

	files.forEach((file) => {
		const configurator = require(file.path);
		const name = directory.relative(file.path);
		if (isFunction(configurator)) {
			t.describe(name, configurator);
		} else {
			throw new UserError(`The test file at ${file.path} must export a single function.`);
		}
	});

	process.stdout.write(`Test file count: ${files.length}${EOL}`);

	return Promise.all(setups).then(() => {
		process.stdout.write(`Setup complete.${EOL + EOL}`);
		if (!options.quiet) {
			spinner.start();
		}
		t.run();
	}).catch((err) => {
		spinner.stop();
		process.stdout.write(`${EOL + RED}Setup failure:${COLOR_RESET + EOL}`);
		reportErrors(options.maxStack, [err]);
		process.stdout.write(EOL);
		process.exit(1);
	});
}
