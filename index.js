'use strict';

const OS = require(`os`);
const Yargs = require(`yargs`);
const Filepath = require(`filepath`);
const KixxTest = require(`kixx-test`);

const DEFAULT_TIMEOUT = 5000;
const DEFAULT_MAX_ERRORS = Infinity;
const DEFAULT_MAX_STACK = 5;
const EOL = OS.EOL;

const ARGV = Yargs
	.option(`directory`, {
		alias: `d`,
		describe: `The name of your test directory.`,
		default: `test`,
		type: `string`
	})
	.option(`timeout`, {
		alias: `t`,
		describe: `The time limit for each .before(), .after(), and .it() block.`,
		default: DEFAULT_TIMEOUT,
		type: `number`
	})
	.option(`maxErrors`, {
		describe: `The maximum errors allowed before exiting. "-1" will result in Infinity.`,
		default: DEFAULT_MAX_ERRORS,
		type: `number`
	})
	.option(`maxStack`, {
		describe: `The maximum number of lines you want in your stack traces.`,
		default: DEFAULT_MAX_STACK,
		type: `number`
	}).argv;

const hasOwnProperty = Object.prototype.hasOwnProperty;

function get(key, obj) {
	return hasOwnProperty.call(obj, key) ? obj[key] : null;
}

function isNumber(n) {
	return typeof n === `number` && !isNaN(n);
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

function main(args) {
	const timeout = isNumber(get(`timeout`, args)) ? get(`timeout`, args) : DEFAULT_TIMEOUT;
	const maxErrors = isNumber(get(`maxErrors`, args)) ? get(`maxErrors`, args) : DEFAULT_MAX_ERRORS;
	const maxStack = isNumber(get(`maxStack`, args)) ? get(`maxStack`, args) : DEFAULT_MAX_STACK;

	const runner = KixxTest.createRunner({timeout});

	const allErrors = [];
	let testCount = 0;
	let currentBlockPath = null;
	let currentBlockErrors = [];
	let beforeStartTime;
	let afterStartTime;

	function setBlock(ev) {
		currentBlockPath = ev.parents.join(` `);
		currentBlockErrors = [];
	}

	function clearBlock() {
		currentBlockPath = null;
		currentBlockErrors = [];
	}

	function isBlockChange(ev) {
		return ev.parents.join(` `) !== currentBlockPath;
	}

	function reportErrors(errors) {
		errors.forEach((err) => {
			const stack = err.stack && err.stack.split(EOL).slice(0, maxStack).join(EOL).trim();
			process.stderr.write(EOL + EOL + (stack || err));
		});
	}

	function exit(code) {
		process.stderr.write(EOL);
		process.exit(code);
	}

	runner.on(`error`, (err) => {
		allErrors.push(err);
		currentBlockErrors.push(err);

		if (allErrors.length > maxErrors) {
			reportErrors(allErrors);
			process.stderr.write(`${EOL + EOL}maxErrors: ${maxErrors} exceeded. All Errors reported. Exiting.`);
			exit(1);
		}
	});

	runner.on(`blockStart`, (ev) => {
		if (isBlockChange(ev)) {
			setBlock(ev);
			process.stderr.write(EOL + currentBlockPath);
		}

		switch (ev.type) {
			case `before`:
				beforeStartTime = Date.now();
				break;
			case `after`:
				afterStartTime = Date.now();
				break;
		}
	});

	runner.on(`blockComplete`, (ev) => {
		switch (ev.type) {
			case `before`:
				process.stderr.write(`${EOL}before() ${Date.now() - beforeStartTime}ms`);
				beforeStartTime = null;
				break;
			case `after`:
				process.stderr.write(`${EOL + currentBlockPath} : after() ${Date.now() - afterStartTime}ms`);
				afterStartTime = null;
				break;
			default: // ev.type === "test" and all others.
				// TODO: kixx-test needs to emit a blockComplete event, even when there is an error.
				testCount += 1;
				process.stderr.write(`.`);
		}

		clearBlock();
	});

	runner.on(`end`, () => {
		if (allErrors.length > 0) {
			reportErrors(allErrors);
			process.stderr.write(EOL);
		}
		process.stderr.write(`${EOL}Test run complete. ${testCount} tests ran. ${allErrors.length} errors reported.${EOL}`);
		exit(0);
	});

	return runner;
}

function isConfigFile(file) {
	return file.basename() === `config.js`;
}

function isSetupFile(file) {
	return file.basename() === `setup.js`;
}

function isTestFile(file) {
	return /test.js$/.test(file.basename());
}

function runCommandLineInterface() {
	const directory = Filepath.create(ARGV.directory);
	const timeout = ARGV.timeout;
	const maxErrors = ARGV.maxErrors;
	const maxStack = ARGV.maxStack;
	const explicitFiles = ARGV._[0] ? Filepath.create(ARGV._[0]) : null;
	const files = [];
	const setupFiles = [];
	const configFiles = [];

	process.stderr.write(`Initializing kixx-test-node runner.${EOL}`);

	if (directory.isDirectory()) {
		directory.recurse((file) => {
			if (isSetupFile(file)) {
				setupFiles.push(file);
			}
			if (isConfigFile(file)) {
				configFiles.push(file);
			}
			if (isTestFile(file)) {
				files.push(file);
			}
		});
	}

	let options = {
		timeout,
		maxErrors,
		maxStack
	};

	options = configFiles.reduce((options, file) => {
		const extended = require(file.path);
		return Object.assign({}, options, extended);
	}, options);

	const t = main(options);

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
		const configurator = require(file.path);
		const name = directory.relative(file.path);
		if (isFunction(configurator)) {
			t.describe(name, configurator);
		} else {
			throw new UserError(`The setup file at ${file.path} must export a single function.`);
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

	process.stderr.write(`Test file count: ${files.length}${EOL}`);

	t.run();
}

exports.main = main;
exports.runCommandLineInterface = runCommandLineInterface;
