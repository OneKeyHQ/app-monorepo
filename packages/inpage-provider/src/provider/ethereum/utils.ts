import { EventEmitter } from 'events';
import { JsonRpcMiddleware, PendingJsonRpcResponse } from 'json-rpc-engine';
import { ethErrors } from 'eth-rpc-errors';

export type Maybe<T> = Partial<T> | null | undefined;

export type ConsoleLike = Pick<
  Console,
  'log' | 'warn' | 'error' | 'debug' | 'info' | 'trace'
>;

// utility functions

/**
 * json-rpc-engine middleware that logs RPC errors and and validates req.method.
 *
 * @param log - The logging API to use.
 * @returns  json-rpc-engine middleware function
 */
export function createErrorMiddleware(
  log: ConsoleLike,
): JsonRpcMiddleware<unknown, unknown> {
  return (req, res, next) => {
    // json-rpc-engine will terminate the request when it notices this error
    if (typeof req.method !== 'string' || !req.method) {
      res.error = ethErrors.rpc.invalidRequest({
        message: `The request 'method' must be a non-empty string.`,
        data: req,
      });
    }

    next((done) => {
      const { error } = res;
      if (!error) {
        return done();
      }
      log.error(`MetaMask - RPC Error: ${error.message}`, error);
      return done();
    });
  };
}

// resolve response.result or response, reject errors
export const getRpcPromiseCallback =
  (
    resolve: (value?: any) => void,
    reject: (error?: Error) => void,
    unwrapResult = true,
  ) =>
  (error: Error, response: PendingJsonRpcResponse<unknown>): void => {
    if (error || response.error) {
      reject(error || response.error);
    } else {
      !unwrapResult || Array.isArray(response)
        ? resolve(response)
        : resolve(response.result);
    }
  };

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
