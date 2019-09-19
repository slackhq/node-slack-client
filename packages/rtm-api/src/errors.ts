import { RTMCallResult } from './RTMClient';

/**
 * All errors produced by this package adhere to this interface
 */
export interface CodedError extends NodeJS.ErrnoException {
  code: ErrorCode;
}

/**
 * A dictionary of codes for errors produced by this package
 */
export enum ErrorCode {
  SendWhileDisconnectedError = 'slack_rtmapi_send_while_disconnected_error',
  SendWhileNotReadyError = 'slack_rtmapi_send_while_not_ready_error',
  SendMessagePlatformError = 'slack_rtmapi_send_message_platform_error',
  WebsocketError = 'slack_rtmapi_websocket_error',
  NoReplyReceivedError = 'slack_rtmapi_no_reply_received_error',

  // internal errors
  KeepAliveConfigError = 'slack_rtmapi_keepalive_config_error',
  KeepAliveClientNotConnected = 'slack_rtmapi_keepalive_client_not_connected',
  KeepAliveInconsistentState = 'slack_rtmapi_keepalive_inconsistent_state',
}

export type RTMCallError =
  RTMPlatformError | RTMWebsocketError | RTMNoReplyReceivedError
  | RTMSendWhileDisconnectedError | RTMSendWhileNotReadyError;

export interface RTMPlatformError extends CodedError {
  code: ErrorCode.SendMessagePlatformError;
  data: RTMCallResult;
}

export interface RTMWebsocketError extends CodedError {
  code: ErrorCode.WebsocketError;
  original: Error;
}

export interface RTMNoReplyReceivedError extends CodedError {
  code: ErrorCode.NoReplyReceivedError;
}

export interface RTMSendWhileDisconnectedError extends CodedError {
  code: ErrorCode.SendWhileDisconnectedError;
}

export interface RTMSendWhileNotReadyError extends CodedError {
  code: ErrorCode.SendWhileNotReadyError;
}

/**
 * Factory for producing a {@link CodedError} from a generic error
 * @param error error being converted
 * @param code code being appended
 */
function errorWithCode(error: Error, code: ErrorCode): CodedError {
  // NOTE: might be able to return something more specific than a CodedError with conditional typing
  const codedError = error as Partial<CodedError>;
  codedError.code = code;
  return codedError as CodedError;
}

/**
 * A factory to create RTMWebsocketError objects.
 * @param original error being converted
 */
export function websocketErrorWithOriginal(original: Error): RTMWebsocketError {
  const error = errorWithCode(
    new Error(`Failed to send message on websocket: ${original.message}`),
    ErrorCode.WebsocketError,
  ) as Partial<RTMWebsocketError>;
  error.original = original;
  return (error as RTMWebsocketError);
}

/**
 * A factory to create RTMPlatformError objects.
 * @param event event being converted
 */
export function platformErrorFromEvent(event: RTMCallResult & { error: { msg: string } }): RTMPlatformError {
  const error = errorWithCode(
    new Error(`An API error occurred: ${event.error.msg}`),
    ErrorCode.SendMessagePlatformError,
  ) as Partial<RTMPlatformError>;
  error.data = event;
  return (error as RTMPlatformError);
}

/**
 * A factory to create RTMNoReplyReceivedError objects.
 */
export function noReplyReceivedError(): RTMNoReplyReceivedError {
  return errorWithCode(
    new Error('Message sent but no server acknowledgement was received. This may be caused by the client ' +
    'changing connection state rather than any issue with the specific message. Check before resending.'),
    ErrorCode.NoReplyReceivedError,
  ) as RTMNoReplyReceivedError;
}

/**
 * A factory to create RTMSendWhileDisconnectedError objects.
 */
export function sendWhileDisconnectedError(): RTMSendWhileDisconnectedError {
  return errorWithCode(
    new Error('Cannot send message when client is not connected'),
    ErrorCode.NoReplyReceivedError,
  ) as RTMSendWhileDisconnectedError;
}


/**
 * A factory to create RTMSendWhileNotReadyError objects.
 */
export function sendWhileNotReadyError(): RTMSendWhileNotReadyError {
  return errorWithCode(
    new Error('Cannot send message when client is not ready'),
    ErrorCode.NoReplyReceivedError,
  ) as RTMSendWhileNotReadyError;
}
