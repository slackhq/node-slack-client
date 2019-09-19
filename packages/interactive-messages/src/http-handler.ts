import { ServerResponse, IncomingHttpHeaders, IncomingMessage } from 'http';
import * as querystring from 'querystring';
import debugFactory from 'debug';
import getRawBody from 'raw-body';
import crypto from 'crypto';
import timingSafeCompare from 'tsscmp';
// eslint-disable-next-line import/no-named-as-default
import SlackMessageAdapter from './adapter';
import { ErrorCode, errorWithCode } from './errors';
import { packageIdentifier, isFalsy } from './util';

const debug = debugFactory('@slack/interactive-messages:http-handler');

/**
 * Creates a HTTP handler for a given adapter
 * @param adapter adapter to handle
 */
export function createHTTPHandler(adapter: SlackMessageAdapter): HTTPHandler {
  const poweredBy = packageIdentifier();

  /**
   * Handles sending responses
   *
   * @param res - Response object
   * @returns Returns a function used to send response
   */
  function sendResponse(res: ServerResponse): ResponseHandler {
    return ({ status, content }) => {
      res.statusCode = status;
      res.setHeader('X-Slack-Powered-By', poweredBy);
      if (typeof content === 'string') {
        res.end(content);
      } else if (!isFalsy(content)) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(content));
      } else {
        res.end();
      }
    };
  }

  /**
   * Parses raw bodies of requests
   *
   * @param body - Raw body of request
   * @returns Parsed body of the request
   */
  function parseBody(body: string): any {
    const parsedBody = querystring.parse(body);
    if (!isFalsy(parsedBody.payload)) {
      return JSON.parse(parsedBody.payload as string);
    }

    return parsedBody;
  }

  /**
   * Method to verify signature of requests
   *
   * @param signingSecret - Signing secret used to verify request signature
   * @param requestHeaders - The signing headers. If `req` is an incoming request, then this should be `req.headers`.
   * @param body - Raw body string
   * @returns Indicates if request is verified
   */
  function verifyRequestSignature(
    signingSecret: string,
    requestHeaders: VerificationHeaders,
    body: string,
  ): boolean {
    // Request signature
    const signature = requestHeaders['x-slack-signature'];
    // Request timestamp
    const ts = parseInt(requestHeaders['x-slack-request-timestamp'], 10);

    // Divide current date to match Slack ts format
    // Subtract 5 minutes from current time
    const fiveMinutesAgo = Math.floor(Date.now() / 1000) - (60 * 5);

    if (ts < fiveMinutesAgo) {
      debug('request is older than 5 minutes');
      throw errorWithCode(new Error('Slack request signing verification outdated'), ErrorCode.RequestTimeFailure);
    }

    const hmac = crypto.createHmac('sha256', signingSecret);
    const [version, hash] = signature.split('=');
    hmac.update(`${version}:${ts}:${body}`);

    if (!timingSafeCompare(hash, hmac.digest('hex'))) {
      debug('request signature is not valid');
      throw errorWithCode(
        new Error('Slack request signing verification failed'),
        ErrorCode.SignatureVerificationFailure,
      );
    }

    debug('request signing verification success');
    return true;
  }

  /**
   * Request listener used to handle Slack requests and send responses and
   * verify request signatures
   * @param req request received
   * @param res response being sent
   */
  return (req, res) => {
    debug('request received - method: %s, path: %s', req.method, req.url);
    // Function used to send response
    const respond = sendResponse(res);

    // If parser is being used and we don't receive the raw payload via `rawBody`,
    // we can't verify request signature
    if (!isFalsy(req.body) && isFalsy(req.rawBody)) {
      respond({
        status: 500,
        content: process.env.NODE_ENV === 'development' ?
          'Parsing request body prohibits request signature verification' : undefined,
      });
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

        if (verifyRequestSignature(adapter.signingSecret, req.headers as VerificationHeaders, rawBody)) {
          // Request signature is verified
          // Parse raw body
          const body = parseBody(rawBody);

          if (body.ssl_check) {
            respond({ status: 200 });
            return;
          }

          const dispatchResult = adapter.dispatch(body);

          if (dispatchResult !== undefined) {
            // TODO: handle this after responding?
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            dispatchResult.then(respond);
          } else {
            // No callback was matched
            debug('no callback was matched');
            respond({ status: 404 });
          }
        }
      }).catch((error) => {
        if (error.code === ErrorCode.SignatureVerificationFailure || error.code === ErrorCode.RequestTimeFailure) {
          respond({ status: 404 });
        } else if (process.env.NODE_ENV === 'development') {
          respond({ status: 500, content: error.message });
        } else {
          respond({ status: 500 });
        }
      });
  };
}

/**
 * A RequestListener-compatible callback for creating response information from an incoming request.
 *
 * See RequestListener in the `http` module.
 */
type HTTPHandler = (req: IncomingMessage & { body?: any; rawBody?: Buffer }, res: ServerResponse) => void;

/**
 * A response handler returned by `sendResponse`.
 */
type ResponseHandler = (dispatchResult: {
  status: number;
  content?: string | object;
}) => void;

/**
 * Headers required for verification.
 *
 * See: https://api.slack.com/docs/verifying-requests-from-slack
 */
export interface VerificationHeaders extends IncomingHttpHeaders {
  'x-slack-signature': string;
  'x-slack-request-timestamp': string;
}
