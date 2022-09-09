import Connector from '@walletconnect/core';
import {
  getBridgeUrl,
  shouldSelectRandomly,
} from '@walletconnect/core/dist/esm/url';
import * as cryptoLib from '@walletconnect/iso-crypto';
import SocketTransport from '@walletconnect/socket-transport';
import { toLower } from 'lodash';

import {
  WALLET_CONNECT_BRIDGE,
  WALLET_CONNECT_PROTOCOL,
  WALLET_CONNECT_VERSION,
} from './walletConnectConsts';

import type { WalletConnectSessionStorage } from './WalletConnectSessionStorage';
import type {
  ICreateSessionOptions,
  IPushServerOptions,
  ISessionError,
  ISessionStatus,
  IWalletConnectOptions,
} from '@walletconnect/types';

// TODO delete instance after disconnect
const transports: Record<string, SocketTransport | undefined> = {};

// TODO memoizee
function getOrCreateTransport({
  bridge,
  onOpen,
}: {
  bridge: string;
  onOpen: () => void;
}) {
  let transport = transports[bridge];
  // @ts-ignore
  if (transport && bridge !== transport._url) {
    transport.close();
    transport = undefined;
  }
  if (transport && transport.closed) {
    transport = undefined;
  }
  if (!transport) {
    transport = new SocketTransport({
      protocol: WALLET_CONNECT_PROTOCOL,
      version: WALLET_CONNECT_VERSION,
      url: bridge,
      // subscriptions: [this.clientId],
    });
    // transport.on("open"
    // transport_open
    transport.on('open', () => {
      debugger;
      onOpen?.();
    });
  }
  transports[bridge] = transport;
  return transport;
}

let randomBridgeUrl = '';
function convertToRandomBridgeUrl({ bridge }: { bridge: string }) {
  if (!shouldSelectRandomly(bridge)) {
    return bridge;
  }
  if (!randomBridgeUrl) {
    randomBridgeUrl = getBridgeUrl(bridge);
  }
  return randomBridgeUrl;
}

export class OneKeyWalletConnector extends Connector {
  constructor(
    sessionStorage: WalletConnectSessionStorage,
    connectorOpts: IWalletConnectOptions,
    pushServerOpts?: IPushServerOptions,
  ) {
    let transport: SocketTransport | undefined;
    const onTransportOpen = () => {
      if (this.clientId && this.socketTransport) {
        debugger;
        this.socketTransport?.subscribe?.(`${this.clientId}`);
      }
    };
    // transport and bridge will be build from uri
    if (!connectorOpts.uri) {
      // use session.bridge first
      const bridge =
        connectorOpts.session?.bridge ||
        convertToRandomBridgeUrl({
          bridge: connectorOpts.bridge || WALLET_CONNECT_BRIDGE,
        });
      transport = getOrCreateTransport({
        onOpen: onTransportOpen,
        bridge,
      });
    }

    super({
      transport,

      cryptoLib,
      connectorOpts,
      // @ts-ignore
      sessionStorage,
      pushServerOpts,
    });

    // should update bridge if use custom transport
    if (transport) {
      // @ts-ignore
      this.bridge = transport?._url || this.bridge;
    }
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

  get socketTransport(): SocketTransport | undefined {
    // @ts-ignore
    return this._transport as SocketTransport | undefined;
  }

  get isTransportOpen() {
    return !this.socketTransport?.closed;
  }

  getAccountAddress() {
    return toLower(this.accounts?.[0] || '');
  }
}
