import { CrossEventEmitter } from '@onekeyfe/cross-inpage-provider-core';
import SocketTransport from '@walletconnect/socket-transport';

import {
  WALLET_CONNECT_PROTOCOL,
  WALLET_CONNECT_VERSION,
} from './walletConnectConsts';

// @ts-ignore
export class OneKeyWalletConnectSocketTransport extends SocketTransport {
  emitter = new CrossEventEmitter();

  subscribedTopics: {
    [clientId: string]: boolean;
  } = {};

  // to avoid subscribe same topic multiple times
  override subscribe(topic: string) {
    if (this.subscribedTopics[topic]) {
      return;
    }
    super.subscribe(topic);
    this.subscribedTopics[topic] = true;
  }

  get socketClient(): WebSocket | undefined {
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this._socket;
  }

  override _socketCreate() {
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super._socketCreate();
    // @ts-ignore
    this.clearCacheOnCloseEvent(this._nextSocket);
    // @ts-ignore
    if (this._nextSocket) {
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      this._nextSocket?.addEventListener?.('open', () => {
        this.emitter.emit('transport_open');
      });
    }
  }

  clearSubscribedTopicsCache = () => {
    this.subscribedTopics = {};
    this.socketClient?.removeEventListener(
      'close',
      this.clearSubscribedTopicsCache,
    );
  };

  clearCacheOnCloseEvent(socket: WebSocket | undefined) {
    if (socket) {
      socket?.removeEventListener('close', this.clearSubscribedTopicsCache);
      socket?.addEventListener('close', this.clearSubscribedTopicsCache);
    }
  }
}

// TODO delete instance after disconnect
const transports: Record<
  string,
  OneKeyWalletConnectSocketTransport | undefined
> = {};

if (process.env.NODE_ENV !== 'production') {
  global.$$wcTransports = transports;
}

// TODO memoizee
export function getOrCreateTransport({
  bridge,
  isWalletSide,
}: {
  bridge: string;
  isWalletSide: boolean;
}) {
  const mapKey = `${bridge}@${isWalletSide ? 'wallet' : 'dapp'}`;
  let transport = transports[mapKey];
  // @ts-ignore
  if (transport && bridge !== transport._url) {
    transport.close();
    transport = undefined;
  }
  if (transport && transport.closed) {
    transport = undefined;
  }
  if (!transport) {
    transport = new OneKeyWalletConnectSocketTransport({
      protocol: WALLET_CONNECT_PROTOCOL,
      version: WALLET_CONNECT_VERSION,
      url: bridge,
      // subscriptions: [this.clientId],
    });
    transport.emitter.once('transport_open', () => {
      // debugger;
    });
  }
  transports[mapKey] = transport;
  return transport;
}
