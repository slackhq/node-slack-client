import * as os from 'os';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJson = require('../package.json');

/**
 * Replaces occurrences of '/' with ':' in a string, since '/' is meaningful inside User-Agent strings as a separator.
 * @param s string to replace contents of
 */
function replaceSlashes(s: string): string {
  return s.replace('/', ':');
}

const baseUserAgent = `${replaceSlashes(packageJson.name)}/${packageJson.version} ` +
                      `node/${process.version.replace('v', '')} ` +
                      `${os.platform()}/${os.release()}`;

const appMetadata: { [key: string]: string } = {};

/**
 * Appends the app metadata into the User-Agent value
 * @param appMetadata metadata to append
 * @param appMetadata.name name of tool to be counted in instrumentation
 * @param appMetadata.version version of tool to be counted in instrumentation
 */
export function addAppMetadata({ name, version }: { name: string; version: string }): void {
  appMetadata[replaceSlashes(name)] = version;
}

/**
 * Returns the current User-Agent value for instrumentation
 */
export function getUserAgent(): string {
  const appIdentifier = Object.entries(appMetadata).map(([name, version]) => `${name}/${version}`).join(' ');
  // only prepend the appIdentifier when its not empty
  return ((appIdentifier.length > 0) ? `${appIdentifier} ` : '') + baseUserAgent;
}
