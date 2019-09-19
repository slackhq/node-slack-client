const fs = require('fs');
const path = require('path');
const { Agent } = require('https');
const { assert } = require('chai');
const { CaptureConsole } = require('@aoberoi/capture-console');
const nock = require('nock');
const Busboy = require('busboy');
const sinon = require('sinon');
const { WebClient } = require('./WebClient');
const { ErrorCode } = require('./errors');
const { LogLevel } = require('./logger');
const { addAppMetadata } = require('./instrument');
const { rapidRetryPolicy } = require('./retry-policies');

const token = 'xoxb-faketoken';

describe('WebClient', () => {
  describe('constructor()', () => {
    it('should build a default client given a token', () => {
      const client = new WebClient(token);
      assert.instanceOf(client, WebClient);
      assert.equal(client.token, token);
      assert.equal(client.slackApiUrl, 'https://slack.com/api/');
    });

    it('should build a client without a token', () => {
      const client = new WebClient();
      assert.instanceOf(client, WebClient);
    });
  });

  describe('has an option to change the log output severity', () => {
    let capture;

    beforeEach(() => {
      capture = new CaptureConsole();
      capture.startCapture();
    });

    it('outputs a debug log on initialization', () => {
      const debuggingClient = new WebClient(token, { logLevel: LogLevel.DEBUG });
      const output = capture.getCapturedText();
      assert.isNotEmpty(output); // should have at least 1 log line, but not asserting since that is an implementation detail
    });

    afterEach(() => {
      capture.stopCapture();
    });
  });

  describe('has a logger option', () => {
    let logger;
    let capture;

    beforeEach(() => {
      capture = new CaptureConsole();
      capture.startCapture();
      logger = {
        debug: sinon.spy(),
        info: sinon.spy(),
        warn: sinon.spy(),
        error: sinon.spy(),
        setLevel: sinon.spy(),
        setName: sinon.spy(),
      };
    });

    it('sends logs to a logger and not to stdout', () => {
      const debuggingClient = new WebClient(token, { logLevel: LogLevel.DEBUG, logger });
      assert.isTrue(logger.debug.called);
      const capturedOutput = capture.getCapturedText();
      assert.isEmpty(capturedOutput);
    });

    afterEach(() => {
      capture.stopCapture();
    });
  });

  describe('apiCall()', () => {
    let client;

    beforeEach(() => {
      client = new WebClient(token, { retryConfig: rapidRetryPolicy });
    });

    describe('when making a successful call', () => {
      let scope;

      beforeEach(() => {
        scope = nock('https://slack.com')
          .post(/api/)
          .reply(200, {
            ok: true,
            response_metadata: {
              warnings: ['testWarning1', 'testWarning2'],
            },
          });
      });

      it('should return results in a Promise', () => {
        const r = client.apiCall('method');
        return r.then((result) => {
          assert(result.ok);
          scope.done();
        });
      });

      it('should send warnings to logs', () => {
        const logger = {
          debug: sinon.spy(),
          info: sinon.spy(),
          warn: sinon.spy(),
          error: sinon.spy(),
          setLevel: sinon.spy(),
          setName: sinon.spy(),
        };
        const warnClient = new WebClient(token, { logLevel: LogLevel.WARN, logger });
        return warnClient.apiCall('method')
          .then(() => {
            assert.isTrue(logger.warn.calledTwice);
          });
      });
    });

    describe('with OAuth scopes in the response headers', () => {
      it('should expose a scopes and acceptedScopes properties on the result', () => {
        const scope = nock('https://slack.com')
          .post(/api/)
          .reply(200, { ok: true }, {
            'X-OAuth-Scopes': 'files:read, chat:write:bot',
            'X-Accepted-OAuth-Scopes': 'files:read',
          });
        return client.apiCall('method')
          .then((result) => {
            assert.deepNestedInclude(result.response_metadata, { scopes: ['files:read', 'chat:write:bot'] });
            assert.deepNestedInclude(result.response_metadata, { acceptedScopes: ['files:read'] });
            scope.done();
          });
      });
    });

    describe('when called with bad options', () => {
      it('should reject its Promise with TypeError', () => {
        const results = [
          client.apiCall('method', 4),
          client.apiCall('method', 'a string'),
          client.apiCall('method', false),
        ];
        const caughtErrors = results.map((r) => {
          return r
            .then(() => {
              // if any of these promises resolve, this test fails
              assert(false);
            })
            .catch((error) => {
              // each promise should reject with the right kind of error
              assert.instanceOf(error, TypeError);
            });
        });
        return Promise.all(caughtErrors);
      });
    });

    describe('when an API call fails', () => {
      let scope;

      beforeEach(() => {
        scope = nock('https://slack.com')
          .post(/api/)
          .reply(500);
      });

      it('should return a Promise which rejects on error', (done) => {
        const r = client.apiCall('method');
        r.catch((error) => {
          assert.instanceOf(error, Error);
          scope.done();
          done();
        });
      });
    });

    it('should fail with WebAPIPlatformError when the API response has an error', (done) => {
      const scope = nock('https://slack.com')
        .post(/api/)
        .reply(200, { ok: false, error: 'bad error' });
      client.apiCall('method')
        .catch((error) => {
          assert.instanceOf(error, Error);
          assert.equal(error.code, ErrorCode.PlatformError);
          assert.nestedPropertyVal(error, 'data.ok', false);
          assert.nestedPropertyVal(error, 'data.error', 'bad error');
          scope.done();
          done();
        });
    });

    it('should fail with WebAPIHTTPError when the API response has an unexpected status', (done) => {
      const body = { foo: 'bar' };
      const scope = nock('https://slack.com')
        .post(/api/)
        .reply(500, body);
      client = new WebClient(token, { retryConfig: { retries: 0 } });
      client.apiCall('method')
        .catch((error) => {
          assert.instanceOf(error, Error);
          assert.equal(error.code, ErrorCode.HTTPError);
          assert.equal(error.statusCode, 500);
          assert.exists(error.headers);
          assert.deepEqual(error.body, body);
          scope.done();
          done();
        });
    });

    it('should fail with WebAPIRequestError when the API request fails', (done) => {
      // One known request error is when the node encounters an ECONNREFUSED. In order to simulate this, rather than
      // using nock, we send the request to a host:port that is not listening.
      client = new WebClient(token, { slackApiUrl: 'https://localhost:8999/api/', retryConfig: { retries: 0 } });
      client.apiCall('method')
        .catch((error) => {
          assert.instanceOf(error, Error);
          assert.equal(error.code, ErrorCode.RequestError);
          assert.instanceOf(error.original, Error);
          done();
        });
    });

    it('should properly serialize simple API arguments', () => {
      const scope = nock('https://slack.com')
        // NOTE: this could create false negatives if the serialization order changes (it shouldn't matter)
        .post(/api/, 'token=xoxb-faketoken&foo=stringval&bar=42&baz=false')
        .reply(200, { ok: true });
      return client.apiCall('method', { foo: 'stringval', bar: 42, baz: false })
        .then(() => {
          scope.done();
        });
    });

    it('should properly serialize complex API arguments', () => {
      const scope = nock('https://slack.com')
        // NOTE: this could create false negatives if the serialization order changes (it shouldn't matter)
        // eslint-disable-next-line max-len
        .post(/api/, 'token=xoxb-faketoken&arraything=%5B%7B%22foo%22%3A%22stringval%22%2C%22bar%22%3A42%2C%22baz%22%3Afalse%2C%22zup%22%3A%5B%22one%22%2C%22two%22%2C%22three%22%5D%7D%5D&objectthing=%7B%22foo%22%3A7%2C%22hum%22%3Afalse%7D')
        .reply(200, { ok: true });
      return client.apiCall('method', {
        // TODO: include things like quotes and emojis
        arraything: [{
          foo: 'stringval',
          bar: 42,
          baz: false,
          zup: ['one', 'two', 'three'],
        }],
        objectthing: {
          foo: 7,
          hum: false,
        },
      })
        .then(() => {
          scope.done();
        });
    });

    it('should remove undefined or null values from simple API arguments', () => {
      const scope = nock('https://slack.com')
        .post(/api/, 'token=xoxb-faketoken&something=else')
        .reply(200, { ok: true });
      return client.apiCall('method', {
        something_undefined: undefined,
        something_null: null,
        something: 'else',
      })
        .then(() => {
          scope.done();
        });
    });

    describe('when API arguments contain binary to upload', () => {
      let scope;

      beforeEach(() => {
        scope = nock('https://slack.com')
          .post(/api/)
          // rather than matching on the body, that nock cannot do for content-type multipart/form-data, we use the
          // response to signal that the body was correctly serialized
          // eslint-disable-next-line prefer-arrow-callback,func-names
          .reply(function (uri, requestBody, cb) {
            // busboy is a parser for for multipart/form-data bodies
            const busboy = new Busboy({ headers: this.req.headers });
            // capture state about all the parts that are in the body
            const parts = { files: [], fields: [], errors: [] };

            // attaching event handlers to track incoming parts
            busboy.on('file', (fieldname, file, filename) => {
              parts.files.push({ fieldname, filename });
              file.resume();
            });
            busboy.on('field', (fieldname, value) => {
              parts.fields.push({ fieldname, value });
            });
            busboy.on('error', (error) => {
              parts.errors.push(error);
            });
            busboy.on('finish', () => {
              // when the parser is done, respond to the request with the state captured
              if (parts.errors.length > 0) {
                cb(parts.errors[0]);
              } else {
                // the response must contain `ok: true` for the client to accept it
                parts.ok = true;
                cb(null, [200, JSON.stringify(parts)]);
              }
            });

            // Write incoming string body to busboy parser
            busboy.end(requestBody ? Buffer.from(requestBody, 'hex') : undefined);
          });
      });

      it('should properly serialize when the binary argument is a ReadableStream', () => {
        const imageStream = fs.createReadStream(path.resolve('test', 'fixtures', 'train.jpg'));

        return client.apiCall('upload', {
          someBinaryField: imageStream,
        })
          .then((parts) => {
            assert.lengthOf(parts.files, 1);
            const file = parts.files[0];
            // the filename is picked up from the the ReadableStream since it originates from fs
            assert.include(file, { fieldname: 'someBinaryField', filename: 'train.jpg' });

            assert.lengthOf(parts.fields, 1);
            assert.deepInclude(parts.fields, { fieldname: 'token', value: token });
          });
      });

      // TODO: some tests with streams/buffers that originate from formiddable and/or request

      it('should use a default name when binary argument is a Buffer', () => {
        const imageBuffer = fs.readFileSync(path.resolve('test', 'fixtures', 'train.jpg'));

        // intentially vague about the method name and argument name
        return client.apiCall('upload', {
          someBinaryField: imageBuffer,
        })
          .then((parts) => {
            assert.lengthOf(parts.files, 1);
            const file = parts.files[0];
            assert.include(file, { fieldname: 'someBinaryField' });
            assert.isString(file.filename);
          });
      });

      it('should filter out undefined values', () => {
        const imageBuffer = fs.readFileSync(path.resolve('test', 'fixtures', 'train.jpg'));

        return client.apiCall('upload', {
          // the binary argument is necessary to trigger form data serialization
          someBinaryField: imageBuffer,
          someUndefinedField: undefined,
        })
          .then((parts) => {
            // the only field is the one related to the token
            assert.lengthOf(parts.fields, 1);
          });
      });
    });

    describe('metadata in the user agent', () => {
      it('should set the user agent to contain package metadata', () => {
        const scope = nock('https://slack.com', {
          reqheaders: {
            'User-Agent': (value) => {
              const metadata = parseUserAgentIntoMetadata(value);
              // NOTE: this assert isn't that strong and doesn't say anything about the values. at this time, there
              // isn't a good way to test this without dupicating the logic of the code under test.
              assert.containsAllKeys(metadata, ['node', '@slack:web-api']);
              // NOTE: there's an assumption that if there's any keys besides these left at all, its the platform part
              delete metadata.node;
              delete metadata['@slack:client'];
              assert.isNotEmpty(metadata);
              return true;
            },
          },
        })
          .post(/api/)
          .reply(200, { ok: true });
        return client.apiCall('method')
          .then(() => {
            scope.done();
          });
      });

      it('should set the user agent to contain application metadata', () => {
        const [name, version] = ['appmedataname', 'appmetadataversion'];
        addAppMetadata({ name, version });
        const scope = nock('https://slack.com', {
          reqheaders: {
            'User-Agent': (value) => {
              const metadata = parseUserAgentIntoMetadata(value);
              assert.propertyVal(metadata, name, version);
              return true;
            },
          },
        })
          .post(/api/)
          .reply(200, { ok: true });
        // NOTE: appMetaData is only evalued on client construction, so we cannot use the client already created
        client = new WebClient(token, { retryConfig: rapidRetryPolicy });
        return client.apiCall('method')
          .then(() => {
            scope.done();
          });
      });
    });
  });

  describe('apiCall() - without a token', () => {
    it('should make successful api calls', () => {
      const client = new WebClient(undefined, { retryConfig: rapidRetryPolicy });

      const scope = nock('https://slack.com')
        // NOTE: this could create false negatives if the serialization order changes (it shouldn't matter)
        .post(/api/, 'foo=stringval')
        .reply(200, { ok: true });

      const r = client.apiCall('method', { foo: 'stringval' });
      return r.then((result) => {
        scope.done();
      });
    });
  });

  describe('apiCall() - when using static headers', () => {
    it('should include static headers on api request', () => {
      const client = new WebClient(token, { headers: { 'X-XYZ': 'value' } });
      const scope = nock('https://slack.com', {
        reqheaders: {
          'X-XYZ': 'value',
        },
      })
        .post(/api/)
        .reply(200, { ok: true });
      const r = client.apiCall('method');
      return r.then((result) => {
        scope.done();
      });
    });
  });

  describe('named method aliases (facets)', () => {
    let client;

    beforeEach(() => {
      client = new WebClient(token, { retryConfig: rapidRetryPolicy });
    });

    it('should properly mount methods as functions', () => {
      // This test doesn't exhaustively check all the method aliases, it just tries a couple.
      // This should be enough since all methods are mounted in the exact same way.
      const scope = nock('https://slack.com')
        .post('/api/chat.postMessage', 'token=xoxb-faketoken&foo=stringval')
        .reply(200, { ok: true })
        // Trying this method because its mounted one layer "deeper"
        .post('/api/team.profile.get', 'token=xoxb-faketoken')
        .reply(200, { ok: true });
      return Promise.all([client.chat.postMessage({ foo: 'stringval' }), client.team.profile.get()])
        .then(() => {
          scope.done();
        });
    });
  });

  describe('paginate()', () => {
    let client;
    let method;

    beforeEach(() => {
      client = new WebClient(token, { retryConfig: rapidRetryPolicy });
      method = 'conversations.list';
    });

    describe('logging', () => {
      let capture;

      beforeEach(() => {
        capture = new CaptureConsole();
        capture.startCapture();
      });

      it('should log a warning when called with a method not known to be cursor pagination enabled', () => {
        client.paginate('method');
        const output = capture.getCapturedText();
        assert.isNotEmpty(output);
      });

      it('should not log a warning when called with a known cursor pagination enabled', () => {
        client.paginate(method);
        const output = capture.getCapturedText();
        assert.isEmpty(output);
      });

      afterEach(() => {
        capture.stopCapture();
      });
    });

    describe('when not given shouldStop predicate', () => {
      it('should return an AsyncIterator', () => {
        const iterator = client.paginate(method);
        assert.isOk(iterator[Symbol.asyncIterator]);
      });

      it('can iterate multiple pages', async () => {
        const scope = nock('https://slack.com')
          .post(/api/)
          .reply(200, { ok: true, response_metadata: { next_cursor: 'CURSOR' } })
          .post(/api/, (body) => {
            // NOTE: limit value is compared as a string because nock doesn't properly serialize the param into a number
            return body.limit && body.limit === '200' && body.cursor && body.cursor === 'CURSOR';
          })
          .reply(200, { ok: true });
        const iterator = client.paginate(method);

        const { value: firstPage, done: firstDone } = await iterator.next();
        assert.isOk(firstPage);
        assert.isFalse(firstDone);
        const { value: secondPage, done: secondDone } = await iterator.next();
        assert.isOk(secondPage);
        assert.isFalse(secondDone);
        const { value: thirdPage, done: thirdDone } = await iterator.next();
        assert.isNotOk(thirdPage);
        assert.isTrue(thirdDone);

        scope.done();
      });

      it('can iterate multiple pages with limit items per page', async () => {
        const limit = 4;
        const scope = nock('https://slack.com')
          .post(/api/, (body) => {
            // NOTE: limit value is compared as a string because nock doesn't properly serialize the param into a number
            return body.limit && body.limit === limit.toString();
          })
          .reply(200, { ok: true, response_metadata: { next_cursor: 'CURSOR' } })
          .post(/api/, (body) => {
            // NOTE: limit value is compared as a string because nock doesn't properly serialize the param into a number
            return body.limit && body.limit === limit.toString() && body.cursor && body.cursor === 'CURSOR';
          })
          .reply(200, { ok: true });
        const iterator = client.paginate(method, { limit });

        const { value: firstPage, done: firstDone } = await iterator.next();
        assert.isOk(firstPage);
        assert.isFalse(firstDone);
        const { value: secondPage, done: secondDone } = await iterator.next();
        assert.isOk(secondPage);
        assert.isFalse(secondDone);
        const { value: thirdPage, done: thirdDone } = await iterator.next();
        assert.isNotOk(thirdPage);
        assert.isTrue(thirdDone);

        scope.done();
      });

      it('can resume iteration from a result with an existing cursor', async () => {
        const cursor = 'PRE_CURSOR';
        const scope = nock('https://slack.com')
          .post(/api/, (body) => {
            return body.cursor && body.cursor === cursor;
          })
          .reply(200, { ok: true, response_metadata: { next_cursor: 'CURSOR' } })
          .post(/api/, (body) => {
            return body.cursor && body.cursor === 'CURSOR';
          })
          .reply(200, { ok: true });
        const iterator = client.paginate(method, { cursor });

        const { value: firstPage, done: firstDone } = await iterator.next();
        assert.isOk(firstPage);
        assert.isFalse(firstDone);
        const { value: secondPage, done: secondDone } = await iterator.next();
        assert.isOk(secondPage);
        assert.isFalse(secondDone);
        const { value: thirdPage, done: thirdDone } = await iterator.next();
        assert.isNotOk(thirdPage);
        assert.isTrue(thirdDone);

        scope.done();
      });
    });

    describe('when given shouldStop predicate', () => {
      it('should iterate until the end when shouldStop always returns false', async () => {
        const scope = nock('https://slack.com')
          .post(/api/)
          .reply(200, { ok: true, response_metadata: { next_cursor: 'CURSOR' } })
          .post(/api/, (body) => {
            // NOTE: limit value is compared as a string because nock doesn't properly serialize the param into a number
            return body.limit && body.limit === '200' && body.cursor && body.cursor === 'CURSOR';
          })
          .reply(200, { ok: true });

        const neverStop = sinon.fake.returns(false);
        await client.paginate(method, {}, neverStop);
        assert.equal(neverStop.callCount, 2);

        scope.done();
      });

      it('should only iterate once when shouldStop always returns true', async () => {
        const scope = nock('https://slack.com')
          .post(/api/)
          .reply(200, { ok: true, response_metadata: { next_cursor: 'CURSOR' } });

        const neverStop = sinon.fake.returns(true);
        await client.paginate(method, {}, neverStop);
        assert.equal(neverStop.callCount, 1);

        scope.done();
      });

      it('should iterate twice when shouldStop always returns false then true', async () => {
        const scope = nock('https://slack.com')
          .post(/api/)
          .reply(200, { ok: true, response_metadata: { next_cursor: 'CURSOR_1' } })
          .post(/api/, (body) => {
            return body.cursor && body.cursor === 'CURSOR_1';
          })
          .reply(200, { ok: true, response_metadata: { next_cursor: 'CURSOR_2' } });

        const shouldStop = sinon.stub();
        shouldStop.onCall(0).returns(false);
        shouldStop.onCall(1).returns(true);
        await client.paginate(method, {}, shouldStop);
        assert.equal(shouldStop.callCount, 2);

        scope.done();
      });

      describe('when given a reduce function', () => {
        it('should resolve for the accumulated value', async () => {
          const scope = nock('https://slack.com')
            .post(/api/)
            .reply(200, { ok: true, v: 1, response_metadata: { next_cursor: 'CURSOR' } })
            .post(/api/, (body) => {
              // NOTE: limit value is compared as a string because nock doesn't properly serialize the param into a number
              return body.limit && body.limit === '200' && body.cursor && body.cursor === 'CURSOR';
            })
            .reply(200, { ok: true, v: 2 });

          const sum = await client.paginate(method, {}, () => false, (acc, page) => {
            if (acc === undefined) {
              acc = 0;
            }
            if (page.v && typeof page.v === 'number') {
              acc += page.v;
            }
            return acc;
          });
          assert.equal(sum, 3);

          scope.done();
        });
      });
    });
  });

  describe('has option to change slackApiUrl', () => {
    it('should send requests to an alternative URL', () => {
      const alternativeUrl = 'http://12.34.56.78/api/';
      const scope = nock(alternativeUrl)
        .post(/api\/method/)
        .reply(200, { ok: true });
      const client = new WebClient(token, { slackApiUrl: alternativeUrl });
      return client.apiCall('method');
    });
  });

  describe('has an option to set a custom HTTP agent', () => {
    it('should send a request using the custom agent', () => {
      const agent = new Agent({ keepAlive: true });
      const spy = sinon.spy(agent, 'addRequest');
      const client = new WebClient(token, { agent, retryConfig: rapidRetryPolicy });
      return client.apiCall('method')
        .catch(() => {
          assert(spy.called);
        })
        .then(() => {
          agent.addRequest.restore();
          agent.destroy();
        })
        .catch((error) => {
          agent.addRequest.restore();
          agent.destroy();
          throw error;
        });
    });
  });

  describe('has an option to set request concurrency', () => {
    // TODO: factor out common logic into test helpers
    const responseDelay = 100; // ms
    let testStart;
    let scope;

    beforeEach(() => {
      testStart = Date.now();
      scope = nock('https://slack.com')
        .persist()
        .post(/api/)
        .delay(responseDelay)
        .reply(200, (uri, requestBody, cb) => {
          // NOTE: the assumption is that this function gets called right away when the request body is available,
          // not after the delay
          const diff = Date.now() - testStart;
          return cb(null, [200, JSON.stringify({ ok: true, diff })]);
        });
    });

    it('should have a default conncurrency of 3', () => {
      const client = new WebClient(token);
      const requests = [
        client.apiCall('1'),
        client.apiCall('2'),
        client.apiCall('3'),
        client.apiCall('4'),
      ];
      return Promise.all(requests)
        .then((responses) => {
          // verify all responses are present
          assert.lengthOf(responses, 4);

          // verify that maxRequestConcurrency requests were all sent concurrently
          const concurrentResponses = responses.slice(0, 3); // the first 3 responses
          concurrentResponses.forEach(r => assert.isBelow(r.diff, responseDelay));

          // verify that any requests after maxRequestConcurrency were delayed by the responseDelay
          const queuedResponses = responses.slice(3);
          const minDiff = concurrentResponses[concurrentResponses.length - 1].diff + responseDelay;
          queuedResponses.forEach(r => assert.isAtLeast(r.diff, minDiff));
        });
    });

    it('should allow concurrency to be set', () => {
      const client = new WebClient(token, { maxRequestConcurrency: 1 });
      const requests = [client.apiCall('1'), client.apiCall('2')];
      return Promise.all(requests)
        .then((responses) => {
          // verify all responses are present
          assert.lengthOf(responses, 2);

          // verify that maxRequestConcurrency requets were all sent concurrently
          const concurrentResponses = responses.slice(0, 1); // the first response
          concurrentResponses.forEach(r => assert.isBelow(r.diff, responseDelay));

          // verify that any requests after maxRequestConcurrency were delayed by the responseDelay
          const queuedResponses = responses.slice(1);// the second response
          const minDiff = concurrentResponses[concurrentResponses.length - 1].diff + responseDelay;
          queuedResponses.forEach((r) => { assert.isAtLeast(r.diff, minDiff); });
        });
    });

    afterEach(() => {
      scope.persist(false);
    });
  });

  describe('has an option to set the retry policy ', () => {
    it('retries a request which fails to get a response', () => {
      const scope = nock('https://slack.com')
        .post(/api/)
        .replyWithError('could be a ECONNREFUSED, ENOTFOUND, ETIMEDOUT, ECONNRESET')
        .post(/api/)
        .reply(200, { ok: true });
      const client = new WebClient(token, { retryConfig: rapidRetryPolicy });
      return client.apiCall('method')
        .then((resp) => {
          assert.propertyVal(resp, 'ok', true);
          scope.done();
        });
    });

    it('retries a request whose response has a status code that is not 200 nor 429 (rate limited)', () => {
      const scope = nock('https://slack.com')
        .post(/api/)
        .reply(500)
        .post(/api/)
        .reply(200, { ok: true });
      const client = new WebClient(token, { retryConfig: rapidRetryPolicy });
      return client.apiCall('method')
        .then((resp) => {
          assert.propertyVal(resp, 'ok', true);
          scope.done();
        });
    });
  });

  describe('has rate limit handling', () => {
    describe('when configured to reject rate-limited calls', () => {
      let client;

      beforeEach(() => {
        client = new WebClient(token, { rejectRateLimitedCalls: true });
      });

      it('should reject with a WebAPIRateLimitedError when a request fails due to rate-limiting', (done) => {
        const retryAfter = 5;
        const scope = nock('https://slack.com')
          .post(/api/)
          .reply(429, '', { 'retry-after': retryAfter });
        client.apiCall('method')
          .catch((error) => {
            assert.instanceOf(error, Error);
            assert.equal(error.code, ErrorCode.RateLimitedError);
            assert.equal(error.retryAfter, retryAfter);
            scope.done();
            done();
          });
      });

      it('should emit a rate_limited event on the client', (done) => {
        const spy = sinon.spy();
        const scope = nock('https://slack.com')
          .post(/api/)
          .reply(429, {}, { 'retry-after': 0 });
        client = new WebClient(token, { rejectRateLimitedCalls: true });
        client.on('rate_limited', spy);
        client.apiCall('method')
          .catch((err) => {
            assert(spy.calledOnceWith(0));
            scope.done();
            done();
          });
      });
    });

    it('should automatically retry the request after the specified timeout', () => {
      const retryAfter = 1;
      const scope = nock('https://slack.com')
        .post(/api/)
        .reply(429, '', { 'retry-after': retryAfter })
        .post(/api/)
        .reply(200, { ok: true });
      const client = new WebClient(token, { retryConfig: rapidRetryPolicy });
      const startTime = Date.now();
      return client.apiCall('method')
        .then(() => {
          const diff = Date.now() - startTime;
          assert.isAtLeast(diff, retryAfter * 1000, 'elapsed time is at least a second');
          scope.done();
        });
    });

    it('should include retryAfter metadata if the response has retry info', () => {
      const scope = nock('https://slack.com')
        .post(/api/)
        .reply(200, { ok: true }, { 'retry-after': 100 });
      const client = new WebClient(token);
      return client.apiCall('method')
        .then((data) => {
          assert(data.response_metadata.retryAfter === 100);
          scope.done();
        });
    });

    it('should pause the remaining requests in queue', () => {
      const startTime = Date.now();
      const retryAfter = 1;
      const scope = nock('https://slack.com')
        .post(/api/)
        .reply(429, '', { 'retry-after': retryAfter })
        .post(/api/)
        .reply(200, (uri, requestBody) => {
          return JSON.stringify({ ok: true, diff: Date.now() - startTime });
        })
        .post(/api/)
        .reply(200, (uri, requestBody) => {
          return JSON.stringify({ ok: true, diff: Date.now() - startTime });
        });
      const client = new WebClient(token, { retryConfig: rapidRetryPolicy, maxRequestConcurrency: 1 });
      const firstCall = client.apiCall('method');
      const secondCall = client.apiCall('method');
      return Promise.all([firstCall, secondCall])
        .then(([firstResult, secondResult]) => {
          assert.isAtLeast(firstResult.diff, retryAfter * 1000);
          assert.isAtLeast(secondResult.diff, retryAfter * 1000);
          scope.done();
        });
    });

    it('should emit a rate_limited event on the client', (done) => {
      const spy = sinon.spy();
      const scope = nock('https://slack.com')
        .post(/api/)
        .reply(429, {}, { 'retry-after': 0 });
      const client = new WebClient(token, { retryConfig: { retries: 0 } });
      client.on('rate_limited', spy);
      client.apiCall('method')
        .catch((err) => {
          assert(spy.calledOnceWith(0));
          scope.done();
          done();
        });
    });
  });

  it('should throw an error if the response has no retry info', (done) => {
    const scope = nock('https://slack.com')
      .post(/api/)
      .reply(429, {}, { 'retry-after': undefined });
    const client = new WebClient(token);
    client.apiCall('method')
      .catch((err) => {
        assert.instanceOf(err, Error);
        scope.done();
        done();
      });
  });

  it('should throw an error if the response has an invalid retry-after header', (done) => {
    const scope = nock('https://slack.com')
      .post(/api/)
      .reply(429, {}, { 'retry-after': 'notanumber' });
    const client = new WebClient(token);
    client.apiCall('method')
      .catch((err) => {
        assert.instanceOf(err, Error);
        scope.done();
        done();
      });
  });


  afterEach(() => {
    nock.cleanAll();
  });
});

// Helpers
function parseUserAgentIntoMetadata(userAgent) {
  // naive implementation, this might break on platforms whose names or version numbers have spaces or slashes in them,
  // and that if app metadata keys or values have spaces or slashes in them.
  const parts = userAgent.split(' ');
  return parts.reduce((digest, part) => {
    const [key, val] = part.split('/');
    digest[key] = val;
    return digest;
  }, {});
}
