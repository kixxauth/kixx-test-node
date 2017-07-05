'use strict';

const OS = require('os');
const KixxTest = require('kixx-test');

const DEFAULT_TIMEOUT = 5000;
const DEFAULT_MAX_ERRORS = Infinity;
const DEFAULT_MAX_STACK = 5;
const EOL = OS.EOL;

const hasOwnProperty = Object.prototype.hasOwnProperty;

function get(key, obj) {
	return hasOwnProperty.call(obj, key) ? obj[key] : null;
}

function isNumber(n) {
	return typeof n === 'number' && !isNaN(n);
}

function main(args) {
	const timeout = isNumber(get('timeout', args)) ? get('timeout', args) : DEFAULT_TIMEOUT;
	const maxErrors = isNumber(get('maxErrors', args)) ? get('maxErrors', args) : DEFAULT_MAX_ERRORS;
	const maxStack = isNumber(get('maxStack', args)) ? get('maxStack', args) : DEFAULT_MAX_STACK;

	const runner = KixxTest.createRunner({timeout});

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
		blockStartTime = null;
	}

	function isBlockChange(ev) {
		const path = ev.parents.join(' ');
		return path !== currentBlockPath;
	}

	function reportErrors() {
		errorsToReport.forEach(err => {
			const stack = err.stack && err.stack.split(EOL).slice(0, maxStack).join(EOL).trim();
			process.stderr.write(EOL + EOL + (stack || err));
		});
	}

	runner.on('error', err => {
		errorsToReport.push(err);

		totalErrorCount += 1;
		if (totalErrorCount > maxErrors) {
			reportErrors();
			process.stderr(`${EOL + EOL}maxErrors: ${maxErrors} exceeded. All Errors reported. Exiting.`);
			process.exit(1);
		} else if (inBeforeBlock) {
			reportErrors();
			process.stderr(`${EOL + EOL + currentBlockPath} : Error detected in before() block. All Errors reported. Exiting.`);
			process.exit(1);
		}
	});

	runner.on('blockStart', ev => {
		if (isBlockChange(ev)) {
			setBlock(ev);
			process.stderr.write(EOL + currentBlockPath);
		}

		switch (ev.type) {
			case 'before';
				beforeStartTime = Date.now();
				inBeforeBlock = true;
				break;
			case 'after';
				afterStartTime = Date.now();
				break;
		}
	});

	runner.on('blockComplete', ev => {
		inBeforeBlock = false;

		switch (ev.type) {
			case 'before';
				process.stderr.write(`${EOL}before() ${Date.now() - beforeStartTime}ms`);
				beforeStartTime = null;
				break;
			case 'after';
				process.stderr.write(`${EOL + currentBlockPath} : after() ${Date.now() - afterStartTime}ms`);
				afterStartTime = null;
				break;
			default: // ev.type === "test" and all others.
				if (blockTestCount === 0) process.stderr.write(EOL);
				process.stderr.write('.');
		}

		if (isBlockChange(ev)) {
			reportErrors();
			clearBlock();
		}
	});

	runner.on('end', ev => {
		process.stderr.write(`Test run complete. ${totalErrorCount} errors reported.`);
		process.exit(0);
	});

	// TODO: Require all the test modules, passing `runner` into the exported function.

	runner.run();
}
