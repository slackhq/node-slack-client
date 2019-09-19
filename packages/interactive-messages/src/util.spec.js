const { assert } = require('chai');
const { promiseTimeout, errorCodes } = require('./util');
const { delayed } = require('../test/helpers');

// test suite
describe('promiseTimeout', () => {
  it('should resolve to input promise value when input resolves faster than timeout', () => {
    const value = 'test';
    const input = delayed(10, value);
    const output = promiseTimeout(20, input);
    return output.then((v) => {
      assert.equal(v, value);
    });
  });

  it('should reject with error code when input resolves slower than timeout', () => {
    const input = delayed(20, 'test');
    const output = promiseTimeout(10, input);
    return output.then((value) => {
      throw new Error(`should not resolve. value: ${value}`);
    }, (error) => {
      assert.equal(error.code, errorCodes.PROMISE_TIMEOUT);
    });
  });

  it('should reject to input error when input rejects faster than timeout', () => {
    const reason = 'test';
    const input = delayed(10, undefined, reason);
    const output = promiseTimeout(20, input);
    return output.then((value) => {
      throw new Error(`should not resolve. value: ${value}`);
    }, (error) => {
      assert.equal(error.message, reason);
    });
  });

  it('should reject with error code when input rejects slower than timeout', () => {
    const reason = 'test';
    const input = delayed(20, undefined, reason);
    const output = promiseTimeout(10, input);
    return output.then((value) => {
      throw new Error(`should not resolve. value: ${value}`);
    }, (error) => {
      assert.equal(error.code, errorCodes.PROMISE_TIMEOUT);
    });
  });
});
