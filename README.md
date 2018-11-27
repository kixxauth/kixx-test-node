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

## Command Line Reference
You can get help directly from the command line tool by running:

```bash
# Installed globally
$ kixx-test-node --help

# Installed locally
$ node_modules/.bin/kixx-test-node --help
```

You can run only the tests in a single file by running:

```
$ kixx-test-node ./test/path/to/my-test.js
```

__!Note:__ Running a single file like in the above example will still load any `setup.js` or `config.js` files found in the configured test directory, even if the test file is located in a different folder tree. See [Configuration and Setup Helpers](#configuration-and-setup-helpers) below.

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
Each concept you intend to verify with a test should be encapsulated in an `t.it()` block. If an error is thrown from within the block (the function passed into `t.it()`) the test will fail. If no errors are thrown the test will be considered to have passed.

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

__!Warning:__ Each describe block creates a new test block instance. So, although the `t` instance passed into one block has the same API signature as another, it is a completely different instance. In practice, this fact should never bother you unless you try to assign properties to `t`.

### Asynchronous Setup and Teardown
Setup and teardown can be accomplished with `t.before()` and `t.after()` blocks within a describe block.

Setup and teardown `t.before()` and `t.after()` blocks are *always* run asychronously. The `done()` callback passed to each of them must be called before the configured timeout expires. If time expires a timeout error will be thrown, failing the test run.

If `done()` is called with a truthy argument, it is assumed to be an error and will be considered to have failed.

__!Important:__ It is *not* possible to test anything asychronously from within a `t.it()` block. This is by design. It forces you to put all of your asynchronous operations into `t.before()` and `t.after()` blocks and call the `done()` callback when the operation is complete. This results in cleaner tests which are easier to reason about, introducing fewer bugs around asynchronous logic.

```js
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
```

## Configuration and Setup Helpers
If kixx-test-node discovers any file nested in your test directory named `config.js` it will use it to override the default configuration. You can then override these configurations using the command line arguments. See the `config.js` file in the test directory of this project as an example. Possible configuration values are:

- `timeout:` The number of milliseconds available for before() and after() blocks to run before throwing a timeout error.
- `maxErrors:` The maxiumum number of errors before bailing out of the test run. `Infinity` and `-1` both achieve the same thing. If you want the test run to bail after the first error, use `0`.
- `maxStack:` The maximum number of lines to include in stack traces.

Also, if kixx-test-node discovers any file nested in your test directory named `setup.js`, and it exports `setup` or `teardown` functions, they will be called before and after the full test run respectively. This is a great place to do things like start and shutdown HTTP and database services. See the `setup.js` file in the test directory of this project as an example.

## Pending Tests
Entire blocks of tests can be marked as pending by using `t.xdescribe()` where you would use `t.describe()`. None of the `before`, `after`, `describe`, or `it` blocks within the pending block will be run.

Also, a single test can be marked as pending by using `xit()` where you would use `it()`.

Pending blocks or tests are marked as such in the test output, but are not considered a test failure.

## Exclusive Tests
The `--pattern` command line option.

It can sometimes be helpful when debugging to run a single test block or individual test exclusively. This can be done by using the `--pattern` command line option. Only nested paths which match your pattern will be run. The pattern must start with the reletive file path and should be enclosed in single `'` quotes. In the nested example above (testing JavaScript Math) let's assume the file exists on this path: `test/base-js/math-test.js`. A valid pattern would be:

```
$ node_modules/.bin/kixx-test-node --pattern 'base-js/math-test.js Math.abs() should not round floating point numbers'
```

Note that each nested block name is separated by a space in the pattern.

## Test Output
Test output is always piped into `process.stdout` by kixx-test-node. The start of each before() or after() block, errors discovered in each test, the stack traces of errors, number of tests run, number of errors reported, and overall pass/fail status are reported.

Here is an example of a successful run:

```
Initializing kixx-test-node runner.
Test file count: 2
Setup complete.

- [api/authors-test.js GET] - before() in 23ms
- [api/authors-test.js POST] - before() in 6ms
- [api/books-test.js GET] - before() in 2ms
- [api/books-test.js POST] - before() in 4ms

Test run complete. 14 tests ran. 0 errors reported.
Test tear down complete.

PASS
```

Here is an example of a failing run:

```
Initializing kixx-test-node runner.
Test file count: 2
Setup complete.

- [api/authors-test.js GET] - before() in 21ms
- [api/authors-test.js POST] - before() in 9ms
- [api/books-test.js GET] - before() in 2ms
- [api/books-test.js POST] - before() in 5ms

! [api/books-test.js POST: it has HTTP 201 status code] FAIL
    AssertionError: HTTP status code :: expected Number(201) to equal Number(200)
        at t.it (/Users/kris/Projects/kixx-test-node/test/api/books-test.js:67:4)


AssertionError: HTTP status code :: expected Number(201) to equal Number(200)
    at t.it (/Users/kris/Projects/kixx-test-node/test/api/books-test.js:67:4)
    at test (/Users/kris/Projects/kixx-test-node/node_modules/kixx-test/kixx-test.js:156:10)
    at link (/Users/kris/Projects/kixx-test-node/node_modules/kixx-test/kixx-test.js:43:11)
    at done (/Users/kris/Projects/kixx-test-node/node_modules/kixx-test/kixx-test.js:253:7)

maxErrors: 0 exceeded. All Errors reported. Exiting.
```

The test process will exit with code 1 if a test fails or error is thrown. It will exit with code 0 if all is well.

You can cause the test run to exit before completion after a certain number of errors are reported by setting `maxErrors` in your `config.js` file or as a command line option.

Without the `--verbose` flag, which is the default, the before() and after() log lines will not be printed.

If the `--quiet` flag is set, the spinner will not be displayed.

Also, you can limit the number of lines reported in error stack traces by setting `maxStack` in your `config.js` or as a command line option.

Copyright and License
---------------------
Copyright: (c) 2017 by Kris Walker (www.kixx.name)

Unless otherwise indicated, all source code is licensed under the MIT license. See MIT-LICENSE for details.

