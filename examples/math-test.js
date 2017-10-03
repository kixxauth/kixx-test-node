'use strict';

const KixxAssert = require(`kixx-assert`);

const {isEqual} = KixxAssert.assert;

module.exports = (t) => {

	t.describe(`Math.round()`, (t) => {

		t.it(`should round floating point numbers to integers`, () => {

			// With KixxAssert, the expected value is passed into the assertion
			// function first while the actual value is passed in second. This is
			// a more common way of composing functions in a functional programming
			// paradigm.
			isEqual(2, Math.round(1.5), `1.5 rounds to 2`);
		});

		t.it(`should not change integers`, () => {
			// Notice the expected value is passed into the assertion function first.
			isEqual(-2, Math.round(-2), `-2 rounds to 2`);
		});
	});

	t.describe(`Math.abs()`, (t) => {

		t.it(`should return the absolute value of a negative number`, () => {
			isEqual(2, Math.abs(-2), `absolute value of -2`);
		});

		t.it(`should not round floating point numbers`, () => {
			isEqual(0.5, Math.abs(-0.5), `absolute value of -0.5`);
		});
	});
};
