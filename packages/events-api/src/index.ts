import { SlackEventAdapter, EventAdapterOptions } from './adapter';

export { verifyRequestSignature, errorCodes } from './http-handler';

/**
 * Creates a new {@link SlackEventAdapter}.
 * @param signingSecret secret used for signing
 * @param [options] adapter options
 */
export function createEventAdapter(signingSecret: string, options?: EventAdapterOptions): SlackEventAdapter {
  return new SlackEventAdapter(signingSecret, options);
}
