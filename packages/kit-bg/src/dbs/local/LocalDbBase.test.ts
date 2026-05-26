import {
  ESecretEncryptPayloadFormat,
  decryptImportedCredentialWithMetadata,
  decryptRevealableSeedWithMetadata,
  decryptVerifyStringWithMetadata,
  encodePasswordAsync,
  encryptImportedCredential,
  encryptRevealableSeed,
  encryptStringAsync,
  encryptVerifyString,
} from '@onekeyhq/core/src/secret';
import {
  PBKDF2_CURRENT_NUM_OF_ITERATIONS,
  PBKDF2_LEGACY_NUM_OF_ITERATIONS,
} from '@onekeyhq/shared/src/appCrypto/consts';
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
  IDBCredentialBase,
  IDBWallet,
  ILocalDBTxAddRecordsParams,
  ILocalDBTxAddRecordsResult,
  ILocalDBTxGetAllRecordsParams,
  ILocalDBTxGetAllRecordsResult,
  ILocalDBTxUpdateRecordsParams,
} from './types';

class TestLocalDb extends LocalDbBase {
  override readyDb = Promise.resolve(this as any);

  context: IDBContext = {
    id: DB_MAIN_CONTEXT_ID,
    nextHD: 1,
    nextWalletNo: 1,
    verifyString: DEFAULT_VERIFY_STRING,
    localPasswordKdfUpgradedTargetIterations: 0,
    backupUUID: 'backup-uuid',
    nextSignatureMessageId: 1,
    nextSignatureTransactionId: 1,
    nextConnectedSiteId: 1,
  };

  wallets: IDBWallet[] = [];

  credentials: IDBCredentialBase[] = [];

  addHDNextIndexedAccountCalls = 0;

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
    this.addHDNextIndexedAccountCalls += 1;
    return { nextIndex: 0, indexedAccountId: 'indexed-account-0' };
  }

  override async txUpdateContext({
    updater,
  }: {
    updater: (ctx: IDBContext) => IDBContext | Promise<IDBContext>;
  }): Promise<void> {
    this.context = await updater({ ...this.context });
  }

  override async getAllCredentials(): Promise<IDBCredentialBase[]> {
    return this.credentials.map((credential) => ({ ...credential }));
  }

  override async txGetAllRecords<T extends ELocalDBStoreNames>({
    name,
  }: ILocalDBTxGetAllRecordsParams<T>): Promise<
    ILocalDBTxGetAllRecordsResult<T>
  > {
    if (name === ELocalDBStoreNames.Credential) {
      const records = this.credentials.map((credential) => ({
        ...credential,
      }));
      return {
        records: records as ILocalDBTxGetAllRecordsResult<T>['records'],
        recordPairs: records.map((record) => [
          record,
          null,
        ]) as ILocalDBTxGetAllRecordsResult<T>['recordPairs'],
      };
    }
    return {
      records: [],
      recordPairs: [],
    };
  }

  override async txUpdateRecords<T extends ELocalDBStoreNames>({
    name,
    ids = [],
    recordPairs,
    updater,
  }: ILocalDBTxUpdateRecordsParams<T>): Promise<void> {
    if (name === ELocalDBStoreNames.Context) {
      const updateContext = updater as (
        ctx: IDBContext,
      ) => IDBContext | Promise<IDBContext>;
      this.context = await updateContext({ ...this.context });
      return undefined;
    }

    if (name === ELocalDBStoreNames.Credential) {
      const updateCredential = updater as (
        credential: IDBCredentialBase,
      ) => IDBCredentialBase | Promise<IDBCredentialBase>;
      const recordPairIds =
        recordPairs?.map((pair) => pair[0].id).filter(Boolean) ?? [];
      const targetIds = ids.length ? ids : recordPairIds;
      this.credentials = await Promise.all(
        this.credentials.map(async (credential) => {
          if (targetIds.includes(credential.id)) {
            return updateCredential({ ...credential });
          }
          return credential;
        }),
      );
    }
    return undefined;
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
    expect(db.addHDNextIndexedAccountCalls).toBe(1);

    const botWallet = await db.createHDWallet(
      buildParams({
        overrideWalletId: 'hd-bot--hd-keyless-test-parent--0',
      }),
    );
    expect(botWallet.wallet.id).toBe('hd-bot--hd-keyless-test-parent--0');
    expect(botWallet.wallet.walletNo).toBe(2);
    expect(db.context.nextHD).toBe(2);
    expect(db.context.nextWalletNo).toBe(3);
    expect(db.addHDNextIndexedAccountCalls).toBe(1);

    const nextRegularWallet = await db.createHDWallet(buildParams());
    expect(nextRegularWallet.wallet.id).toBe('hd-2');
    expect(nextRegularWallet.wallet.walletNo).toBe(3);
    expect(db.context.nextHD).toBe(3);
    expect(db.context.nextWalletNo).toBe(4);
    expect(db.addHDNextIndexedAccountCalls).toBe(2);
  });
});

