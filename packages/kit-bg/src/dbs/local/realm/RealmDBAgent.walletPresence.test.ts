import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { writeWalletPresenceHint } from '@onekeyhq/shared/src/utils/walletPresenceHintUtils';

import { ELocalDBStoreNames } from '../localDBStoreNames';
import { EIndexedDBBucketNames } from '../types';

import { RealmDBAgent } from './RealmDBAgent';

import type { IDBWallet } from '../types';
import type Realm from 'realm';

jest.mock('realm', () => ({ __esModule: true, default: {} }));
jest.mock('./schemas', () => ({ realmDBSchemasMap: {} }));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeBackgroundThread: true },
}));
jest.mock('@onekeyhq/shared/src/utils/resetUtils', () => ({
  __esModule: true,
  default: { checkNotInResetting: () => undefined },
}));
jest.mock('@onekeyhq/shared/src/utils/walletPresenceHintUtils', () => ({
  writeWalletPresenceHint: jest.fn(),
}));

function createAgent(initialWalletCount: number) {
  let walletCount = initialWalletCount;
  const order: string[] = [];
  const realm = {
    objects: jest.fn((name: ELocalDBStoreNames) => ({
      length: name === ELocalDBStoreNames.Wallet ? walletCount : 0,
    })),
    create: jest.fn(() => {
      walletCount += 1;
    }),
    delete: jest.fn(() => {
      walletCount -= 1;
    }),
    beginTransaction: jest.fn(),
    commitTransaction: jest.fn(() => order.push('commit')),
    cancelTransaction: jest.fn(() => order.push('cancel')),
  };
  const agent = new RealmDBAgent(realm as unknown as Realm);
  jest
    .spyOn(agent, 'checkSchemaPropertiesDefined')
    .mockImplementation(() => undefined);
  jest.mocked(writeWalletPresenceHint).mockImplementation((value) => {
    order.push(value === undefined ? 'invalidate' : `publish:${value}`);
  });
  return { agent, order };
}

const wallet = { id: 'hd-1' } as IDBWallet;
const bucket = EIndexedDBBucketNames.account;

it('invalidates before the first wallet commit and publishes presence after it', async () => {
  const { agent, order } = createAgent(3);
  await agent.withTransaction(bucket, (tx) =>
    agent.txAddRecords({
      tx,
      name: ELocalDBStoreNames.Wallet,
      records: [wallet],
    }),
  );
  expect(order).toEqual(['invalidate', 'commit', 'publish:true']);
});

it('updates the hint in the last wallet removal transaction', async () => {
  const { agent, order } = createAgent(4);
  await agent.withTransaction(bucket, (tx) =>
    agent.txRemoveRecords({
      tx,
      name: ELocalDBStoreNames.Wallet,
      recordPairs: [[wallet, null]],
    }),
  );
  expect(order).toEqual(['invalidate', 'commit', 'publish:false']);
});

it('skips hint writes when presence is unchanged or the transaction aborts', async () => {
  const { agent, order } = createAgent(4);
  await agent.withTransaction(bucket, (tx) =>
    agent.txAddRecords({
      tx,
      name: ELocalDBStoreNames.Wallet,
      records: [wallet],
    }),
  );
  await expect(
    agent.withTransaction(bucket, async (tx) => {
      await agent.txAddRecords({
        tx,
        name: ELocalDBStoreNames.Wallet,
        records: [wallet],
      });
      throw new OneKeyLocalError('transaction aborted');
    }),
  ).rejects.toThrow('transaction aborted');
  expect(order).toEqual(['commit', 'cancel']);
});
