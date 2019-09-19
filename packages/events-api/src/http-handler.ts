import debugFactory from 'debug';
import getRawBody from 'raw-body';
import crypto from 'crypto';
import timingSafeCompare from 'tsscmp';
import { IncomingMessage, ServerResponse } from 'http';
import { packageIdentifier, isFalsy } from './util';
// eslint-disable-next-line import/no-named-as-default
import SlackEventAdapter from './adapter';

const debug = debugFactory('@slack/events-api:http-handler');

/**
 * Verifies the signature of a request.
 *
 * See [Verifying requests from Slack](https://api.slack.com/docs/verifying-requests-from-slack#sdk_support) for more
 * information.
 *
 * @param params - See {@link VerifyRequestSignatureParams}.
 * @returns `true` when the signature is valid.
 * @throws {CodedError} - Signature is invalid.
 */
export function verifyRequestSignature({
  signingSecret, requestSignature, requestTimestamp, body,
}: VerifyRequestSignatureParams): true {
  // convert the current time to seconds (to match the API's `ts` format), then subtract 5 minutes' worth of seconds.
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - (60 * 5);

  if (requestTimestamp < fiveMinutesAgo) {
    debug('request is older than 5 minutes');
    throw errorWithCode(new Error('Slack request signing verification outdated'), ErrorCode.RequestTimeFailure);
  }

  const hmac = crypto.createHmac('sha256', signingSecret);
  const [version, hash] = requestSignature.split('=');
  hmac.update(`${version}:${requestTimestamp}:${body}`);

  if (!timingSafeCompare(hash, hmac.digest('hex'))) {
    debug('request signature is not valid');
    throw errorWithCode(new Error('Slack request signing verification failed'), ErrorCode.SignatureVerificationFailure);
  }

  debug('request signing verification success');
  return true;
}

/**
 * Creates a HTTP handler for a slack adapter
 * @param adapter slack adapter to wrap
 */
export function createHTTPHandler(adapter: SlackEventAdapter): HTTPHandler {
  const poweredBy = packageIdentifier();

  /**
   * Binds a response handler to the given response.
   *
   * @param res - The response object.
   * @returns The responder funciton bound to the input response.
   */
  function sendResponse(res: ServerResponse): ResponseHandler {
    // This function is the completion handler for sending a response to an event. It can either
    // be invoked by automatically or by the user (when using the `waitForResponse` option).
    return (err, responseOptions) => {
      debug('sending response - error: %s, responseOptions: %o', err, responseOptions);
      // Deal with errors up front
      if (!isFalsy(err)) {
        if ('status' in err && typeof err.status === 'number') {
          res.statusCode = err.status;
        } else if (
          (err as CodedError).code === ErrorCode.SignatureVerificationFailure ||
          (err as CodedError).code === ErrorCode.RequestTimeFailure
        ) {
          res.statusCode = ResponseStatus.NotFound;
        } else {
          res.statusCode = ResponseStatus.Failure;
        }
      } else {
        // First determine the response status
        if (!isFalsy(responseOptions)) {
          if (responseOptions.failWithNoRetry) {
            res.statusCode = ResponseStatus.Failure;
          } else if (responseOptions.redirectLocation) {
            res.statusCode = ResponseStatus.Redirect;
          } else {
            // URL Verification
            res.statusCode = ResponseStatus.Ok;
          }
        } else {
          res.statusCode = ResponseStatus.Ok;
        }

        // Next determine the response headers
        if (!isFalsy(responseOptions) && responseOptions.failWithNoRetry) {
          res.setHeader('X-Slack-No-Retry', '1');
        }
        res.setHeader('X-Slack-Powered-By', poweredBy);
      }

      // Lastly, send the response
      if (!isFalsy(responseOptions) && responseOptions.content) {
        res.end(responseOptions.content);
      } else {
        res.end();
      }
    };
  }

  /**
   * Handles making responses for errors.
   *
   * @param error - The error that occurred.
   * @param respond - The {@link ResponseHandler | response handler}.
   */
  function handleError(error: CodedError, respond: ResponseHandler): void {
    debug('handling error - message: %s, code: %s', error.message, error.code);
    try {
      if (adapter.waitForResponse) {
        adapter.emit('error', error, respond);
      } else if (process.env.NODE_ENV === 'development') {
        adapter.emit('error', error);
        // eslint-disable-next-line @typescript-eslint/no-object-literal-type-assertion
        respond({ status: ResponseStatus.Failure } as ResponseError, { content: error.message });
      } else {
        adapter.emit('error', error);
        respond(error);
      }
    } catch (userError) {
      process.nextTick(() => { throw userError; });
    }
  }

  /**
   * Request listener used to handle Slack requests and send responses and
   * verify request signatures
   *
   * @param req - The incoming request.
   * @param res - The outgoing response.
   */
  return (req, res) => {
    debug('request recieved - method: %s, path: %s', req.method, req.url);

    // Bind a response function to this request's respond object.
    const respond = sendResponse(res);

    // If parser is being used and we don't receive the raw payload via `rawBody`,
    // we can't verify request signature
    if (!isFalsy(req.body) && isFalsy(req.rawBody)) {
      handleError(
        errorWithCode(
          new Error('Parsing request body prohibits request signature verification'),
          ErrorCode.BodyParserNotPermitted,
        ),
        respond,
      );
      return;
    }

    // Some serverless cloud providers (e.g. Google Firebase Cloud Functions) might populate
    // the request with a bodyparser before it can be populated by the SDK.
    // To prevent throwing an error here, we check the `rawBody` field before parsing the request
    // through the `raw-body` module (see Issue #85 - https://github.com/slackapi/node-slack-events-api/issues/85)
    let parseRawBody: Promise<Buffer>;
    if (!isFalsy(req.rawBody)) {
      debug('Parsing request with a rawBody attribute');
      parseRawBody = Promise.resolve(req.rawBody);
    } else {
      debug('Parsing raw request');
      parseRawBody = getRawBody(req);
    }

    parseRawBody
      .then((bodyBuf) => {
        const rawBody = bodyBuf.toString();
        if (verifyRequestSignature({
          signingSecret: adapter.signingSecret,
          requestSignature: req.headers['x-slack-signature'] as string,
          requestTimestamp: parseInt(req.headers['x-slack-request-timestamp'] as string, 10),
          body: rawBody,
        })) {
          // Request signature is verified
          // Parse raw body
          const body = JSON.parse(rawBody);

          // Handle URL verification challenge
          if (body.type === 'url_verification') {
            debug('handling url verification');
            respond(undefined, { content: body.challenge });
            return;
          }

          const emitArguments = [body.event];
          if (adapter.includeBody) {
            emitArguments.push(body);
          }
          if (adapter.includeHeaders) {
            emitArguments.push(req.headers);
          }
          if (adapter.waitForResponse) {
            emitArguments.push(respond);
          } else {
            respond();
          }

          debug('emitting event -  type: %s, arguments: %o', body.event.type, emitArguments);
          adapter.emit(body.event.type, ...emitArguments);
        }
      }).catch((error) => {
        handleError(error, respond);
      });
  };
}

