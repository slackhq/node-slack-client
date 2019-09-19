import { ErrorCode as WebAPIErrorCode } from '@slack/web-api';
import { ErrorCode as RTMAPIErrorCode } from '@slack/rtm-api';
import { ErrorCode as WebhookErrorCode } from '@slack/webhook';

export {
  Logger,
  LogLevel,
} from '@slack/logger';

// Using a wildcard (*) export because listing each individual method is cumbersome and hard to keep up to date.
// The following export contains:
// addAppMetadata,
// TLSOptions,
// retryPolicies,
// RetryOptions,
// WebClient,
// WebClientOptions,
// WebAPICallOptions,
// WebAPICallResult,
// WebAPIPlatformError,
// WebAPIRequestError,
// WebAPIHTTPError,
// WebAPIRateLimitedError,
// WebAPICallError,
// WebClientEvent,
// and all method definitions
export * from '@slack/web-api';
export { ErrorCode as WebAPIErrorCode } from '@slack/web-api';

export {
  RTMClient,
  RTMClientOptions,
  RTMStartOptions,
  RTMCallResult,
  RTMPlatformError,
  RTMWebsocketError,
  RTMCallError,
  RTMNoReplyReceivedError,
  RTMSendWhileDisconnectedError,
  RTMSendWhileNotReadyError,
} from '@slack/rtm-api';
export { ErrorCode as RTMAPIErrorCode } from '@slack/rtm-api';

export {
  IncomingWebhook,
  IncomingWebhookSendArguments,
  IncomingWebhookDefaultArguments,
  IncomingWebhookResult,
  IncomingWebhookRequestError,
  IncomingWebhookHTTPError,
  IncomingWebhookSendError,
} from '@slack/webhook';
export { ErrorCode as WebhookErrorCode } from '@slack/webhook';

export * from '@slack/types';

// Merge the two ErrorCode constants into one, to make this as similar to @slack/client@4 as possible
export const ErrorCode = Object.assign({}, WebAPIErrorCode, RTMAPIErrorCode, WebhookErrorCode);
