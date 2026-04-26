import {
  DB_MAIN_CONTEXT_ID,
  DEFAULT_VERIFY_STRING,
} from '@onekeyhq/shared/src/consts/dbConsts';

import { LocalDbBase } from './LocalDbBase';
import { ELocalDBStoreNames } from './localDBStoreNames';

import type {
  EIndexedDBBucketNames,
  IDBContext,
  IDBCreateHDWalletParams,
  IDBWallet,
  ILocalDBTxAddRecordsParams,
  ILocalDBTxAddRecordsResult,
} from './types';

class TestLocalDb extends LocalDbBase {
  override readyDb = Promise.resolve(this as any);

  context: IDBContext = {
    id: DB_MAIN_CONTEXT_ID,
    nextHD: 1,
    nextWalletNo: 1,
    verifyString: DEFAULT_VERIFY_STRING,
    backupUUID: 'backup-uuid',
    nextSignatureMessageId: 1,
    nextSignatureTransactionId: 1,
    nextConnectedSiteId: 1,
  };

  wallets: IDBWallet[] = [];

  constructor() {
    super();

    this.setBackgroundApi({
      servicePrimeCloudSync: {
        syncManagers: {
          wallet: {
            buildExistingSyncItemsInfo: jest.fn(async () => ({
              existingSyncItems: {},
              newSyncItems: {},
            })),
            txWithSyncFlowOfDBRecordCreating: jest.fn(
              async ({ runDbTxFn }: { runDbTxFn: () => Promise<void> }) =>
                runDbTxFn(),
            ),
          },
        },
      },
    } as any);
  }

  override async reset(): Promise<void> {
    return undefined;
  }

  override async getContext(): Promise<IDBContext> {
    return { ...this.context };
  }

  override async withTransaction<T>(
    _bucketName: EIndexedDBBucketNames,
    task: (tx: any) => Promise<T>,
  ): Promise<T> {
    return task({});
  }

  override async txAddRecords<T extends ELocalDBStoreNames>({
    name,
    records,
  }: ILocalDBTxAddRecordsParams<T>): Promise<ILocalDBTxAddRecordsResult> {
    if (name === ELocalDBStoreNames.Wallet) {
      this.wallets.push(...(records as IDBWallet[]));
    }
    return {
      added: records.length,
      addedIds: records.map((record) => record.id),
      skipped: 0,
    };
  }

  override async txAddHDNextIndexedAccount(): Promise<{
    nextIndex: number;
    indexedAccountId: string;
  }> {
    return { nextIndex: 0, indexedAccountId: 'indexed-account-0' };
  }

  override async txUpdateContext({
    updater,
  }: {
    updater: (ctx: IDBContext) => IDBContext | Promise<IDBContext>;
  }): Promise<void> {
    this.context = await updater({ ...this.context });
  }

  override async buildCreateHDAndHWWalletResult({
    walletId,
  }: {
    walletId: string;
  }) {
    return {
      wallet: this.wallets.find((wallet) => wallet.id === walletId)!,
      indexedAccount: undefined,
      device: undefined,
      isOverrideWallet: undefined,
    };
  }
}

function buildParams(
  overrides: Partial<IDBCreateHDWalletParams> = {},
): IDBCreateHDWalletParams {
  return {
    password: 'test-password',
    rs: 'encrypted-seed' as any,
    backuped: true,
    walletHash: 'wallet-hash',
    walletXfp: 'wallet-xfp',
    ...overrides,
  };
}

describe('LocalDbBase.createHDWallet', () => {
  it('keeps nextHD stable while preserving unique walletNo for override wallet ids', async () => {
    const db = new TestLocalDb();

    const regularWallet = await db.createHDWallet(buildParams());
    expect(regularWallet.wallet.id).toBe('hd-1');
    expect(regularWallet.wallet.walletNo).toBe(1);
    expect(db.context.nextHD).toBe(2);
    expect(db.context.nextWalletNo).toBe(2);

    const botWallet = await db.createHDWallet(
      buildParams({
        overrideWalletId: 'hd-bot--hd-keyless-test-parent--0',
      }),
    );
    expect(botWallet.wallet.id).toBe('hd-bot--hd-keyless-test-parent--0');
    expect(botWallet.wallet.walletNo).toBe(2);
    expect(db.context.nextHD).toBe(2);
    expect(db.context.nextWalletNo).toBe(3);

    const nextRegularWallet = await db.createHDWallet(buildParams());
    expect(nextRegularWallet.wallet.id).toBe('hd-2');
    expect(nextRegularWallet.wallet.walletNo).toBe(3);
    expect(db.context.nextHD).toBe(3);
    expect(db.context.nextWalletNo).toBe(4);
  });
});
