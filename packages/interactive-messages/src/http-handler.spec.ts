import { assert } from 'chai';
import * as sinon from 'sinon';
import { RequestListener, ServerResponse } from 'http';
import { createRequest, createRawBodyRequest } from './test-helpers';

import proxyquire = require('proxyquire');

const getRawBodyStub = sinon.stub();
const { createHTTPHandler } = proxyquire('./http-handler', {
  'raw-body': getRawBodyStub,
});

const correctRawBody = 'payload=%7B%22type%22%3A%22interactive_message%22%7D';
const correctSigningSecret = 'SIGNING_SECRET';

describe('createHTTPHandler', () => {
  let dispatch: sinon.SinonStub;
  let res: sinon.SinonStubbedInstance<any>;
  let correctDate: number;
  let requestListener: RequestListener;

  beforeEach(() => {
    dispatch = sinon.stub();
    res = sinon.stub({
      setHeader() { },
      send() { },
      end() { },
    });
    correctDate = Math.floor(Date.now() / 1000);
    requestListener = createHTTPHandler({
      signingSecret: correctSigningSecret,
      dispatch,
    });
  });

  it('should verify a correct signing secret', (done) => {
    const date = Math.floor(Date.now() / 1000);
    const req = createRequest(correctSigningSecret, date, correctRawBody);
    dispatch.resolves({ status: 200 });
    getRawBodyStub.resolves(Buffer.from(correctRawBody));
    res.end.callsFake(() => {
      assert(dispatch.called);
      assert.equal((res as unknown as ServerResponse).statusCode, 200);
      done();
    });
    requestListener(req, (res as unknown as ServerResponse));
  });

  it('should verify a correct signing secret for a request with rawBody attribute', (done) => {
    const req = createRawBodyRequest(correctSigningSecret, correctDate, correctRawBody);
    dispatch.resolves({ status: 200 });
    getRawBodyStub.resolves(Buffer.from(correctRawBody));
    res.end.callsFake(() => {
      assert.equal(res.statusCode, 200);
      done();
    });
    requestListener(req, (res as unknown as ServerResponse));
  });

  it('should fail request signing verification for a request with a body but no rawBody', (done) => {
    const req = createRequest(correctSigningSecret, correctDate, correctRawBody);
    getRawBodyStub.resolves(Buffer.from(correctRawBody));
    res.end.callsFake(() => {
      assert.equal(res.statusCode, 500);
      done();
    });
    requestListener(req, (res as unknown as ServerResponse));
  });

  it('should fail request signing verification with an incorrect signing secret', (done) => {
    const req = createRequest('INVALID_SECRET', correctDate, correctRawBody);
    getRawBodyStub.resolves(Buffer.from(correctRawBody));
    res.end.callsFake(() => {
      assert(dispatch.notCalled);
      assert.equal((res as unknown as ServerResponse).statusCode, 404);
      done();
    });
    requestListener(req, (res as unknown as ServerResponse));
  });

  it('should fail request signing verification with old timestamp', (done) => {
    const sixMinutesAgo = Math.floor(Date.now() / 1000) - (60 * 6);
    const req = createRequest(correctSigningSecret, sixMinutesAgo, correctRawBody);
    dispatch.resolves({ status: 200 });
    getRawBodyStub.resolves(Buffer.from(correctRawBody));
    res.end.callsFake(() => {
      assert(dispatch.notCalled);
      assert.equal((res as unknown as ServerResponse).statusCode, 404);
      done();
    });
    requestListener(req, (res as unknown as ServerResponse));
  });

  it('should handle unexpected error', (done) => {
    const req = createRequest(correctSigningSecret, correctDate, correctRawBody);
    getRawBodyStub.rejects(new Error('test error'));
    res.end.callsFake((result?: string) => {
      assert.equal((res as unknown as ServerResponse).statusCode, 500);
      assert.isUndefined(result);
      done();
    });
    requestListener(req, (res as unknown as ServerResponse));
  });

  it('should provide message with unexpected errors in development', (done) => {
    const req = createRequest(correctSigningSecret, correctDate, correctRawBody);
    process.env.NODE_ENV = 'development';
    getRawBodyStub.rejects(new Error('test error'));
    res.end.callsFake((result?: string) => {
      assert.equal((res as unknown as ServerResponse).statusCode, 500);
      assert.equal(result, 'test error');
      delete process.env.NODE_ENV;
      done();
    });
    requestListener(req, (res as unknown as ServerResponse));
  });

  it('should handle no callback', (done) => {
    const req = createRequest(correctSigningSecret, correctDate, correctRawBody);
    dispatch.returns(undefined);
    getRawBodyStub.resolves(Buffer.from(correctRawBody));
    res.end.callsFake(() => {
      assert.equal((res as unknown as ServerResponse).statusCode, 404);
      done();
    });
    requestListener(req, (res as unknown as ServerResponse));
  });

  it('should set an identification header in its responses', (done) => {
    const req = createRequest(correctSigningSecret, correctDate, correctRawBody);
    dispatch.resolves({ status: 200 });
    getRawBodyStub.resolves(Buffer.from(correctRawBody));
    res.end.callsFake(() => {
      assert(res.setHeader.calledWith('X-Slack-Powered-By'));
      done();
    });
    requestListener(req, (res as unknown as ServerResponse));
  });

  it('should respond to ssl check requests', (done) => {
    const sslRawBody = 'payload=%7B%22ssl_check%22%3A%221%22%7D';
    const req = createRequest(correctSigningSecret, correctDate, sslRawBody);
    getRawBodyStub.resolves(Buffer.from(sslRawBody));
    res.end.callsFake(() => {
      assert(dispatch.notCalled);
      assert.equal((res as unknown as ServerResponse).statusCode, 200);
      done();
    });
    requestListener(req, (res as unknown as ServerResponse));
  });

  describe('handling dispatch results', () => {
    it('should serialize objects in the content key as JSON', (done) => {
      const req = createRequest(correctSigningSecret, correctDate, correctRawBody);
      const content = {
        abc: 'def',
        ghi: true,
        jkl: ['m', 'n', 'o'],
        p: 5,
      };
      dispatch.resolves({ status: 200, content });
      getRawBodyStub.resolves(Buffer.from(correctRawBody));
      res.end.callsFake((json?: string) => {
        assert(dispatch.called);
        assert.equal((res as unknown as ServerResponse).statusCode, 200);
        assert(res.setHeader.calledWith('Content-Type', 'application/json'));
        assert.deepEqual(json, JSON.stringify(content));
        done();
      });
      requestListener(req, (res as unknown as ServerResponse));
    });

    it('should handle an undefined content key as no body', (done) => {
      const req = createRequest(correctSigningSecret, correctDate, correctRawBody);
      dispatch.resolves({ status: 500 });
      getRawBodyStub.resolves(Buffer.from(correctRawBody));
      res.end.callsFake((body?: string) => {
        assert(dispatch.called);
        assert.isUndefined(body);
        assert.equal((res as unknown as ServerResponse).statusCode, 500);
        done();
      });
      requestListener(req, (res as unknown as ServerResponse));
    });

    it('should handle a string content key as the literal body', (done) => {
      const req = createRequest(correctSigningSecret, correctDate, correctRawBody);
      const content = 'hello, world';
      dispatch.resolves({ status: 200, content });
      getRawBodyStub.resolves(Buffer.from(correctRawBody));
      res.end.callsFake((body?: string) => {
        assert(dispatch.called);
        assert.equal((res as unknown as ServerResponse).statusCode, 200);
        assert.deepEqual(body, content);
        done();
      });
      requestListener(req, (res as unknown as ServerResponse));
    });
  });
});
