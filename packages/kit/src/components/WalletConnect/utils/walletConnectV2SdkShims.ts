import {
  // Core,
  // Crypto,
  Expirer,
  JsonRpcHistory,
  KeyChain,
  MessageTracker,
  Pairing,
  Store,
  Subscriber,
} from '@walletconnect-v2/core';
import { Store as Store2 } from '@walletconnect/sign-client/node_modules/@walletconnect/core';
import { isNil } from 'lodash';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { ICore, IStore } from '@walletconnect-v2/types';

function getStorageKey({ core, self }: { core: ICore; self: any }) {
  if (!core) {
    throw new Error(
      'walletConnectV2SdkShims getStorageKey ERROR: core is undefined',
    );
  }
  // @ts-ignore
  const isWalletSide = core?.isWalletSide;
  if (isNil(isWalletSide)) {
    throw new Error(
      'walletConnectV2SdkShims getStorageKey ERROR: core.isWalletSide is undefined',
    );
  }
  const prefix = isWalletSide ? 'wallet' : 'dapp';
  // eslint-disable-next-line  @typescript-eslint/no-unsafe-member-access, @typescript-eslint/restrict-plus-operands, @typescript-eslint/restrict-template-expressions
  const { storagePrefix = '', version = '', name = '' } = self;
  if (!storagePrefix || !version || !name) {
    throw new Error(
      'walletConnectV2SdkShims getStorageKey ERROR: storagePrefix,version,name is undefined',
    );
  }
  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
  return `${prefix}--${storagePrefix}${version}//${name}`;
}

Object.defineProperty(Expirer.prototype, 'storageKey', {
  get() {
    const self = this as Expirer;
    return getStorageKey({ core: self.core, self });
  },
});

Object.defineProperty(JsonRpcHistory.prototype, 'storageKey', {
  get() {
    const self = this as JsonRpcHistory;
    return getStorageKey({ core: self.core, self });
  },
});

Object.defineProperty(KeyChain.prototype, 'storageKey', {
  get() {
    const self = this as KeyChain;
    return getStorageKey({ core: self.core, self });
  },
});

Object.defineProperty(MessageTracker.prototype, 'storageKey', {
  get() {
    const self = this as MessageTracker;
    return getStorageKey({ core: self.core, self });
  },
});

Object.defineProperty(Pairing.prototype, 'storageKey', {
  get() {
    const self = this as Pairing;
    return getStorageKey({ core: self.core, self });
  },
});

Object.defineProperty(Store.prototype, 'storageKey', {
  get() {
    const self = this as Store<any, any>;
    return getStorageKey({ core: self.core, self });
  },
});

Object.defineProperty(Store2.prototype, 'storageKey', {
  get() {
    const self = this as Store2<any, any>;
    return getStorageKey({ core: self.core, self });
  },
});

Object.defineProperty(Subscriber.prototype, 'storageKey', {
  get() {
    const self = this as Subscriber;
    return getStorageKey({ core: self.relayer.core, self });
  },
});
