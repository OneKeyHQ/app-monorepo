/* eslint-disable max-classes-per-file */
// import WalletConnect1 from '@walletconnect/client';
import {
  IInjectedProviderNames,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';
import Connector from '@walletconnect/core';
import * as cryptoLib from '@walletconnect/iso-crypto';
import { isWalletConnectSession } from '@walletconnect/utils';

import { IMPL_EVM } from '@onekeyhq/engine/src/constants';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';

import { backgroundClass, backgroundMethod } from '../decorators';
import { waitForDataLoaded } from '../utils';

import type { IBackgroundApi } from '../IBackgroundApi';
import type {
  IPushServerOptions,
  ISessionStorage,
  IWalletConnectOptions,
  IWalletConnectSession,
} from '@walletconnect/types';

const DEFAULT_WALLET_CONNECT_STORAGE_KEY = 'onekey@walletconnect';

// TODO save to redux
// TODO iOS\android\ext test
class WalletConnectSessionStorage implements ISessionStorage {
  constructor(storageId = DEFAULT_WALLET_CONNECT_STORAGE_KEY) {
    this.storageId = storageId;
  }

  storageId = DEFAULT_WALLET_CONNECT_STORAGE_KEY;

  // TODO async method
  // @ts-ignore
  async getSession(): Promise<IWalletConnectSession | null> {
    let session = null;
    const jsonStr = (await appStorage.getItem(this.storageId)) as string;
    if (jsonStr) {
      try {
        const json = JSON.parse(jsonStr);
        if (json && isWalletConnectSession(json)) {
          session = json;
        }
      } catch (error) {
        console.error('WalletConnectSessionStorage.getSession ERROR:', error);
      }
    }

    return session;
  }

  setSession(session: IWalletConnectSession): IWalletConnectSession {
    if (!session.peerId) {
      throw new Error(
        'WalletConnectSessionStorage ERROR: peerId is required, please make sure this method is called after websocket connection ready.',
      );
    }
    // TODO setItem object
    // TODO try catch
    appStorage.setItem(this.storageId, JSON.stringify(session));
    return session;
  }

  removeSession(): void {
    appStorage.removeItem(this.storageId);
  }
}

const sessionStorage = new WalletConnectSessionStorage();

class WalletConnect extends Connector {
  constructor(
    connectorOpts: IWalletConnectOptions,
    pushServerOpts?: IPushServerOptions,
  ) {
    super({
      cryptoLib,
      connectorOpts,
      pushServerOpts,
      // @ts-ignore
      sessionStorage,
    });
  }

  once(event: string, listener: (...args: any[]) => void) {
    let executed = false;
    const listenerOnce = (...args: any[]) => {
      if (executed) {
        return;
      }
      executed = true;
      listener(...args);
    };
    this.on(event, listenerOnce);
  }
}

@backgroundClass()
class WalletConnectAdapter {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    this.backgroundApi = backgroundApi;
    this.autoConnectLastSession();
  }

  backgroundApi: IBackgroundApi;

  connector?: WalletConnect;

  // TODO once() instead
  async waitConnectorPeerReady({
    connector,
    logName,
  }: {
    connector: WalletConnect;
    logName: string;
  }) {
    // on("session_request") peerMeta peerId ready
    // needs to wait for this.connector.peerId ready
    await waitForDataLoaded({
      data: () => Boolean(connector.peerId),
      logName,
      // TODO websocket timeout, maybe uri is wrong or expired
    });
  }

  async _destroyConnector(connector?: WalletConnect) {
    if (connector) {
      this.unregisterEvents(connector);
      if (connector.connected) {
        // TODO timeout 3s
        await this.waitConnectorPeerReady({
          connector,
          logName: 'waitConnectorPeerReady -> disconnect()',
        });
        await connector.killSession();
      }
    }
  }

  async autoConnectLastSession() {
    const session = await sessionStorage.getSession();
    let { connector } = this;
    if (session && !connector) {
      connector = new WalletConnect({
        session,
      });
      this.connector = connector;
      await this.setupConnector(connector);
    }
  }

  // TODO move all methods with param `connector` to WalletConnect class
  async setupConnector(connector?: WalletConnect) {
    if (!connector) {
      return;
    }

    // DO NOT unregisterEvents here, may cause ws connection fail
    //        connector may have registered some internal handlers at new WalletConnect()
    // this.unregisterEvents(connector);
    this.registerEvents(connector);

    // TODO use once('session_request') trigger means pear ready
    // TODO timeout 10s
    await this.waitConnectorPeerReady({
      connector,
      logName: 'waitConnectorPeerReady -> connect()',
    });

    if (!connector.connected) {
      // return session id? and save to storage?
      await connector.createSession();
    }

    // TODO save connector.session to redux for UI auto refresh
  }

  async ethereumRequest(connector: WalletConnect, data: any): Promise<any> {
    const { ethereum } = IInjectedProviderNames;
    const resp = await this.backgroundApi.handleProviderMethods({
      scope: ethereum,
      origin: this.getConnectorOrigin(connector),
      data,
    });
    return Promise.resolve(resp.result);
  }

  async getChainIdInteger(connector: WalletConnect) {
    return parseInt(
      await this.ethereumRequest(connector, { method: 'net_version' }),
      10,
    );
  }

  getConnectorOrigin(connector: WalletConnect) {
    const origin = connector?.peerMeta?.url || '';
    return origin;
  }

  @backgroundMethod()
  async disconnect() {
    // TODO remove approved connection of address/origin
    //    backgroundApiProxy.dispatch(dappClearSiteConnection());
    await this._destroyConnector(this.connector);
    this.connector = undefined;
    const session = await sessionStorage.getSession();
    if (session) {
      const lastConnector = new WalletConnect({
        session,
      });
      await this._destroyConnector(lastConnector);
    }
  }

  @backgroundMethod()
  async connect({ uri }: { uri: string }) {
    // uri network param defaults to evm
    const network = new URL(uri).searchParams.get('network') || IMPL_EVM;
    await this.disconnect();

    const connector = new WalletConnect({
      uri,
    });
    this.connector = connector;

    await this.setupConnector(connector);

    // TODO convert url to origin
    const origin = this.getConnectorOrigin(connector);
    debugLogger.walletConnect('new WalletConnect() by uri', {
      origin,
      network,
      uri,
    });

    // TODO on('connect') fired on peerId ready or approveSession()?

    // TODO show loading in UI

    // TODO check dapp is EVM or Solana
    //    connector.session
    //    connector.uri
    try {
      const result = (await this.ethereumRequest(connector, {
        method: 'eth_requestAccounts',
      })) as string[];

      const chainId = await this.getChainIdInteger(connector);

      if (connector.connected) {
        debugLogger.walletConnect(
          'walletConnect.connect -> updateSession',
          result,
        );
        connector.updateSession({ chainId, accounts: result });
      } else {
        debugLogger.walletConnect(
          'walletConnect.connect -> approveSession',
          result,
        );
        connector.approveSession({ chainId, accounts: result });
      }
    } catch (error) {
      debugLogger.walletConnect('walletConnect.connect reject', error);
      connector.rejectSession(error as any);
    }
  }

  createEventHandler(
    handler: (error: Error | null, payload: IJsonRpcRequest) => any,
    { throwError = true }: { throwError?: boolean } = {},
  ) {
    return (error: Error | null, payload: IJsonRpcRequest): any => {
      if (error && throwError) {
        throw error;
      }
      return handler(error, payload);
    };
  }

  unregisterEvents(connector?: WalletConnect) {
    if (!connector) {
      return;
    }
    debugLogger.walletConnect('unregisterEvents >>>>>> ');
    // https://docs.walletconnect.com/client-api#register-event-subscription
    [
      'connect',
      'disconnect',
      'session_request',
      'session_update',
      'call_request',
      'wc_sessionRequest',
      'wc_sessionUpdate',
    ].forEach((event) => connector.off(event));
  }

  responseCallRequest(
    connector: WalletConnect,
    resultPromise: Promise<any>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    { error, payload }: { error?: Error | null; payload: IJsonRpcRequest },
  ) {
    const id = payload.id as number;
    return resultPromise
      .then((result) =>
        connector.approveRequest({
          id,
          result,
        }),
      )
      .catch((error0: Error) => {
        connector.rejectRequest({
          id,
          error: error0,
        });
        console.error('walletConnect.responseCallRequest ERROR', error0);
        // TODO throwCrossError
        throw error0;
      });
  }

  registerEvents(connector?: WalletConnect) {
    if (!connector) {
      return;
    }

    connector.on(
      'session_request',
      this.createEventHandler((error, payload: IJsonRpcRequest) => {
        debugLogger.walletConnect('EVENT', 'session_request', payload);
        const { peerMeta } = (payload.params as any[])?.[0] || {};
        debugLogger.walletConnect('peerMeta', peerMeta);
      }),
    );

    // only fired on Dapp side
    connector.on(
      'session_update',
      this.createEventHandler((error, payload) => {
        debugLogger.walletConnect('EVENT', 'session_update', payload);
      }),
    );

    connector.on(
      'call_request',
      this.createEventHandler((error, payload) => {
        // tslint:disable-next-line
        debugLogger.walletConnect('EVENT', 'call_request', payload);
        // https://docs.walletconnect.com/client-api#send-custom-request
        // await window.$connector.sendCustomRequest({method:'eth_gasPrice'})
        return this.responseCallRequest(
          connector,
          this.ethereumRequest(connector, payload),
          {
            error,
            payload,
          },
        );
      }),
    );

    // trigger when accounts approveSession()
    connector.on(
      'connect',
      this.createEventHandler((error, payload) => {
        debugLogger.walletConnect('EVENT', 'connect', payload);

        // this.setState({ connected: true });
      }),
    );

    // disconnect from dapp or wallet will auto remove storage
    connector.on(
      'disconnect',
      this.createEventHandler((error, payload) => {
        debugLogger.walletConnect('EVENT', 'disconnect', payload);
        this.disconnect();
      }),
    );
  }

  async notifySessionChanged() {
    const { connector } = this;
    if (connector && connector.connected) {
      const chainId = await this.getChainIdInteger(connector);

      const accounts = await this.ethereumRequest(connector, {
        method: 'eth_accounts',
      });
      // TODO if accounts=[] killSession()
      connector.updateSession({
        chainId,
        accounts,
      });
    }
  }
}

export default WalletConnectAdapter;
