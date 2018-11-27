'use strict';

const runServer = require(`./helpers/server`).runServer;

let server = null;

function delay(ms) {
	return new Promise((resolve) => {
		setTimeout(() => {
			resolve();
		}, ms);
	});
}

exports.setup = function setup(done) {
	return runServer(8080).then((res) => {
		server = res;
		// Introduce a delay for testing.
		return delay(300).then(() => done());
	}).catch(done);
};

exports.teardown = function teardown(done) {
	if (server) {
		return server.close(() => {
			return done();
		});
	}

	done();
};