describe('LocalDbBase.lazyUpgradeLocalPasswordEncryptedRecords', () => {
  it('upgrades legacy verifyString and credentials to v2', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    const revealableSeed = {
      entropyWithLangPrefixed: 'english:00010203',
      seed: 'seed-hex',
    };
    const importedCredential = {
      privateKey: 'private-key-hex',
    };

    db.context.verifyString = await encryptVerifyString({
      password,
      format: ESecretEncryptPayloadFormat.legacy,
    });
    db.credentials = [
      {
        id: 'hd-1',
        credential: await encryptRevealableSeed({
          rs: revealableSeed,
          password,
          format: ESecretEncryptPayloadFormat.legacy,
        }),
      },
      {
        id: 'imported-1',
        credential: await encryptImportedCredential({
          credential: importedCredential,
          password,
          format: ESecretEncryptPayloadFormat.legacy,
        }),
      },
      {
        id: 'hyperliquid-agent-1',
        credential: '|HLP|{"privateKey":"plain","userAddress":"0x1"}',
      },
    ];

    await db.lazyUpgradeLocalPasswordEncryptedRecords({ password });

    const verifyStringResult = await decryptVerifyStringWithMetadata({
      password,
      verifyString: db.context.verifyString,
    });
    expect(db.context.localPasswordKdfUpgraded).toBe(true);
    expect(verifyStringResult.needsUpgrade).toBe(false);
    expect(verifyStringResult.plaintext).toBe(DEFAULT_VERIFY_STRING);

    const hdCredentialResult = await decryptRevealableSeedWithMetadata({
      password,
      rs: db.credentials[0].credential,
    });
    expect(hdCredentialResult.needsUpgrade).toBe(false);
    expect(hdCredentialResult.plaintext).toEqual(revealableSeed);

    expect(db.credentials[2].credential).toBe(
      '|HLP|{"privateKey":"plain","userAddress":"0x1"}',
    );
  });

  it('does not overwrite a credential changed during lazy upgrade', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    const originalCredential = await encryptRevealableSeed({
      rs: {
        entropyWithLangPrefixed: 'english:00010203',
        seed: 'seed-hex',
      },
      password,
      format: ESecretEncryptPayloadFormat.legacy,
    });
    const concurrentCredential = await encryptRevealableSeed({
      rs: {
        entropyWithLangPrefixed: 'english:04050607',
        seed: 'seed-hex-2',
      },
      password,
    });
    db.credentials = [{ id: 'hd-1', credential: originalCredential }];

    const txUpdateRecords = db.txUpdateRecords.bind(db);
    db.txUpdateRecords = jest.fn(
      async <T extends ELocalDBStoreNames>(
        params: ILocalDBTxUpdateRecordsParams<T>,
      ) => {
        if (params.name === ELocalDBStoreNames.Credential) {
          db.credentials[0].credential = concurrentCredential;
        }
        await txUpdateRecords(params);
      },
    ) as TestLocalDb['txUpdateRecords'];

    await db.lazyUpgradeCredentialIfNeeded({
      credential: { ...db.credentials[0] },
      password,
    });

    expect(db.credentials[0].credential).toBe(concurrentCredential);
  });

  it('limits each lazy upgrade run to one small credential batch', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    const revealableSeed = {
      entropyWithLangPrefixed: 'english:00010203',
      seed: 'seed-hex',
    };
    db.credentials = await Promise.all(
      Array.from({ length: 5 }, async (_, index) => ({
        id: `hd-${index + 1}`,
        credential: await encryptRevealableSeed({
          rs: revealableSeed,
          password,
          format: ESecretEncryptPayloadFormat.legacy,
        }),
      })),
    );

    await db.lazyUpgradeLocalPasswordEncryptedRecords({ password });

    const metadataList = await Promise.all(
      db.credentials.map((credential) =>
        decryptRevealableSeedWithMetadata({
          password,
          rs: credential.credential,
        }),
      ),
    );
    expect(
      metadataList.filter((metadata) => !metadata.needsUpgrade),
    ).toHaveLength(3);
    expect(
      metadataList.filter((metadata) => metadata.needsUpgrade),
    ).toHaveLength(2);
    expect(db._localPasswordKdfLazyUpgradeExecuted).toBe(false);
    expect(db.context.localPasswordKdfUpgraded).toBeFalsy();
    expect(db.context.localPasswordKdfUpgradeLastScannedCredentialId).toBe(
      'hd-3',
    );

    const candidateSpy = jest.spyOn(
      db,
      'isLocalPasswordKdfCredentialUpgradeCandidate',
    );
    await db.lazyUpgradeLocalPasswordEncryptedRecords({ password });

    expect(candidateSpy).toHaveBeenCalledTimes(2);
    expect(db.context.localPasswordKdfUpgraded).toBe(true);
    expect(db.context.localPasswordKdfUpgradedTargetIterations).toBe(
      PBKDF2_CURRENT_NUM_OF_ITERATIONS,
    );
    expect(db.context.localPasswordKdfUpgradeLastScannedCredentialId).toBe('');
  });

  it('upgrades v2 credentials below the current platform target iterations', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    const revealableSeed = {
      entropyWithLangPrefixed: 'english:00010203',
      seed: 'seed-hex',
    };
    const lowIterationCredential = await encryptStringAsync({
      password,
      data: JSON.stringify(revealableSeed),
      dataEncoding: 'utf8',
      format: ESecretEncryptPayloadFormat.v2,
      iterations: PBKDF2_LEGACY_NUM_OF_ITERATIONS,
      dataType: 'local-revealable-seed',
    });
    db.credentials = [
      {
        id: 'hd-1',
        credential: `|RP|${lowIterationCredential}`,
      },
    ];

    expect(
      db.isLocalPasswordKdfCredentialUpgradeCandidate({
        credential: db.credentials[0],
      }),
    ).toBe(true);

    await db.lazyUpgradeLocalPasswordEncryptedRecords({ password });

    const hdCredentialResult = await decryptRevealableSeedWithMetadata({
      password,
      rs: db.credentials[0].credential,
    });
    expect(hdCredentialResult.needsUpgrade).toBe(false);
    expect(hdCredentialResult.iterations).toBe(
      PBKDF2_CURRENT_NUM_OF_ITERATIONS,
    );
    expect(hdCredentialResult.plaintext).toEqual(revealableSeed);
    expect(
      db.isLocalPasswordKdfCredentialUpgradeCandidate({
        credential: db.credentials[0],
      }),
    ).toBe(false);
    expect(db.context.localPasswordKdfUpgradedTargetIterations).toBe(
      PBKDF2_CURRENT_NUM_OF_ITERATIONS,
    );
  });

  it('skips credential detection after the target-aware persistent upgrade marker is set', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    db.context.localPasswordKdfUpgraded = true;
    db.context.localPasswordKdfUpgradedTargetIterations =
      PBKDF2_CURRENT_NUM_OF_ITERATIONS;
    db.credentials = [
      {
        id: 'hd-1',
        credential: await encryptRevealableSeed({
          rs: {
            entropyWithLangPrefixed: 'english:00010203',
            seed: 'seed-hex',
          },
          password,
          format: ESecretEncryptPayloadFormat.legacy,
        }),
      },
    ];
    const getAllCredentialsSpy = jest.spyOn(db, 'getAllCredentials');

    await db.lazyUpgradeLocalPasswordEncryptedRecords({ password });

    expect(getAllCredentialsSpy).not.toHaveBeenCalled();
    expect(db._localPasswordKdfLazyUpgradeExecuted).toBe(true);
  });

  it('does not skip lazy upgrade when the persistent marker target is stale', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    const revealableSeed = {
      entropyWithLangPrefixed: 'english:00010203',
      seed: 'seed-hex',
    };
    const lowIterationCredential = await encryptStringAsync({
      password,
      data: JSON.stringify(revealableSeed),
      dataEncoding: 'utf8',
      format: ESecretEncryptPayloadFormat.v2,
      iterations: PBKDF2_LEGACY_NUM_OF_ITERATIONS,
      dataType: 'local-revealable-seed',
    });
    db.context.localPasswordKdfUpgraded = true;
    db.context.localPasswordKdfUpgradedTargetIterations =
      PBKDF2_LEGACY_NUM_OF_ITERATIONS;
    db.credentials = [
      {
        id: 'hd-1',
        credential: `|RP|${lowIterationCredential}`,
      },
    ];
    const getAllCredentialsSpy = jest.spyOn(db, 'getAllCredentials');

    await db.lazyUpgradeLocalPasswordEncryptedRecords({ password });

    expect(getAllCredentialsSpy).toHaveBeenCalled();
    expect(db.context.localPasswordKdfUpgraded).toBe(true);
    expect(db.context.localPasswordKdfUpgradedTargetIterations).toBe(
      PBKDF2_CURRENT_NUM_OF_ITERATIONS,
    );
    const hdCredentialResult = await decryptRevealableSeedWithMetadata({
      password,
      rs: db.credentials[0].credential,
    });
    expect(hdCredentialResult.needsUpgrade).toBe(false);
    expect(hdCredentialResult.iterations).toBe(
      PBKDF2_CURRENT_NUM_OF_ITERATIONS,
    );
  });
});

