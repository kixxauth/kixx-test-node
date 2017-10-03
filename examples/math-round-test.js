'use strict';

const assert = require(`assert`);

module.exports = (t) => {

	t.it(`should round floating point numbers to integers`, () => {
		assert.equal(Math.round(1.5), 2, `1.5 rounds to 2`);
	});

	t.it(`should not change integers`, () => {
		assert.equal(Math.round(-2), -2, `-2 rounds to 2`);
	});

};
