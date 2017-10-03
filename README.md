Kixx-Test Node
==============
A Node.js test runner and reporter with [Kixx-Test](https://github.com/kixxauth/kixx-test) under the hood.

[![npm package](https://nodei.co/npm/kixx-test-node.png)](https://nodei.co/npm/kixx-test-node/)

## Installation
Install locally and save to `package.json` in "devDependencies":

```
$ npm install --save-dev kixx-test-node
```

Or, install globally:

```
$ npm install --global kixx-test-node
```

## Authoring Tests
In the simplest case, Kixx Test uses "it" blocks to describe conditions which should hold true. Let's say you have a file named `examples/math-round-test.js`:

```js
const assert = require(`assert`);

module.exports = (t) => {

    t.it(`should round floating point numbers to integers`, () => {
        assert.equal(Math.round(1.5), 2, `1.5 rounds to 2`);
    });

    t.it(`should not change integers`, () => {
        assert.equal(Math.round(-2), -2, `-2 rounds to 2`);
    });

};
```

Your test file just needs to set `module.exports` to a function. kixx-test-node will pass in the test runner instance, which you then use to author your tests.

You can run this with the command:

```
$ kixx-test-node examples/math-round-test.js
```

### How it Works
Each concept you intend to verify with a test should be encapsulated in an `it()` block. If an error is thrown from within the block (the function passed into `t.it()`) the test will fail. If no errors are thrown the test will be considered to have passed.

The [Node.js assertion module](https://nodejs.org/dist/latest/docs/api/assert.html) works well to test expressions and throw errors, but any assertion library which throws errors on failures will work. Here are some alternatives:

- [KixxAssert](https://github.com/kixxauth/kixx-assert)
- [Must.js](https://github.com/moll/js-must)
- [Chai](http://chaijs.com/)
- [Should.js](https://github.com/shouldjs/should.js)

### Nesting Tests in Describe Blocks
It can sometimes be useful to partition your testing logic into blocks for better readability and separation of concerns. Here is a quick example:

```js
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
```

In addition to making the test code more readable, nesting tests in describe blocks also makes the test output more informative in your console.

__!Warning:__ Each describe block is a test block instance. So, although the `t` instance passed into the one block has the same API signature as another, it is a completely different instance. In practice, this fact should never bother you unless you try to assign properties to `t`.

### Asynchronous Setup and Teardown
Example:

```js
const KixxAssert = require(`kixx-assert`);

const {isGreaterThan} = KixxAssert.assert;

module.exports = (t) => {

    class Car {
        constructor() {
            this.speed = 0;
            this.accelerationRatePerSecond = 9; // Mile per hour gain per second.
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
                        callback(this);
                    }
                }, 1000);
            };

            goFaster(Date.now(), limit);
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
        });

        t.it(`accelerates to 60mph in less than ${timeLimit} seconds`, () => {
            isGreaterThan(60, speed, `speed is greater than 60mph`);
        });
    });
};
```

## Test Output
Test output is always piped into `process.std.error` by kixx-test-node. The start of each describe block, the time consumed in each before() or after() block, errors discovered in each test, the stack traces of errors, number of tests run, number of errors reported, and overall pass/fail status are reported.

Here is an example of a successful run:

```
Initializing kixx-test-node runner.
Test file count: 2
Setup complete.

- [../examples/math-round-test.js] - start
- [../examples/math-test.js Math.round()] - start
- [../examples/math-test.js Math.abs()] - start

Test run complete. 6 tests ran. 0 errors reported.
Test tear down complete.

PASS
```

Here is an example of a failing run:

```
Initializing kixx-test-node runner.
Test file count: 2
Setup complete.

- [../examples/math-round-test.js] - start
- [../examples/math-test.js Math.round()] - start
- [../examples/math-test.js Math.round(): it should not change integers] FAIL
    AssertionError: -2 rounds to 2 :: expected Number(2) to equal Number(-2)
        at t.it (/Users/kris/Projects/kixx-test-node/examples/math-test.js:22:4)

- [../examples/math-test.js Math.abs()] - start

AssertionError: -2 rounds to 2 :: expected Number(2) to equal Number(-2)
    at t.it (/Users/kris/Projects/kixx-test-node/examples/math-test.js:22:4)
    at test (/Users/kris/Projects/kixx-test-node/node_modules/kixx-test/kixx-test.js:127:10)
    at link (/Users/kris/Projects/kixx-test-node/node_modules/kixx-test/kixx-test.js:25:11)
    at test (/Users/kris/Projects/kixx-test-node/node_modules/kixx-test/kixx-test.js:136:5)


Test run complete. 6 tests ran. 1 errors reported.
Test tear down complete.

FAIL
```

The test process will exit with code 1 if a test fails or error is thrown. It will exit with code 0 if all is well.

You can cause the test run to exit before completion after a certain number of errors are reported by setting `maxErrors.`.

You can limit the number of lines reported in error stack traces by setting `maxStack`.

Copyright and License
---------------------
Copyright: (c) 2017 by Kris Walker (www.kixx.name)

Unless otherwise indicated, all source code is licensed under the MIT license. See MIT-LICENSE for details.

