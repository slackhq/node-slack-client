import { WebClient, WebAPICallResult } from '@slack/web-api';

const web = new WebClient();

/* Testing the return type of WebClient#paginate() */

/**
 * SO. For all intents and purposes, this thing below is just an AsyncIterator. That's what it's meant to be. "So why
 * not just put `AsyncIterator`," you ask. Good question. Let me tell you a tale:
 *
 * In the year 2019, all was happy, all was cheerful. These integration tests $ExpectedType AsyncIterator and this
 * redundant interface was naught. Birds chirped with glee. Children played in the fields. Not a thing in the world
 * could possibly go wrong.
 *
 * Then something went wrong. From each cardinal direction a storm approached. Its winds ripped trees from their roots
 * and separated hatchlings from their mothers. Mercilessly, the storm tore apart the meadow and everything it
 * supported.
 *
 * This storm has not been forgotten. We keep its bittersweet memory in our hearts. Some cower at the foul beast's name:
 * `typescript@3.6.0-dev.20190703`.
 *
 * For, you see, this was not your average storm. No, this storm approached instead as something to be celebrated. It
 * boasted updated generator types and it advertised comfortable iterator ergonomics. Alas, in hindsight this was but a
 * mirage--a trojan horse, even--masquerading the terror that followed. It knocked with its weapon upfront: no longer
 * was it `AsyncIterator<T>`, but rather `AsyncIterator<T, TReturn = any, TNext = undefined>`.
 *
 * It struck right at the edge: the integration tests. For, you see, their foundation is dtslint, which (at the time of
 * the storm) tests against each minor release of TypeScript from 2.0 all the way to `typescript@next`. Whilst usage
 * remain unaffected, the same could not be said of our types integration tests. These tests now failed, for their
 * single generic argument was unequal to the three dtslint expected.
 *
 * Our most trustworthy guard, Travis (CI), attempted to warn us of the dangerous storm, but by the time the message
 * reached us the damage was done. Builds were failing. PRs reported failures. Builds were a sea of red ✗'s (read: a sea
 * of blood).
 *
 * This is why we've enacted this memorial: the __DangerouslyOutmodedAsyncIteratorSignatureWrapper. Its purpose is not
 * only to remember the sorrows of past maintiners, but to also appease the storm by wrapping `AsyncIterator` in a new
 * type that is fully equivalent, yet named different under `$ExpectType` (that is, the same across TypeScript
 * versions).
 *
 *  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -
 *
 * Just as there is a calm before the storm, there must also be one after.
 *
 * We dream of a day where dtslint only runs a specific range of supported versions. We dream of a day where dtslint can
 * see the equality of an expected type without explicit defaults and the type with its defaults filled in[1]. We dream
 * of a future after the storm.
 *
 * Once we reach that future, this memorial will have served its purpose[2]. It will be safe to remove in that future we
 * dream of.
 *
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 *
 * [1]: That is, `AsyncIterator<T>` is equal to `AsyncIterator<T, any, undefined>` because the defaults cause them to
 *      become equal.
 * [2]: This interface is no longer needed once TypeScript 3.6 or higher is the supported range, or once dtslint can
 *      better compare type assertions.
 *
 * For more information, search the history books for PR #836.
 */
interface __DangerouslyOutmodedAsyncIteratorSignatureWrapper<T> extends AsyncIterator<T> {
  // same as AsyncIterator<T>.
}

// $ExpectType __DangerouslyOutmodedAsyncIteratorSignatureWrapper<WebAPICallResult>
web.paginate('conversations.list') as __DangerouslyOutmodedAsyncIteratorSignatureWrapper<WebAPICallResult>;

// $ExpectType __DangerouslyOutmodedAsyncIteratorSignatureWrapper<WebAPICallResult>
web.paginate('conversations.list', {}) as __DangerouslyOutmodedAsyncIteratorSignatureWrapper<WebAPICallResult>;

// $ExpectType Promise<void>
web.paginate('conversations.list', {}, () => false);

// $ExpectError
web.paginate('conversations.list', {}, () => 7);

// $ExpectType Promise<number>
web.paginate('conversations.list', {}, () => false, () => 5);

// When there's no shouldStop predicate given but there is a reducer, the behavior is undefined.
// (However in the current implementation, the return value is AsyncIterator<WebAPICallResult>)
// $ExpectError
web.paginate('conversations.list', {}, undefined, () => 5);

/* Testing the arguments of the shouldStop param */

web.paginate('conversations.list', {}, (page) => {
  // $ExpectType WebAPICallResult
  page;
  return false;
});

/* Testing the arguments of the reduce param */

// Dummy type to make sure the generic param is bound properly
interface Dummy { t: 'dummy'; }
const d: Dummy = { t: 'dummy' };

// Ideally, we would get all the same expected types even when accumulator was not explicitly typed (only the return
// value of reduce having a known type).
// $ExpectType Promise<Dummy>
web.paginate('conversations.list', {}, () => false, (accumulator: Dummy | undefined, page, pageNumber) => {
  // $ExpectType Dummy | undefined
  accumulator;
  // $ExpectType WebAPICallResult
  page;
  // $ExpectType number
  pageNumber;

  return d;
});
