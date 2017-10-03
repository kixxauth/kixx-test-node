'use strict';

const KixxAssert = require(`kixx-assert`);

const {isGreaterThan} = KixxAssert.assert;

module.exports = (t) => {

	class Car {
		constructor() {
			this.speed = 0;
			this.accelerationRatePerSecond = 9; // Mile per hour gain per second.
			this.brakingRatePerSecond = 20; /// Mile per hour loss per second.
		}

		accelerate(seconds, callback) {
			const limit = seconds * 1000; // Convert to milliseconds.

			// Recursively go faster until the time limit.
			const goFaster = (start, limit) => {
				setTimeout(() => {
					this.speed += this.accelerationRatePerSecond;
					if (Date.now() - start < limit) {
						goFaster(start, limit);
					} else {
						callback();
					}
				}, 1000);
			};

			goFaster(Date.now(), limit);
		}

		stop(callback) {
			// Recursively go slower until velocity is zero.
			const brake = (start) => {
				setTimeout(() => {
					this.speed -= this.brakingRatePerSecond;
					if (this.speed < 0) {
						this.speed = 0;
					}

					if (this.speed === 0) {
						// Return the total time elapsed.
						callback(Date.now() - start);
					} else {
						brake(start);
					}
				}, 1000);
			};

			brake(Date.now());
		}
	}

	t.describe(`Car#accelerate()`, (t) => {
		const modelX = new Car();
		const timeLimit = 7; // Seven seconds.

		let speed = 0;

		t.before((done) => {
			modelX.accelerate(timeLimit, () => {
				speed = modelX.speed;
				done();
			});
		}, {timeout: 8100});

		t.after((done) => {
			modelX.stop(() => {
				done();
			});
		}, {timeout: 5000});

		t.it(`accelerates to 60mph in less than ${timeLimit} seconds`, () => {
			isGreaterThan(60, speed, `speed is greater than 60mph`);
		});
	});
};
