import { ethErrors } from 'eth-rpc-errors';
import sendSiteMetadata from './siteMetadata';
import messages from './messages';
import { EMITTED_NOTIFICATIONS, getRpcPromiseCallback, NOOP } from './utils';
import BaseProvider, {
  BaseProviderOptions,
  UnvalidatedJsonRpcRequest,
} from './BaseProvider';

export interface SendSyncJsonRpcRequest extends JsonRpcRequest<unknown> {
  method:
    | 'eth_accounts'
    | 'eth_coinbase'
    | 'eth_uninstallFilter'
    | 'net_version';
}

type WarningEventName = keyof SentWarningsState['events'];

export interface MetaMaskInpageProviderOptions extends BaseProviderOptions {
  /**
   * Whether the provider should send page metadata.
   */
  shouldSendMetadata?: boolean;
}

interface SentWarningsState {
  // methods
  enable: boolean;
  experimentalMethods: boolean;
  send: boolean;
  // events
  events: {
    close: boolean;
    data: boolean;
    networkChanged: boolean;
    notification: boolean;
  };
}

export default class MetaMaskInpageProvider extends BaseProvider {
  protected _sentWarnings: SentWarningsState = {
    // methods
    enable: false,
    experimentalMethods: false,
    send: false,
    // events
    events: {
      close: false,
      data: false,
      networkChanged: false,
      notification: false,
    },
  };

  /**
   * Experimental methods can be found here.
   */
  public readonly _metamask: ReturnType<
    MetaMaskInpageProvider['_getExperimentalApi']
  >;

  public networkVersion: string | null;

  /**
   * Indicating that this provider is a MetaMask provider.
   */
  public readonly isMetaMask: true;

  /**
   * @param connectionStream - A Node.js duplex stream
   * @param options - An options bag
   * @param options.jsonRpcStreamName - The name of the internal JSON-RPC stream.
   * Default: metamask-provider
   * @param options.logger - The logging API to use. Default: console
   * @param options.maxEventListeners - The maximum number of event
   * listeners. Default: 100
   * @param options.shouldSendMetadata - Whether the provider should
   * send page metadata. Default: true
   */
  constructor(
    connectionStream: Duplex,
    {
      jsonRpcStreamName = 'metamask-provider',
      logger = console,
      maxEventListeners = 100,
      shouldSendMetadata = true,
    }: MetaMaskInpageProviderOptions = {},
  ) {
    super(connectionStream, { jsonRpcStreamName, logger, maxEventListeners });

    this.networkVersion = null;
    this.isMetaMask = true;

    this._sendSync = this._sendSync.bind(this);
    this.enable = this.enable.bind(this);
    this.send = this.send.bind(this);
    this.sendAsync = this.sendAsync.bind(this);
    this._warnOfDeprecation = this._warnOfDeprecation.bind(this);

    this._metamask = this._getExperimentalApi();

    // handle JSON-RPC notifications
    this._jsonRpcConnection.events.on('notification', (payload) => {
      const { method } = payload;
      if (EMITTED_NOTIFICATIONS.includes(method)) {
        // deprecated
        // emitted here because that was the original order
        this.emit('data', payload);
        // deprecated
        this.emit('notification', payload.params.result);
      }
    });

    // send website metadata
    if (shouldSendMetadata) {
      if (document.readyState === 'complete') {
        sendSiteMetadata(this._rpcEngine, this._log);
      } else {
        const domContentLoadedHandler = () => {
          sendSiteMetadata(this._rpcEngine, this._log);
          window.removeEventListener(
            'DOMContentLoaded',
            domContentLoadedHandler,
          );
        };
        window.addEventListener('DOMContentLoaded', domContentLoadedHandler);
      }
    }
  }

  //====================
  // Public Methods
  //====================

  /**
   * Submits an RPC request per the given JSON-RPC request object.
   *
   * @param payload - The RPC request object.
   * @param cb - The callback function.
   */
  sendAsync(
    payload: JsonRpcRequest<unknown>,
    callback: (error: Error | null, result?: JsonRpcResponse<unknown>) => void,
  ): void {
    this._rpcRequest(payload, callback);
  }