/** Some HTTP response statuses. */
enum ResponseStatus {
  Ok = 200,
  Redirect = 302,
  NotFound = 404,
  Failure = 500,
}

/**
 * A RequestListener-compatible callback for creating response information from an incoming request.
 *
 * See RequestListener in the `http` module.
 */
export type HTTPHandler = (req: IncomingMessage & { body?: any; rawBody?: Buffer }, res: ServerResponse) => void;

/**
 * A Node-style response handler that takes an error (if any occurred) and a few response-related options.
 */
export type ResponseHandler = (err?: ResponseError, responseOptions?: {
  failWithNoRetry?: boolean;
  redirectLocation?: boolean;
  content?: any;
}) => void;

/**
 * An error (that may or may not have a status code) in response to a request.
 */
export interface ResponseError extends Error {
  status?: number;
}

/**
 * Parameters for calling {@link verifyRequestSignature}.
 */
export interface VerifyRequestSignatureParams {
  /**
   * The signing secret used to verify request signature.
   */
  signingSecret: string;

  /**
   * Signature from the `X-Slack-Signature` header.
   */
  requestSignature: string;

  /**
   * Timestamp from the `X-Slack-Request-Timestamp` header.
   */
  requestTimestamp: number;

  /**
   * Full, raw body string.
   */
  body: string;
}

/**
 * A dictionary of codes for errors produced by this package.
 */
export enum ErrorCode {
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
 * @param error error to inherit
 * @param code error code to append
 */
function errorWithCode(error: Error, code: ErrorCode): CodedError {
  const codedError = error as CodedError;
  codedError.code = code;
  return codedError;
}

// legacy export
export const errorCodes = {
  SIGNATURE_VERIFICATION_FAILURE: ErrorCode.SignatureVerificationFailure,
  REQUEST_TIME_FAILURE: ErrorCode.RequestTimeFailure,
  BODY_PARSER_NOT_PERMITTED: ErrorCode.BodyParserNotPermitted,
};