describe('LocalDbBase.updatePassword', () => {
  it('precomputes credential encryption before transaction and updates records', async () => {
    const db = new TestLocalDb();
    const oldPassword = await encodePasswordAsync({ password: 'old-password' });
    const newPassword = await encodePasswordAsync({ password: 'new-password' });
    const revealableSeed = {
      entropyWithLangPrefixed: 'english:00010203',
      seed: 'seed-hex',
    };
    const importedCredential = {
      privateKey: 'private-key-hex',
    };
    db.context.verifyString = await encryptVerifyString({
      password: oldPassword,
    });
    db.credentials = [
      {
        id: 'hd-1',
        credential: await encryptRevealableSeed({
          rs: revealableSeed,
          password: oldPassword,
        }),
      },
      {
        id: 'imported-1',
        credential: await encryptImportedCredential({
          credential: importedCredential,
          password: oldPassword,
        }),
      },
      {
        id: 'hyperliquid-agent-1',
        credential: '|HLP|{"privateKey":"plain","userAddress":"0x1"}',
      },
    ];

    const credentialUpdaterReturnedPromise: boolean[] = [];
    const txUpdateRecords = db.txUpdateRecords.bind(db);
    db.txUpdateRecords = jest.fn(
      async <T extends ELocalDBStoreNames>(
        params: ILocalDBTxUpdateRecordsParams<T>,
      ) => {
        if (params.name === ELocalDBStoreNames.Credential) {
          const originalUpdater = params.updater;
          await txUpdateRecords({
            ...params,
            updater: ((record) => {
              const result = originalUpdater(record);
              credentialUpdaterReturnedPromise.push(
                Boolean(
                  result &&
                  typeof (result as { then?: unknown }).then === 'function',
                ),
              );
              return result;
            }) as ILocalDBTxUpdateRecordsParams<T>['updater'],
          });
          return undefined;
        }
        return txUpdateRecords(params);
      },
    ) as TestLocalDb['txUpdateRecords'];

    await db.updatePassword({ oldPassword, newPassword });

    expect(credentialUpdaterReturnedPromise).toEqual([false, false]);
    const verifyStringResult = await decryptVerifyStringWithMetadata({
      password: newPassword,
      verifyString: db.context.verifyString,
    });
    expect(verifyStringResult.plaintext).toBe(DEFAULT_VERIFY_STRING);

    const hdCredentialResult = await decryptRevealableSeedWithMetadata({
      password: newPassword,
      rs: db.credentials[0].credential,
    });
    expect(hdCredentialResult.plaintext).toEqual(revealableSeed);

    const importedCredentialResult =
      await decryptImportedCredentialWithMetadata({
        password: newPassword,
        credential: db.credentials[1].credential,
      });
    expect(importedCredentialResult.plaintext).toEqual(importedCredential);
    expect(db.credentials[2].credential).toBe(
      '|HLP|{"privateKey":"plain","userAddress":"0x1"}',
    );
  });

  it('aborts if credentials change after password update precomputation', async () => {
    const db = new TestLocalDb();
    const oldPassword = await encodePasswordAsync({ password: 'old-password' });
    const newPassword = await encodePasswordAsync({ password: 'new-password' });
    const revealableSeed = {
      entropyWithLangPrefixed: 'english:00010203',
      seed: 'seed-hex',
    };
    const concurrentRevealableSeed = {
      entropyWithLangPrefixed: 'english:04050607',
      seed: 'seed-hex-2',
    };
    db.context.verifyString = await encryptVerifyString({
      password: oldPassword,
    });
    db.credentials = [
      {
        id: 'hd-1',
        credential: await encryptRevealableSeed({
          rs: revealableSeed,
          password: oldPassword,
        }),
      },
    ];

    const buildAllCredentialsPasswordUpdates =
      db.buildAllCredentialsPasswordUpdates.bind(db);
    db.buildAllCredentialsPasswordUpdates = jest.fn(async (params) => {
      const prepared = await buildAllCredentialsPasswordUpdates(params);
      db.credentials.push({
        id: 'hd-2',
        credential: await encryptRevealableSeed({
          rs: concurrentRevealableSeed,
          password: oldPassword,
        }),
      });
      return prepared;
    }) as TestLocalDb['buildAllCredentialsPasswordUpdates'];

    await expect(
      db.updatePassword({ oldPassword, newPassword }),
    ).rejects.toThrow('credentials changed during password update');

    const verifyStringResult = await decryptVerifyStringWithMetadata({
      password: oldPassword,
      verifyString: db.context.verifyString,
    });
    expect(verifyStringResult.plaintext).toBe(DEFAULT_VERIFY_STRING);

    const hdCredentialResult = await decryptRevealableSeedWithMetadata({
      password: oldPassword,
      rs: db.credentials[0].credential,
    });
    expect(hdCredentialResult.plaintext).toEqual(revealableSeed);
  });
});
