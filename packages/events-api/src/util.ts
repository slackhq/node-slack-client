import os from 'os';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../package.json');

// TODO: expose an API to extend this
// there will potentially be more named exports in this file
/**
 * Determines the identifier for the current package
 */
export function packageIdentifier(): string {
  return `${pkg.name.replace('/', ':')}/${pkg.version} ${os.platform()}/${os.release()} ` +
    `node/${process.version.replace('v', '')}`;
}

/**
 * Tests a "thing" for being falsy. See: https://developer.mozilla.org/en-US/docs/Glossary/Falsy
 *
 * @param x - The "thing" whose falsy-ness to test.
 */
export function isFalsy(x: any): x is 0 | '' | null | undefined {
  // NOTE: there's no way to type `x is NaN` currently (as of TypeScript v3.5)
  return x === 0 || x === '' || x === null || x === undefined || (typeof x === 'number' && Number.isNaN(x));
}
