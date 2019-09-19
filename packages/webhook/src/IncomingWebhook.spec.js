const { Agent } = require('https');
const { assert } = require('chai');
const nock = require('nock');
const sinon = require('sinon');
const { IncomingWebhook } = require('./IncomingWebhook');
const { ErrorCode } = require('./errors');

const url = 'https://hooks.slack.com/services/FAKEWEBHOOK';

describe('IncomingWebhook', () => {
  describe('constructor()', () => {
    it('should build a default wehbook given a URL', () => {
      const webhook = new IncomingWebhook(url);
      assert.instanceOf(webhook, IncomingWebhook);
    });
  });

  describe('send()', () => {
    let webhook;

    beforeEach(() => {
      webhook = new IncomingWebhook(url);
    });

    describe('when making a successful call', () => {
      let scope;

      beforeEach(() => {
        scope = nock('https://hooks.slack.com')
          .post(/services/)
          .reply(200, 'ok');
      });

      it('should return results in a Promise', () => {
        webhook.send('Hello').then((result) => {
          assert.strictEqual(result.text, 'ok');
          scope.done();
        });
      });
    });

    describe('when the call fails', () => {
      let statusCode;
      let scope;

      beforeEach(() => {
        statusCode = 500;
        scope = nock('https://hooks.slack.com')
          .post(/services/)
          .reply(this.statusCode);
      });

      it('should return a Promise which rejects on error', () => {
        const result = webhook.send('Hello');
        return result.catch((error) => {
          assert.ok(error);
          assert.instanceOf(error, Error);
          assert.match(error.message, new RegExp(statusCode));
          scope.done();
        });
      });

      it('should fail with IncomingWebhookRequestError when the API request fails', () => {
        // One known request error is when the node encounters an ECONNREFUSED. In order to simulate this, rather than
        // using nock, we send the request to a host:port that is not listening.
        webhook = new IncomingWebhook('https://localhost:8999/api/');
        const result = webhook.send('Hello');
        return result.catch((error) => {
          assert.instanceOf(error, Error);
          assert.equal(error.code, ErrorCode.RequestError);
          assert.instanceOf(error.original, Error);
        });
      });
    });

    describe('lifecycle', () => {
      it('should not overwrite the default parameters after a call', () => {
        const defaultParams = { channel: 'default' };
        const expectedParams = Object.assign({}, defaultParams);

        webhook = new IncomingWebhook(url, defaultParams);

        const result = webhook.send({ channel: 'different' });
        return result.catch((error) => {
          assert.deepEqual(webhook.defaults, expectedParams);
        });
      });
    });
  });

  describe('has an option to set a custom HTTP agent', () => {
    it('should send a request using the custom agent', () => {
      const agent = new Agent({ keepAlive: true });
      const spy = sinon.spy(agent, 'addRequest');
      const webhook = new IncomingWebhook(url, { agent });

      return webhook.send('Hello')
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

  afterEach(() => {
    nock.cleanAll();
  });
});
