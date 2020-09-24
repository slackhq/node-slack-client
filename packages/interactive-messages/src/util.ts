import os from 'os';
import { ErrorCode, errorWithCode } from './errors';

const pkg = require('../package.json'); // eslint-disable-line

function escape(s: string): string {
  return s.replace('/', ':').replace(' ', '_');
}

export const errorCodes = {
  PROMISE_TIMEOUT: ErrorCode.PromiseTimeout,
};

/**
 * Creates a timeout on a promise.
 *
 * @param ms - The timeout duration.
 * @param promise - The promise that will timeout.
 */
export function promiseTimeout<T>(ms: number, promise: T | Promise<T>): Promise<T> {
  // Create a promise that rejects in `ms` milliseconds
  const timeout = new Promise<never>((_resolve, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      reject(errorWithCode(new Error('Promise timed out'), ErrorCode.PromiseTimeout));
    }, ms);
  });

  // Race between our timeout and the passed in `promise`
  return Promise.race([promise as Promise<T>, timeout]);
}

// NOTE: before this can be an external module:
// 1. are all the JS features supported back to a reasonable version?
//    default params, template strings, computed property names
// 2. access to `pkg` will change
// 3. tests
// there will potentially be more named exports in this file
export function packageIdentifier(addons: Record<string, string> = {}): string {
  const identifierMap = {
    [pkg.name]: pkg.version,
    [os.platform()]: os.release(),
    node: process.version.replace('v', ''),
    ...addons,
  };
  return Object.keys(identifierMap).reduce((acc, k) => `${acc} ${escape(k)}/${escape(identifierMap[k])}`, '');
}

/**
 * Tests a "thing" for being falsy. See: https://developer.mozilla.org/en-US/docs/Glossary/Falsy
 *
 * @param x - The "thing" whose falsy-ness to test.
 */
export function isFalsy(x: any): x is 0 | '' | null | undefined {
  // NOTE: there's no way to type `x is NaN` currently (as of TypeScript v3.5)
  return x === 0 || x === '' || x === null || x === undefined || (typeof x === 'number' && isNaN(x));
}
