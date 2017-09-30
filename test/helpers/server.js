// Since the base name of this file is `server.js` and not `config.js`,
// `setup.js`, and does not end with `test.js` it will be ignored by the
// kixx-test-node runner. The fact that the kixx-test-node runner only loads
// files which end with `test.js` or have the base name `config.js`
// or `setup.js` makes it easy to add tooling to your tests.
'use strict';

const http = require(`http`);
const url = require(`url`);

exports.runServer = function createServer(port) {
	const server = http.createServer(handleRequest);

	return new Promise((resolve, reject) => {
		server.on(`error`, reject);
		server.listen(port, `localhost`, () => {
			resolve(server);
		});
	});
};

const DATA = {
	authors: [],
	books: []
};

const authorsController = {
	post(req, res) {
		const payload = req.payload;
		DATA.authors.push(payload);
		return send201(req, res, payload);
	},

	get(req, res) {
		return send200(req, res, DATA.authors);
	}
};

const booksController = {
	post(req, res) {
		const payload = req.payload;
		DATA.books.push(payload);
		return send201(req, res, payload);
	},

	get(req, res) {
		return send200(req, res, DATA.books);
	}
};

function handleRequest(req, res) {
	const method = req.method.toLowerCase();

	let parsingBody;
	if (method === `put` || method === `post` || method === `patch`) {
		parsingBody = parseBody(req);
	} else {
		parsingBody = Promise.resolve(null);
	}

	return parsingBody.then((body) => {
		req.payload = null;
		if (body) {
			try {
				req.payload = JSON.parse(body.trim());
			} catch (err) {
				send400(req, res, `Invalid JSON: ${err.message}`);
				return null;
			}
		}

		switch (url.parse(req.url).pathname) {
			case `/api/authors/`:
				return dispatch(authorsController, req, res);
			case `/api/books/`:
				return dispatch(booksController, req, res);
			default:
				return send404(req, res, `Path not found: ${url.pathname}`);
		}
	});
}

function dispatch(controller, req, res) {
	const method = req.method.toLowerCase();
	const handler = controller[method];

	if (typeof handler !== `function`) {
		return send405(req, res, `Method not allowed: ${req.method}`);
	}

	return handler(req, res);
}

function parseBody(req) {
	return new Promise((resolve, reject) => {
		req.on(`error`, reject);

		req.setEncoding(`utf8`);
		let data = ``;

		req.on(`data`, (chunk) => {
			data += chunk;
		});

		req.on(`end`, () => {
			resolve(data);
		});
	});
}

function send201(req, res, body) {
	return sendJSON(req, res, 201, {
		data: body
	});
}

function send200(req, res, body) {
	return sendJSON(req, res, 200, {
		data: body
	});
}

function send404(req, res, message) {
	return sendJSON(req, res, 404, {
		error: {
			status: 404,
			description: message
		}
	});
}

function send405(req, res, message) {
	return sendJSON(req, res, 405, {
		error: {
			status: 405,
			description: message
		}
	});
}

function send400(req, res, message) {
	return sendJSON(req, res, 400, {
		error: {
			status: 400,
			description: message
		}
	});
}

function sendJSON(req, res, statusCode, payload) {
	payload = JSON.stringify(payload);

	res.writeHead(statusCode, {
		'content-type': `application/json`,
		'content-length': Buffer.byteLength(payload)
	});

	res.end(payload);
	return null;
}
