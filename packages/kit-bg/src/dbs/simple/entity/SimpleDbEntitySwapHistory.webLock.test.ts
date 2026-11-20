import { createMemoryStorage } from '@onekeyhq/shared/src/test-utils/mocks/memoryStorage';
import {
  EProtocolOfExchange,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';
import type { ISwapTxHistory } from '@onekeyhq/shared/types/swap/types';

import { SimpleDbEntityBroadcastRecords } from './SimpleDbEntityBroadcastRecords';
import { SimpleDbEntityEarnFunding } from './SimpleDbEntityEarnFunding';
import { SimpleDbEntitySwapHistory } from './SimpleDbEntitySwapHistory';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    ...jest.requireActual<typeof import('@onekeyhq/shared/src/platformEnv')>(
      '@onekeyhq/shared/src/platformEnv',
    ).default,
    isWeb: true,
  },
}));

function history(txId: string): ISwapTxHistory {
  const token = {
    networkId: 'evm--1',
    contractAddress: '0x1',
    symbol: 'A',
    decimals: 18,
  };
  return {
    protocol: EProtocolOfExchange.SWAP,
    status: ESwapTxHistoryStatus.PENDING,
    currency: '$',
    accountInfo: {
      sender: { networkId: 'evm--1' },
      receiver: { networkId: 'evm--1' },
    },
    baseInfo: {
      fromToken: token,
      toToken: token,
      fromAmount: '1',
      toAmount: '1',
    },
    txInfo: { txId, sender: '0xa', receiver: '0xb' },
    swapInfo: {
      provider: { provider: 'p', providerName: 'P' },
      instantRate: '',
    },
    date: { created: 1, updated: 1 },
  };
}

const previousNavigator = Object.getOwnPropertyDescriptor(
  globalThis,
  'navigator',
);
const previousBackground = globalThis.$onekeyIsInBackground;

beforeEach(() => {
  globalThis.$onekeyIsInBackground = true;
  const queues = new Map<string, Promise<unknown>>();
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      locks: {
        request: <T>(name: string, callback: () => Promise<T>) => {
          const result = (queues.get(name) ?? Promise.resolve()).then(callback);
          queues.set(
            name,
            result.catch(() => undefined),
          );
          return result;
        },
      },
    },
  });
});
afterEach(() => {
  globalThis.$onekeyIsInBackground = previousBackground;
  if (previousNavigator)
    Object.defineProperty(globalThis, 'navigator', previousNavigator);
  else Reflect.deleteProperty(globalThis, 'navigator');
});

it('serializes history mutations across separate background instances', async () => {
  const storage = createMemoryStorage(null);
  const first = new SimpleDbEntitySwapHistory();
  const second = new SimpleDbEntitySwapHistory();
  Reflect.set(first, 'appStorage', storage);
  Reflect.set(second, 'appStorage', storage);
  await Promise.all([
    first.addSwapHistoryItem(history('first')),
    second.addSwapHistoryItem(history('second')),
  ]);
  expect(
    (await first.getSwapHistoryList())
      .map((item) => item.txInfo.txId)
      .toSorted(),
  ).toEqual(['first', 'second']);
});

it('reads accepted broadcast records written by another Web instance', async () => {
  const storage = createMemoryStorage(null);
  const first = new SimpleDbEntityBroadcastRecords();
  const second = new SimpleDbEntityBroadcastRecords();
  Reflect.set(first, 'appStorage', storage);
  Reflect.set(second, 'appStorage', storage);
  expect(await second.getRecord('swap')).toBeUndefined();
  await first.upsertRecord({
    uuid: 'swap',
    accountId: 'account',
    networkId: 'evm--1',
    signedTx: { txid: 'tx', rawTx: 'signed', encodedTx: null },
    attemptedAt: 1,
    isBroadcast: true,
    isSettled: false,
  });
  expect(await second.getRecord('swap')).toMatchObject({
    isBroadcast: true,
    signedTx: { txid: 'tx' },
  });
});

it('preserves ordinary storage access without Web Locks', async () => {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {},
  });
  const historyEntity = new SimpleDbEntitySwapHistory();
  const broadcastEntity = new SimpleDbEntityBroadcastRecords();
  const fundingEntity = new SimpleDbEntityEarnFunding();
  Reflect.set(historyEntity, 'appStorage', createMemoryStorage(null));
  Reflect.set(broadcastEntity, 'appStorage', createMemoryStorage(null));
  Reflect.set(fundingEntity, 'appStorage', createMemoryStorage(null));
  await expect(
    historyEntity.addSwapHistoryItem(history('tx')),
  ).resolves.toBeUndefined();
  await expect(broadcastEntity.getRecord('uuid')).resolves.toBeUndefined();
  await expect(
    fundingEntity.changeFunding('scope', {
      type: 'claim',
      attemptId: 'attempt',
    }),
  ).rejects.toThrow('Earn funding requires cross-tab storage locking');
});
