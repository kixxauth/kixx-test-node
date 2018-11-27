'use strict';

const KixxAssert = require(`kixx-assert`);
const client = require(`../helpers/client`);

const {isOk, isEqual} = KixxAssert.assert;

module.exports = function (t) {
	function delay(ms) {
		return function (res) {
			return new Promise((resolve) => {
				setTimeout(() => {
					resolve(res);
				}, ms);
			});
		};
	}

	const request = client.createClient({
		hostname: `localhost`,
		port: 8080
	});

	t.describe(`GET`, (t) => {
		let result = null;

		t.before((done) => {
			return request({method: `GET`, path: `/api/books/`})
				.then((res) => {
					result = res;
					return null;
				})
				.then(delay(200))
				.then(done)
				.catch(done);
		});

		t.it(`has HTTP 200 status code`, () => {
			isEqual(200, result.statusCode, `HTTP status code`);
		});

		t.it(`has JSON Content-Type`, () => {
			isEqual(`application/json`, result.headers[`content-type`], `Content-Type`);
		});

		t.it(`has valid Array as payload.data`, () => {
			isOk(Array.isArray(result.payload.data), `is Array`);
		});
	});

	t.describe(`POST`, (t) => {
		let result = null;
		let fetch = null;

		const resource = {
			title: `Fear and Loathing in Las Vegas`,
			amazon: `https://www.amazon.com/Fear-Loathing-Las-Vegas-American-ebook/dp/B003WUYQG4/`
		};

		t.before((done) => {
			return request({method: `POST`, path: `/api/books/`}, resource)
				.then((res) => {
					result = res;
					return null;
				})
				.then(() => {
					return request({method: `GET`, path: `/api/books/`});
				})
				.then((res) => {
					fetch = res;
					return null;
				})
				.then(delay(200))
				.then(done)
				.catch(done);
		});

		t.it(`has HTTP 201 status code`, () => {
			isEqual(201, result.statusCode, `HTTP status code`);
		});

		t.it(`has JSON Content-Type`, () => {
			isEqual(`application/json`, result.headers[`content-type`], `Content-Type`);
		});

		t.it(`has valid Object as payload.data`, () => {
			isEqual(`Fear and Loathing in Las Vegas`, result.payload.data.title, `resource.title`);
		});

		t.it(`immediately created the resource`, () => {
			isEqual(`Fear and Loathing in Las Vegas`, fetch.payload.data[0].title, `resource.title`);
		});
	});
};
