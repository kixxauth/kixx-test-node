'use strict';

const KixxAssert = require(`kixx-assert`);
const client = require(`../helpers/client`);

const {isOk, isEqual} = KixxAssert.assert;

module.exports = function (t) {
	const request = client.createClient({
		hostname: `localhost`,
		port: 8080
	});

	t.describe(`GET`, (t) => {
		let result = null;

		t.before((done) => {
			return request({method: `GET`, path: `/api/authors/`})
				.then((res) => {
					result = res;
					return null;
				})
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
			name: `Hunter S. Thompson`,
			wikipedia: `https://en.wikipedia.org/wiki/Hunter_S._Thompson`
		};

		t.before((done) => {
			return request({method: `POST`, path: `/api/authors/`}, resource)
				.then((res) => {
					result = res;
					return null;
				})
				.then(() => {
					return request({method: `GET`, path: `/api/authors/`});
				})
				.then((res) => {
					fetch = res;
					return null;
				})
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
			isEqual(`Hunter S. Thompson`, result.payload.data.name, `resource.name`);
		});

		t.it(`immediately created the resource`, () => {
			isEqual(`Hunter S. Thompson`, fetch.payload.data[0].name, `resource.name`);
		});
	});
};
