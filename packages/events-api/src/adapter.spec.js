require('mocha');
const EventEmitter = require('events');
const http = require('http');
const { assert } = require('chai');
const sinon = require('sinon');
const getRandomPort = require('get-random-port');

const { createStreamRequest } = require('../test/helpers');
const { SlackEventAdapter } = require('./adapter');

// fixtures and test helpers
const workingSigningSecret = 'SIGNING_SECRET';

describe('SlackEventAdapter', () => {
  describe('constructor', () => {
    it('should be an EventEmitter subclass', () => {
      const adapter = new SlackEventAdapter(workingSigningSecret);
      assert(adapter instanceof EventEmitter);
    });
    it('should fail without a signing secret', () => {
      assert.throws(() => {
        const adapter = new SlackEventAdapter();
      }, TypeError);
    });
    it('should store the signing secret', () => {
      const adapter = new SlackEventAdapter(workingSigningSecret);
      assert.equal(adapter.signingSecret, workingSigningSecret);
    });
  });

  describe('#createServer()', () => {
    let adapter;

    beforeEach(() => {
      adapter = new SlackEventAdapter(workingSigningSecret);
    });

    it('should return a Promise of an http.Server', () => {
      return adapter.createServer().then((server) => {
        assert.instanceOf(server, http.Server);
      });
    });
  });

  describe('#start()', () => {
    let adapter;
    let portNumber;

    beforeEach((done) => {
      adapter = new SlackEventAdapter(workingSigningSecret);
      getRandomPort((error, port) => {
        if (error) return done(error);
        portNumber = port;
        return done();
      });
    });

    afterEach(() => {
      return adapter.stop().catch();
    });

    it('should return a Promise for a started http.Server', () => {
      return adapter.start(portNumber).then((server) => {
        // only works in node >= 5.7.0
        // assert(server.listening);
        assert(server instanceof http.Server);
        assert.equal(server.address().port, portNumber);
      });
    });
  });

  describe('#expressMiddleware()', () => {
    let adapter;
    let emit;
    let next;
    let res;

    beforeEach(() => {
      adapter = new SlackEventAdapter(workingSigningSecret);
      emit = sinon.stub();
      adapter.emit = emit;
      next = sinon.stub();
      res = sinon.stub({
        setHeader: () => { },
        end: () => { },
      });
    });

    it('should return a function', () => {
      const middleware = adapter.expressMiddleware();
      assert.isFunction(middleware);
    });

    it('should emit on the adapter', (done) => {
      const middleware = adapter.expressMiddleware();
      const ts = Math.floor(Date.now() / 1000);
      const eventName = 'eventName';
      const event = {
        type: eventName,
        key: 'value',
      };
      const rawReq = {
        body: {
          event,
        },
      };
      const req = createStreamRequest(workingSigningSecret, ts, JSON.stringify(rawReq.body));
      emit.callsFake((arg1, arg2) => {
        assert.equal(eventName, arg1);
        assert.deepEqual(event, arg2);
        done();
      });
      middleware(req, res, () => {
        assert(false);
        done(new Error());
      });
    });
  });

  describe('#requestListener()', () => {
    let adapter;

    beforeEach(() => {
      adapter = new SlackEventAdapter(workingSigningSecret);
    });

    it('should return a function', () => {
      const requestListener = adapter.requestListener();
      assert.isFunction(requestListener);
    });
  });
});
