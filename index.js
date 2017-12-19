'use strict';

const OS = require(`os`);
const Yargs = require(`yargs`);
const Filepath = require(`filepath`);
const KixxTest = require(`kixx-test`);

const DEFAULT_DIRECTORY = `test`;
const DEFAULT_TIMEOUT = 5000;
const DEFAULT_MAX_ERRORS = Infinity;
const DEFAULT_MAX_STACK = 5;
const EOL = OS.EOL;

const RED = `\x1b[31m`;
const GREEN = `\x1b[32m`;
const YELLOW = `\x1b[33m`;
const COLOR_RESET = `\x1b[0m`;

const ARGV = Yargs
	.option(`directory`, {
		alias: `d`,
		describe: `The name of your test directory. (default="${DEFAULT_DIRECTORY}")`,
		type: `string`
	})
	.option(`timeout`, {
		alias: `t`,
		describe: `The time limit for each .before(), .after(), and .it() block. (default=${DEFAULT_TIMEOUT})`,
		type: `number`
	})
	.option(`pattern`, {
		describe: `Only describe blocks and tests which match the given pattern will be run`,
		type: `string`
	})
	.option(`maxErrors`, {
		describe: `The maximum errors allowed before exiting. "-1" will result in Infinity. (default=${DEFAULT_MAX_ERRORS})`,
		type: `number`
	})
	.option(`maxStack`, {
		describe: `The maximum number of lines you want in your stack traces. (default=${DEFAULT_MAX_STACK})`,
		type: `number`
	}).argv;

const hasOwnProperty = Object.prototype.hasOwnProperty;

function get(key, obj) {
	return hasOwnProperty.call(obj, key) ? obj[key] : null;
}

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

const spinner = (function () {
	const frames = [
		`( ●    )`,
		`(  ●   )`,
		`(   ●  )`,
		`(    ● )`,
		`(     ●)`,
		`(    ● )`,
		`(   ●  )`,
		`(  ●   )`,
		`( ●    )`,
		`(●     )`
	];

	let interval;
	let frameIndex = frames.length - 2;

	function clear() {
		process.stdout.clearLine();
		process.stdout.cursorTo(0);
	}

	function render() {
		frameIndex += 1;
		frameIndex = frameIndex >= frames.length ? 0 : frameIndex;
		clear();
		process.stdout.write(frames[frameIndex]);
	}

	return {
		start() {
			render();
			interval = setInterval(render, 80);
		},
		stop() {
			if (interval) clearInterval(interval);
			clear();
		}
	};
}());

function getBlockId(block) {
	return block.parents.join(` `);
}

function reportErrors(maxStack, errors) {
	errors.forEach((err) => {
		let stack = err.stack ? err.stack.split(EOL) : [];
		if (stack.length > maxStack) {
			stack = stack.slice(0, maxStack);
		}

		const testName = err.test ? ` ${err.test}` : ``;

		if (Array.isArray(err.parents)) {
			process.stdout.write(`- [${getBlockId(err)}${testName}]`);
		}
		process.stdout.write(EOL + stack.join(EOL).trim() + EOL + EOL);
	});
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

function main(args) {
	const timeout = isNumber(get(`timeout`, args)) ? get(`timeout`, args) : DEFAULT_TIMEOUT;
	const pattern = get(`pattern`, args);
	const maxErrors = isNumber(get(`maxErrors`, args)) ? get(`maxErrors`, args) : DEFAULT_MAX_ERRORS;
	const maxStack = isNumber(get(`maxStack`, args)) ? get(`maxStack`, args) : DEFAULT_MAX_STACK;

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
		errors.push(err);

		if (errors.length > maxErrors) {
			reportErrors(maxStack, errors);
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
		spinner.stop();

		if (setupBlocks.length > 0) {
			process.stdout.write(`# Setup before() blocks:${EOL}`);
			setupBlocks.forEach((msg) => {
				process.stdout.write(msg);
			});
			process.stdout.write(EOL);
		}
		if (teardownBlocks.length > 0) {
			process.stdout.write(`# Teardown after() blocks:${EOL}`);
			teardownBlocks.forEach((msg) => {
				process.stdout.write(msg);
			});
			process.stdout.write(EOL);
		}
		if (pendingBlocks.length > 0) {
			process.stdout.write(`${YELLOW}# Pending blocks:${EOL}`);
			pendingBlocks.forEach((msg) => {
				process.stdout.write(msg);
			});
			process.stdout.write(COLOR_RESET + EOL);
		}
		if (errors.length > 0) {
			process.stdout.write(`${RED}# Errors / Failures:${EOL}`);
			reportErrors(maxStack, errors);
			process.stdout.write(COLOR_RESET + EOL);
		}

		process.stdout.write(`${EOL}Test run complete. ${testCount} tests ran. ${errors.length} errors reported.${EOL}`);
	});

	return runner;
}

function isConfigFile(file) {
	return /config.js$/.test(file.basename());
}

function isSetupFile(file) {
	return /setup.js$/.test(file.basename());
}

function isTestFile(file) {
	return /test.js$/.test(file.basename());
}

function runCommandLineInterface() {
	const directory = Filepath.create(ARGV.directory || DEFAULT_DIRECTORY);
	const timeout = ARGV.timeout;
	const pattern = ARGV.pattern;
	const maxErrors = ARGV.maxErrors;
	const maxStack = ARGV.maxStack;
	const explicitFiles = ARGV._[0] ? Filepath.create(ARGV._[0]) : null;
	const files = [];
	const setupFiles = [];
	const configFiles = [];
	const setups = [];
	const teardowns = [];
	const errors = [];

	process.stdout.write(`Initializing kixx-test-node runner.${EOL}`);

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

	setupFiles.forEach((file) => {
		const setup = require(file.path);

		if (isFunction(setup.setup)) {
			const timeout = setup.setup.timeout || options.timeout;

			setups.push(new Promise((resolve, reject) => {
				const TO = setTimeout(() => {
					reject(new Error(`Setup timed out or did not call done() in ${file.path}`));
				}, timeout);

				try {
					setup.setup((err) => {
						clearTimeout(TO);
						if (err) {
							return reject(err);
						}
						resolve(true);
					});
				} catch (err) {
					clearTimeout(TO);
					reject(err);
				}
			}));
		}

		if (isFunction(setup.teardown)) {
			teardowns.push(() => {
				const timeout = setup.teardown.timeout || options.timeout;

				return new Promise((resolve, reject) => {
					const TO = setTimeout(() => {
						reject(new Error(`Teardown timed out or did not call done() in ${file.path}`));
					}, timeout);

					try {
						setup.teardown((err) => {
							clearTimeout(TO);
							if (err) {
								return reject(err);
							}
							resolve(true);
						});
					} catch (err) {
						clearTimeout(TO);
						reject(err);
					}
				});
			});
		}
	});

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
		spinner.start();
		t.run();
	}).catch((err) => {
		spinner.stop();
		process.stdout.write(`${EOL + RED}Setup failure:${COLOR_RESET + EOL}`);
		reportErrors(options.maxStack, [err]);
		process.stdout.write(EOL);
		process.exit(1);
	});
}

exports.main = main;
exports.runCommandLineInterface = runCommandLineInterface;
