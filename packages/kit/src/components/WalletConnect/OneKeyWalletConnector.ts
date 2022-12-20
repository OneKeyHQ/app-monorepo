import Connector from '@walletconnect/core';
import {
  getBridgeUrl,
  shouldSelectRandomly,
} from '@walletconnect/core/dist/esm/url';
import * as cryptoLib from '@walletconnect/iso-crypto';
import { isNil, toLower } from 'lodash';

import { getOrCreateTransport } from './OneKeyWalletConnectSocketTransport';
import { WALLET_CONNECT_BRIDGE } from './walletConnectConsts';

import type { OneKeyWalletConnectSocketTransport } from './OneKeyWalletConnectSocketTransport';
import type { WalletConnectSessionStorage } from './WalletConnectSessionStorage';
import type {
  IPushServerOptions,
  IWalletConnectOptions,
} from '@walletconnect/types';

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
    connectorOpts: IWalletConnectOptions & {
      isDeepLink?: boolean;
      isWalletSide: boolean;
    },
    pushServerOpts?: IPushServerOptions,
  ) {
    let transport: OneKeyWalletConnectSocketTransport | undefined;
    const onTransportOpen = () => {
      if (this.clientId && this.socketTransport) {
        this.socketTransport?.subscribe?.(`${this.clientId}`);
      }
    };

    // transport and bridge will be build from uri
    if (!connectorOpts.uri) {
      // use session.bridge url first
      const bridge =
        connectorOpts.session?.bridge ||
        convertToRandomBridgeUrl({
          bridge: connectorOpts.bridge || WALLET_CONNECT_BRIDGE,
        });
      // build cached transport when connecting by storage session
      transport = getOrCreateTransport({
        bridge,
        isWalletSide: connectorOpts.isWalletSide,
      });
      transport.emitter.once('transport_open', () => {
        onTransportOpen();
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
    if (!isNil(connectorOpts.isDeepLink)) {
      this.isDeepLink = connectorOpts.isDeepLink;
    }
  }

  isDeepLink: boolean | undefined;

  override get session() {
    const $session = super.session;
    return {
      ...$session,
      isDeepLink: this.isDeepLink,
    };
  }

  override set session(value) {
    super.session = value;
    if (!isNil(value.isDeepLink)) {
      this.isDeepLink = value.isDeepLink;
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

  get socketTransport(): OneKeyWalletConnectSocketTransport | undefined {
    // @ts-ignore
    return this._transport as OneKeyWalletConnectSocketTransport | undefined;
  }

  get isTransportOpen() {
    return !this.socketTransport?.closed;
  }

  getAccountAddress() {
    return toLower(this.accounts?.[0] || '');
  }
}
