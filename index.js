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

function main(args) {
	const timeout = isNumber(get(`timeout`, args)) ? get(`timeout`, args) : DEFAULT_TIMEOUT;
	const maxErrors = isNumber(get(`maxErrors`, args)) ? get(`maxErrors`, args) : DEFAULT_MAX_ERRORS;
	const maxStack = isNumber(get(`maxStack`, args)) ? get(`maxStack`, args) : DEFAULT_MAX_STACK;

	const runner = KixxTest.createRunner({timeout});

	let testCount = 0;
	let currentBlockPath = null;
	let blockTestCount = 0;
	let errorsToReport = [];
	let beforeStartTime;
	let afterStartTime;
	let inBeforeBlock = false;
	let totalErrorCount = 0;

	function setBlock(ev) {
		currentBlockPath = ev.parents.join(' ');
	}

	function clearBlock() {
		currentBlockPath = null;
		errorsToReport = [];
		blockTestCount = 0;
	}

	function isBlockChange(ev) {
		const path = ev.parents.join(' ');
		return path !== currentBlockPath;
	}

	function reportErrors() {
		errorsToReport.forEach((err) => {
			const stack = err.stack && err.stack.split(EOL).slice(0, maxStack).join(EOL).trim();
			process.stderr.write(EOL + EOL + (stack || err));
		});
	}

	function exit(code) {
		process.stderr.write(EOL);
		process.exit(code);
	}

	runner.on(`error`, (err) => {
		errorsToReport.push(err);

		totalErrorCount += 1;
		if (totalErrorCount > maxErrors) {
			reportErrors();
			process.stderr.write(`${EOL + EOL}maxErrors: ${maxErrors} exceeded. All Errors reported. Exiting.`);
			exit(1);
		} else if (inBeforeBlock) {
			reportErrors();
			process.stderr.write(`${EOL + EOL + currentBlockPath} : Error detected in before() block. All Errors reported. Exiting.`);
			exit(1);
		}
	});

	runner.on('blockStart', (ev) => {
		if (isBlockChange(ev)) {
			setBlock(ev);
			process.stderr.write(EOL + currentBlockPath);
		}

		switch (ev.type) {
			case 'before':
				beforeStartTime = Date.now();
				inBeforeBlock = true;
				break;
			case 'after':
				afterStartTime = Date.now();
				break;
		}
	});

	runner.on('blockComplete', (ev) => {
		inBeforeBlock = false;

		switch (ev.type) {
			case 'before':
				process.stderr.write(`${EOL}before() ${Date.now() - beforeStartTime}ms`);
				beforeStartTime = null;
				break;
			case 'after':
				process.stderr.write(`${EOL + currentBlockPath} : after() ${Date.now() - afterStartTime}ms`);
				afterStartTime = null;
				break;
			default: // ev.type === "test" and all others.
				testCount += 1;
				if (blockTestCount === 0) process.stderr.write(EOL);
				process.stderr.write('.');
		}

		if (isBlockChange(ev)) {
			reportErrors();
			clearBlock();
		}
	});

	runner.on('end', () => {
		process.stderr.write(`${EOL}Test run complete. ${testCount} tests ran. ${totalErrorCount} errors reported.${EOL}`);
		exit(0);
	});

	return runner;
}

function isConfigFile(file) {
	return file.basename() === 'config.js';
}

function isSetupFile(file) {
	return file.basename() === 'setup.js';
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
		if (isFunction(configurator)) {
			configurator(t);
		} else {
			throw new Error(`The setup file at ${file.path} must export a single function.`);
		}
	});

	files.forEach((file) => {
		const configurator = require(file.path);
		if (isFunction(configurator)) {
			configurator(t);
		} else {
			throw new Error(`The test file at ${file.path} must export a single function.`);
		}
	});

	process.stderr.write(`Test file count: ${files.length}${EOL}`);

	t.run();
}

exports.main = main;
exports.runCommandLineInterface = runCommandLineInterface;
