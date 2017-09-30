'use strict';

const runServer = require(`./helpers/server`).runServer;

let server = null;

exports.setup = function setup(done) {
	return runServer(8080).then((res) => {
		server = res;
		return done();
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