  /**
   * We override the following event methods so that we can warn consumers
   * about deprecated events:
   *   addListener, on, once, prependListener, prependOnceListener
   */

  addListener(eventName: string, listener: (...args: unknown[]) => void) {
    this._warnOfDeprecation(eventName);
    return super.addListener(eventName, listener);
  }

  on(eventName: string, listener: (...args: unknown[]) => void) {
    this._warnOfDeprecation(eventName);
    return super.on(eventName, listener);
  }

  once(eventName: string, listener: (...args: unknown[]) => void) {
    this._warnOfDeprecation(eventName);
    return super.once(eventName, listener);
  }

  prependListener(eventName: string, listener: (...args: unknown[]) => void) {
    this._warnOfDeprecation(eventName);
    return super.prependListener(eventName, listener);
  }

  prependOnceListener(
    eventName: string,
    listener: (...args: unknown[]) => void,
  ) {
    this._warnOfDeprecation(eventName);
    return super.prependOnceListener(eventName, listener);
  }

  //====================
  // Private Methods
  //====================

  /**
   * When the provider becomes disconnected, updates internal state and emits
   * required events. Idempotent with respect to the isRecoverable parameter.
   *
   * Error codes per the CloseEvent status codes as required by EIP-1193:
   * https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent#Status_codes
   *
   * @param isRecoverable - Whether the disconnection is recoverable.
   * @param errorMessage - A custom error message.
   * @emits MetaMaskInpageProvider#disconnect
   */
  protected _handleDisconnect(isRecoverable: boolean, errorMessage?: string) {
    super._handleDisconnect(isRecoverable, errorMessage);
    if (this.networkVersion && !isRecoverable) {
      this.networkVersion = null;
    }
  }

  /**
   * Warns of deprecation for the given event, if applicable.
   */
  protected _warnOfDeprecation(eventName: string): void {
    if (this._sentWarnings?.events[eventName as WarningEventName] === false) {
      this._log.warn(messages.warnings.events[eventName as WarningEventName]);
      this._sentWarnings.events[eventName as WarningEventName] = true;
    }
  }

  //====================
  // Deprecated Methods
  //====================

