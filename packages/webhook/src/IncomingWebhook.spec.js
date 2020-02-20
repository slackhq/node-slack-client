require('mocha');
const { Agent } = require('https');
const { IncomingWebhook } = require('./IncomingWebhook');
const { ErrorCode } = require('./errors');
const { assert } = require('chai');
const nock = require('nock');
const sinon = require('sinon');

const url = 'https://hooks.slack.com/services/FAKEWEBHOOK';

describe('IncomingWebhook', function () {

  describe('constructor()', function () {
    it('should build a default wehbook given a URL', function () {
      const webhook = new IncomingWebhook(url);
      assert.instanceOf(webhook, IncomingWebhook);
    });
  });

  describe('send()', function () {
    beforeEach(function () {
      this.webhook = new IncomingWebhook(url);
    });

    describe('when making a successful call', function () {
      beforeEach(function () {
        this.scope = nock('https://hooks.slack.com')
          .post(/services/)
          .reply(200, 'ok');
      });

      it('should return results in a Promise', async function () {
        const result = await this.webhook.send('Hello');
        assert.strictEqual(result.text, 'ok');
        this.scope.done();
      });
    });

    describe('when the call fails', function () {
      beforeEach(function () {
        this.statusCode = 500;
        this.scope = nock('https://hooks.slack.com')
          .post(/services/)
          .reply(this.statusCode);
      });

      it('should return a Promise which rejects on error', async function () {
        try {
          await this.webhook.send('Hello');
          assert.fail();
        } catch (error) {
          assert.ok(error);
          assert.instanceOf(error, Error);
          assert.match(error.message, new RegExp(this.statusCode));
          this.scope.done();
        }
      });

      it('should fail with IncomingWebhookRequestError when the API request fails', async function () {
        // One known request error is when the node encounters an ECONNREFUSED. In order to simulate this, rather than
        // using nock, we send the request to a host:port that is not listening.
        const webhook = new IncomingWebhook('https://localhost:8999/api/');
        try {
          await webhook.send('Hello');
          assert.fail();
        } catch (error) {
          assert.instanceOf(error, Error);
          assert.equal(error.code, ErrorCode.RequestError);
          assert.instanceOf(error.original, Error);
        }
      });
    });

    describe('lifecycle', function () {
      it('should not overwrite the default parameters after a call', async function () {
        const defaultParams  = { channel: 'default' };
        const expectedParams = Object.assign({}, defaultParams);
        const webhook        = new IncomingWebhook(url, defaultParams);

        try {
          await webhook.send({ channel: 'different' });
          assert.fail();
        } catch (error) {
          assert.deepEqual(webhook.defaults, expectedParams);
        }
      });
    });
  });

  describe('has an option to set a custom HTTP agent', function () {
    it('should send a request using the custom agent', async function () {
      const agent = new Agent({ keepAlive: true });
      const spy = sinon.spy(agent, 'addRequest');
      const webhook = new IncomingWebhook(url, { agent });

      try {
        await webhook.send('Hello');
        assert.fail();
      } catch (error) {
        agent.addRequest.restore();
        agent.destroy();
        assert(spy.called);
      }
    });
  });

  afterEach(function () {
    nock.cleanAll();
  });
});
