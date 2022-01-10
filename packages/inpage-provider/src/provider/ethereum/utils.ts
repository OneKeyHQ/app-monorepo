import EventEmitter from 'eventemitter3';

export type ConsoleLike = Pick<
  Console,
  'log' | 'warn' | 'error' | 'debug' | 'info' | 'trace'
>;

// utility functions

/**
 * Logs a stream disconnection error. Emits an 'error' if given an
 * EventEmitter that has listeners for the 'error' event.
 *
 * @param log - The logging API to use.
 * @param remoteLabel - The label of the disconnected stream.
 * @param error - The associated error to log.
 * @param emitter - The logging API to use.
 */
export function logStreamDisconnectWarning(
  log: ConsoleLike,
  remoteLabel: string,
  error: Error,
  emitter: EventEmitter,
): void {
  let warningMsg = `MetaMask: Lost connection to "${remoteLabel}".`;
  if (error?.stack) {
    warningMsg += `\n${error.stack}`;
  }
  log.warn(warningMsg);
  if (emitter && emitter.listenerCount('error') > 0) {
    emitter.emit('error', warningMsg);
  }
}

export const NOOP = () => undefined;

// constants

export const EMITTED_NOTIFICATIONS = [
  'eth_subscription', // per eth-json-rpc-filters/subscriptionManager
];
