/**
 * A dictionary of codes for errors produced by this package.
 */
export enum ErrorCode {
  PromiseTimeout = 'SLACKMESSAGEUTIL_PROMISE_TIMEOUT',
  SignatureVerificationFailure = 'SLACKHTTPHANDLER_REQUEST_SIGNATURE_VERIFICATION_FAILURE',
  RequestTimeFailure = 'SLACKHTTPHANDLER_REQUEST_TIMELIMIT_FAILURE',
  BodyParserNotPermitted = 'SLACKADAPTER_BODY_PARSER_NOT_PERMITTED_FAILURE',
}

/**
 * All errors produced by this package are regular
 * {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error | Error} objects with
 * an extra {@link CodedError.code | `error`} field.
 */
export interface CodedError extends Error {
  /**
   * What kind of error occurred.
   */
  code: ErrorCode;
}

/**
 * Factory for producing a {@link CodedError} from a generic error.
 * @param error error to extend
 * @param code error code to append
 */
export function errorWithCode(error: Error, code: ErrorCode): CodedError {
  const codedError = error as CodedError;
  codedError.code = code;
  return codedError;
}