  /**
   * Equivalent to: ethereum.request('eth_requestAccounts')
   *
   * @deprecated Use request({ method: 'eth_requestAccounts' }) instead.
   * @returns A promise that resolves to an array of addresses.
   */
  enable(): Promise<string[]> {
    if (!this._sentWarnings.enable) {
      this._log.warn(messages.warnings.enableDeprecation);
      this._sentWarnings.enable = true;
    }

    return new Promise<string[]>((resolve, reject) => {
      try {
        this._rpcRequest(
          { method: 'eth_requestAccounts', params: [] },
          getRpcPromiseCallback(resolve, reject),
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Submits an RPC request for the given method, with the given params.
   *
   * @deprecated Use "request" instead.
   * @param method - The method to request.
   * @param params - Any params for the method.
   * @returns A Promise that resolves with the JSON-RPC response object for the
   * request.
   */
  send<T>(method: string, params?: T[]): Promise<JsonRpcResponse<T>>;

  /**
   * Submits an RPC request per the given JSON-RPC request object.
   *
   * @deprecated Use "request" instead.
   * @param payload - A JSON-RPC request object.
   * @param callback - An error-first callback that will receive the JSON-RPC
   * response object.
   */
  send<T>(
    payload: JsonRpcRequest<unknown>,
    callback: (error: Error | null, result?: JsonRpcResponse<T>) => void,
  ): void;

  /**
   * Accepts a JSON-RPC request object, and synchronously returns the cached result
   * for the given method. Only supports 4 specific RPC methods.
   *
   * @deprecated Use "request" instead.
   * @param payload - A JSON-RPC request object.
   * @returns A JSON-RPC response object.
   */
  send<T>(payload: SendSyncJsonRpcRequest): JsonRpcResponse<T>;

  send(methodOrPayload: unknown, callbackOrArgs?: unknown): unknown {
    if (!this._sentWarnings.send) {
      this._log.warn(messages.warnings.sendDeprecation);
      this._sentWarnings.send = true;
    }

    if (
      typeof methodOrPayload === 'string' &&
      (!callbackOrArgs || Array.isArray(callbackOrArgs))
    ) {
      return new Promise((resolve, reject) => {
        try {
          this._rpcRequest(
            { method: methodOrPayload, params: callbackOrArgs },
            getRpcPromiseCallback(resolve, reject, false),
          );
        } catch (error) {
          reject(error);
        }
      });
    } else if (
      methodOrPayload &&
      typeof methodOrPayload === 'object' &&
      typeof callbackOrArgs === 'function'
    ) {
      return this._rpcRequest(
        methodOrPayload as JsonRpcRequest<unknown>,
        callbackOrArgs as (...args: unknown[]) => void,
      );
    }
    return this._sendSync(methodOrPayload as SendSyncJsonRpcRequest);
  }

  /**
   * Internal backwards compatibility method, used in send.
   *
   * @deprecated
   */
  protected _sendSync(payload: SendSyncJsonRpcRequest) {
    let result;
    switch (payload.method) {
      case 'eth_accounts':
        result = this.selectedAddress ? [this.selectedAddress] : [];
        break;

      case 'eth_coinbase':
        result = this.selectedAddress || null;
        break;

      case 'eth_uninstallFilter':
        this._rpcRequest(payload, NOOP);
        result = true;
        break;

      case 'net_version':
        result = this.networkVersion || null;
        break;

      default:
        throw new Error(messages.errors.unsupportedSync(payload.method));
    }

    return {
      id: payload.id,
      jsonrpc: payload.jsonrpc,
      result,
    };
  }

  /**
   * Constructor helper.
   * Gets experimental _metamask API as Proxy, so that we can warn consumers
   * about its experiment nature.
   */
  protected _getExperimentalApi() {
    return new Proxy(
      {
        /**
         * Determines if MetaMask is unlocked by the user.
         *
         * @returns Promise resolving to true if MetaMask is currently unlocked
         */
        isUnlocked: async () => {
          if (!this._state.initialized) {
            await new Promise<void>((resolve) => {
              this.on('_initialized', () => resolve());
            });
          }
          return this._state.isUnlocked;
        },

        /**
         * Make a batch RPC request.
         */
        requestBatch: async (requests: UnvalidatedJsonRpcRequest[]) => {
          if (!Array.isArray(requests)) {
            throw ethErrors.rpc.invalidRequest({
              message:
                'Batch requests must be made with an array of request objects.',
              data: requests,
            });
          }

          return new Promise((resolve, reject) => {
            this._rpcRequest(requests, getRpcPromiseCallback(resolve, reject));
          });
        },
      },
      {
        get: (obj, prop, ...args) => {
          if (!this._sentWarnings.experimentalMethods) {
            this._log.warn(messages.warnings.experimentalMethods);
            this._sentWarnings.experimentalMethods = true;
          }
          return Reflect.get(obj, prop, ...args);
        },
      },
    );
  }

  /**
   * Upon receipt of a new chainId and networkVersion, emits corresponding
   * events and sets relevant public state.
   * Does nothing if neither the chainId nor the networkVersion are different
   * from existing values.
   *
   * @emits MetamaskInpageProvider#chainChanged
   * @emits MetamaskInpageProvider#networkChanged
   * @param networkInfo - An object with network info.
   * @param networkInfo.chainId - The latest chain ID.
   * @param networkInfo.networkVersion - The latest network ID.
   */
  protected _handleChainChanged({
    chainId,
    networkVersion,
  }: { chainId?: string; networkVersion?: string } = {}) {
    super._handleChainChanged({ chainId, networkVersion });

    if (
      networkVersion &&
      networkVersion !== 'loading' &&
      networkVersion !== this.networkVersion
    ) {
      this.networkVersion = networkVersion;
      if (this._state.initialized) {
        this.emit('networkChanged', this.networkVersion);
      }
    }
  }
}
