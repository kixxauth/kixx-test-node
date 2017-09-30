'use strict';

const http = require(`http`);

exports.createClient = function createClient(options) {
	// Make a deep clone to prevent mutation.
	options = JSON.parse(JSON.stringify(options));

	const headers = options.headers || {};
	headers.accept = `application/json`;
	options.headers = headers;

	return function request(params, payload) {
		params = Object.assign({}, options, params);

		return new Promise((resolve, reject) => {
			if (payload) {
				payload = JSON.stringify(payload);
				params.headers[`content-type`] = `application/json`;
				params.headers[`content-length`] = Buffer.byteLength(payload);
			}

			const req = http.request(params, (res) => {
				res.on(`error`, reject);

				res.setEncoding(`utf8`);
				let body = ``;
				res.on(`data`, (chunk) => {
					body += chunk;
				});

				res.on(`end`, () => {
					res.payload = JSON.parse(body);
					resolve(res);
				});
			});

			req.on(`error`, (err) => {
				if (err.code === `ECONNREFUSED`) {
					return reject(new Error(`HTTP Server connection refused: ${err.message}`));
				}
				return reject(new Error(`HTTP Request error: ${err.message}`));
			});

			if (payload) {
				req.write(payload);
			}

			req.end();
		});
	};
};
