import EventEmitter from 'events';
import http, { RequestListener } from 'http';
import debugFactory from 'debug';
import isString from 'lodash.isstring';
// eslint-disable-next-line import/no-extraneous-dependencies
import { RequestHandler } from 'express';
import { createHTTPHandler } from './http-handler';
import { isFalsy } from './util';

const debug = debugFactory('@slack/events-api:adapter');

/**
 * An adapter for Slack's Events API.
 */
export class SlackEventAdapter extends EventEmitter {
  /**
   * The token used to authenticate signed requests from Slack's Events API.
   */
  public readonly signingSecret: string;

  /**
   * Whether to include the API event bodies in adapter event listeners.
   */
  public includeBody: boolean;

  /**
   * Whether to include request headers in adapter event listeners.
   */
  public includeHeaders: boolean;

  /**
   * When `true` prevents the adapter from responding by itself and leaves that up to listeners.
   */
  public waitForResponse: boolean;

  /**
   * The HTTP server this adapter might be running, created in {@link start}.
   */
  private server?: http.Server;

  /**
   * @param signingSecret - The token used to authenticate signed requests from Slack's Events API.
   * @param opts event adapter options
   * @param opts.includeBody - Whether to include the API event bodies in adapter event listeners.
   * @param opts.includeHeaders - Whether to include request headers in adapter event listeners.
   * @param opts.waitForResponse - When `true` prevents the adapter from responding by itself and leaves that up to
   * listeners.
   */
  public constructor(
    signingSecret: string,
    {
      includeBody = false,
      includeHeaders = false,
      waitForResponse = false,
    }: EventAdapterOptions = {},
  ) {
    if (!isString(signingSecret)) {
      throw new TypeError('SlackEventAdapter needs a signing secret');
    }

    super();

    this.signingSecret = signingSecret;
    this.includeBody = includeBody;
    this.includeHeaders = includeHeaders;
    this.waitForResponse = waitForResponse;

    debug('adapter instantiated - options: %o', {
      includeBody,
      includeHeaders,
      waitForResponse,
    });
  }

  /**
   * Creates an HTTP server to listen for event payloads.
   */
  public async createServer(): Promise<http.Server> {
    // TODO: options (like https)
    return http.createServer(this.requestListener());
  }

  /**
   * Starts a server on the specified port.
   *
   * @param port - The port number to listen on.
   * @returns The {@link http.Server | server}.
   */
  public start(port: number): Promise<http.Server> {
    return this.createServer()
      .then(server => new Promise((resolve, reject) => {
        this.server = server;
        server.on('error', reject);
        server.listen(port, () => resolve(server));
        debug('server started - port: %s', port);
      }));
  }

  /**
   * Stops the server started by {@link start}.
   */
  public stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!isFalsy(this.server)) {
        this.server.close((error) => {
          delete this.server;
          if (!isFalsy(error)) {
            reject(error);
          } else {
            resolve();
          }
        });
      } else {
        reject(new Error('SlackEventAdapter cannot stop when it did not start a server'));
      }
    });
  }

  /**
   * Returns a middleware-compatible adapter.
   */
  public expressMiddleware(): RequestHandler {
    const requestListener = this.requestListener();
    return (req, res, _next) => {
      requestListener(req, res);
    };
  }

  /**
   * Creates a request listener.
   */
  public requestListener(): RequestListener {
    return createHTTPHandler(this);
  }
}

/**
 * Options when constructing {@link SlackEventAdapter}. See {@link SlackEventAdapter}'s fields for more information on
 * what each option does.
 */
export interface EventAdapterOptions {
  includeBody?: boolean;
  includeHeaders?: boolean;
  waitForResponse?: boolean;
}

/**
 * @alias module:adapter
 */
export default SlackEventAdapter;
