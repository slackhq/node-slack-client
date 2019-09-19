import { Options } from 'p-retry';

/**
 * Options to create retry policies. Extends from https://github.com/tim-kos/node-retry.
 */
export type RetryOptions = Options;

/**
 * The default retry policy. Retry up to 10 times, over the span of about 30 minutes. It's not exact because
 * randomization has been added to prevent a stampeding herd problem (if all instances in your application are retrying
 * a request at the exact same intervals, they are more likely to cause failures for each other).
 */
export const tenRetriesInAboutThirtyMinutes: RetryOptions = {
  retries: 10,
  factor: 1.96821,
  randomize: true,
};

/**
 * Short & sweet, five retries in five minutes and then bail.
 */
export const fiveRetriesInFiveMinutes: RetryOptions = {
  retries: 5,
  factor: 3.86,
};

/**
 * This policy is just to keep the tests running fast.
 */
export const rapidRetryPolicy: RetryOptions = {
  minTimeout: 0,
  maxTimeout: 1,
};

const policies = {
  tenRetriesInAboutThirtyMinutes,
  fiveRetriesInFiveMinutes,
  rapidRetryPolicy,
};

export default policies;
