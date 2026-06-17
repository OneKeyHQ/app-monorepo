import { IDBFactory } from 'fake-indexeddb';

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
  WALLET_TYPE_IMPORTED,
} from '@onekeyhq/shared/src/consts/dbConsts';
import {
  LocalSecretEnvelopeUnavailable,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';

import { EDBAccountType } from './consts';
import { LocalDbBase } from './LocalDbBase';
import { ELocalDBStoreNames } from './localDBStoreNames';
import {
  buildIndexedDbCryptoKeyLocalSecretEnvelopeLayerAdapter,
  isLocalSecretEnvelopeString,
  parseLocalSecretEnvelopeV1,
  readIndexedDbCryptoKeyForLocalSecretEnvelope,
} from './localSecretEnvelope';

import type {
  ILocalSecretEnvelopeLayerAdapter,
  ILocalSecretEnvelopeLayerKind,
} from './localSecretEnvelope';
import type {
  EIndexedDBBucketNames,
  IDBAccount,
  IDBContext,
  IDBCreateHDWalletParams,
  IDBCredentialBase,
  IDBWallet,
  ILocalDBGetRecordByIdParams,
  ILocalDBGetRecordByIdResult,
  ILocalDBGetRecordsByIdsParams,
  ILocalDBGetRecordsByIdsResult,
  ILocalDBTxAddRecordsParams,
  ILocalDBTxAddRecordsResult,
  ILocalDBTxGetAllRecordsParams,
  ILocalDBTxGetAllRecordsResult,
  ILocalDBTxUpdateRecordsParams,
} from './types';

function buildNoopSyncManager() {
  return {
    buildExistingSyncItemsInfo: jest.fn(async () => ({
      existingSyncItems: {},
      newSyncItems: {},
    })),
    txWithSyncFlowOfDBRecordCreating: jest.fn(
      async ({ runDbTxFn }: { runDbTxFn: () => Promise<void> }) => runDbTxFn(),
    ),
  };
}

class TestLocalDb extends LocalDbBase {
  override readyDb = Promise.resolve(this as any);

  context: IDBContext = {
    id: DB_MAIN_CONTEXT_ID,
    nextHD: 1,
    nextWalletNo: 1,
    verifyString: DEFAULT_VERIFY_STRING,
    localPasswordKdfUpgradedTargetIterations: 0,
    localSecretEnvelopeCredentialMigrated: false,
    localSecretEnvelopeCredentialMigratedTargetVersion: 0,
    localSecretEnvelopeCredentialMigrationLastScannedCredentialId: '',
    backupUUID: 'backup-uuid',
    nextSignatureMessageId: 1,
    nextSignatureTransactionId: 1,
    nextConnectedSiteId: 1,
  };

  wallets: IDBWallet[] = [];

  accounts: IDBAccount[] = [];

  credentials: IDBCredentialBase[] = [];

  addHDNextIndexedAccountCalls = 0;

  constructor() {
    super();

    this.setBackgroundApi({
      servicePrimeCloudSync: {
        syncManagers: {
          wallet: buildNoopSyncManager(),
          account: buildNoopSyncManager(),
        },
      },
    } as any);
  }

  override async reset(): Promise<void> {
    return undefined;
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
    skipIfExists,
  }: ILocalDBTxAddRecordsParams<T>): Promise<ILocalDBTxAddRecordsResult> {
    if (name === ELocalDBStoreNames.Wallet) {
      const recordsToAdd = (records as IDBWallet[]).filter(
        (record) =>
          !skipIfExists || !this.wallets.some((item) => item.id === record.id),
      );
      this.wallets.push(...recordsToAdd);
      return {
        added: recordsToAdd.length,
        addedIds: recordsToAdd.map((record) => record.id),
        skipped: records.length - recordsToAdd.length,
      };
    }
    if (name === ELocalDBStoreNames.Account) {
      const recordsToAdd = (records as IDBAccount[]).filter(
        (record) =>
          !skipIfExists || !this.accounts.some((item) => item.id === record.id),
      );
      this.accounts.push(...recordsToAdd);
      return {
        added: recordsToAdd.length,
        addedIds: recordsToAdd.map((record) => record.id),
        skipped: records.length - recordsToAdd.length,
      };
    }
    if (name === ELocalDBStoreNames.Credential) {
      const recordsToAdd = (records as IDBCredentialBase[]).filter(
        (record) =>
          !skipIfExists ||
          !this.credentials.some((item) => item.id === record.id),
      );
      this.credentials.push(...recordsToAdd);
      return {
        added: recordsToAdd.length,
        addedIds: recordsToAdd.map((record) => record.id),
        skipped: records.length - recordsToAdd.length,
      };
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

  override async getRecordById<T extends ELocalDBStoreNames>({
    name,
    id,
  }: ILocalDBGetRecordByIdParams<T>): Promise<ILocalDBGetRecordByIdResult<T>> {
    if (name === ELocalDBStoreNames.Context) {
      return { ...this.context } as ILocalDBGetRecordByIdResult<T>;
    }

    if (name === ELocalDBStoreNames.Wallet) {
      const wallet = this.wallets.find((item) => item.id === id);
      if (!wallet) {
        throw new OneKeyLocalError('Test wallet not found');
      }
      return { ...wallet } as ILocalDBGetRecordByIdResult<T>;
    }

    if (name === ELocalDBStoreNames.Account) {
      const account = this.accounts.find((item) => item.id === id);
      if (!account) {
        throw new OneKeyLocalError('Test account not found');
      }
      return { ...account } as ILocalDBGetRecordByIdResult<T>;
    }

    if (name === ELocalDBStoreNames.Credential) {
      const credential = this.credentials.find((item) => item.id === id);
      if (!credential) {
        throw new OneKeyLocalError('Test credential not found');
      }
      return { ...credential } as ILocalDBGetRecordByIdResult<T>;
    }

    throw new OneKeyLocalError('Test record not found');
  }

  override async getWallet({
    walletId,
  }: {
    walletId: string;
  }): Promise<IDBWallet> {
    const wallet = this.wallets.find((item) => item.id === walletId);
    if (!wallet) {
      throw new OneKeyLocalError('Test wallet not found');
    }
    return { ...wallet };
  }

  override async getRecordsByIds<T extends ELocalDBStoreNames>({
    name,
    ids,
  }: ILocalDBGetRecordsByIdsParams<T>): Promise<
    ILocalDBGetRecordsByIdsResult<T>
  > {
    if (name === ELocalDBStoreNames.Account) {
      return {
        records: ids.map((id) => {
          const account = this.accounts.find((item) => item.id === id);
          return account
            ? ({
                ...account,
              } as ILocalDBGetRecordsByIdsResult<T>['records'][number])
            : undefined;
        }),
      };
    }
    return { records: [] };
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

    if (name === ELocalDBStoreNames.Wallet) {
      const updateWallet = updater as (
        wallet: IDBWallet,
      ) => IDBWallet | Promise<IDBWallet>;
      this.wallets = await Promise.all(
        this.wallets.map(async (wallet) => {
          if (ids.includes(wallet.id)) {
            return updateWallet({ ...wallet });
          }
          return wallet;
        }),
      );
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

function encodeMockLocalSecretEnvelopeLayerPayload({
  aad,
  kind,
  keyRef,
  plaintext,
}: {
  aad: string;
  kind: ILocalSecretEnvelopeLayerKind;
  keyRef: string;
  plaintext: string;
}): string {
  return Buffer.from(
    JSON.stringify({
      aad,
      kind,
      keyRef,
      plaintext,
    }),
    'utf8',
  ).toString('base64');
}

function decodeMockLocalSecretEnvelopeLayerPayload(value: string): {
  aad: string;
  kind: ILocalSecretEnvelopeLayerKind;
  keyRef: string;
  plaintext: string;
} {
  const parsed = JSON.parse(Buffer.from(value, 'base64').toString('utf8')) as {
    aad?: unknown;
    kind?: unknown;
    keyRef?: unknown;
    plaintext?: unknown;
  };
  if (
    typeof parsed.aad !== 'string' ||
    typeof parsed.kind !== 'string' ||
    typeof parsed.keyRef !== 'string' ||
    typeof parsed.plaintext !== 'string'
  ) {
    throw new OneKeyLocalError('Invalid mock local secret envelope payload');
  }
  return {
    aad: parsed.aad,
    kind: parsed.kind as ILocalSecretEnvelopeLayerKind,
    keyRef: parsed.keyRef,
    plaintext: parsed.plaintext,
  };
}

function buildMockLocalSecretEnvelopeLayerAdapter({
  deleteLayerKey,
  failDecrypt,
  failEncrypt,
}: {
  deleteLayerKey?: ILocalSecretEnvelopeLayerAdapter['deleteLayerKey'];
  failDecrypt?: boolean;
  failEncrypt?: boolean;
} = {}): ILocalSecretEnvelopeLayerAdapter {
  const kind = 'indexeddb-cryptokey';
  const keyRef = 'indexeddb:test-device-key:v1';
  return {
    kind,
    prepareLayer: async () => ({
      kind,
      keyRef,
      alg: 'AES-256-GCM',
      iv: 'test-iv',
      capabilities: {
        sync: 'unknown',
        extractable: false,
        keyAccess: 'opaque-decrypt',
      },
    }),
    encrypt: async ({ aad, layer, plaintext }) => {
      if (failEncrypt) {
        throw new OneKeyLocalError('Mock LSE encrypt failed');
      }
      return encodeMockLocalSecretEnvelopeLayerPayload({
        aad,
        kind: layer.kind,
        keyRef: layer.keyRef,
        plaintext,
      });
    },
    encryptWithExistingKey: async ({ aad, layer, plaintext }) => {
      if (failEncrypt) {
        throw new OneKeyLocalError('Mock LSE encrypt failed');
      }
      return encodeMockLocalSecretEnvelopeLayerPayload({
        aad,
        kind: layer.kind,
        keyRef: layer.keyRef,
        plaintext,
      });
    },
    decrypt: async ({ aad, ciphertext, layer }) => {
      if (failDecrypt) {
        throw new OneKeyLocalError('Mock LSE decrypt failed');
      }
      const payload = decodeMockLocalSecretEnvelopeLayerPayload(ciphertext);
      if (
        payload.aad !== aad ||
        payload.kind !== layer.kind ||
        payload.keyRef !== layer.keyRef
      ) {
        throw new OneKeyLocalError('Mock LSE decrypt failed');
      }
      return payload.plaintext;
    },
    deleteLayerKey,
  };
}

describe('LocalDbBase.createHDWallet', () => {
  it('keeps nextHD stable while preserving unique walletNo for override wallet ids', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    db.context.verifyString = await encryptVerifyString({ password });
    jest
      .spyOn(db, 'runPostPasswordVerifiedLazyUpgrade')
      .mockImplementation(jest.fn());

    const regularWallet = await db.createHDWallet(buildParams({ password }));
    expect(regularWallet.wallet.id).toBe('hd-1');
    expect(regularWallet.wallet.walletNo).toBe(1);
    expect(db.context.nextHD).toBe(2);
    expect(db.context.nextWalletNo).toBe(2);
    expect(db.addHDNextIndexedAccountCalls).toBe(1);

    const botWallet = await db.createHDWallet(
      buildParams({
        password,
        overrideWalletId: 'hd-bot--hd-keyless-test-parent--0',
      }),
    );
    expect(botWallet.wallet.id).toBe('hd-bot--hd-keyless-test-parent--0');
    expect(botWallet.wallet.walletNo).toBe(2);
    expect(db.context.nextHD).toBe(2);
    expect(db.context.nextWalletNo).toBe(3);
    expect(db.addHDNextIndexedAccountCalls).toBe(1);

    const nextRegularWallet = await db.createHDWallet(
      buildParams({ password }),
    );
    expect(nextRegularWallet.wallet.id).toBe('hd-2');
    expect(nextRegularWallet.wallet.walletNo).toBe(3);
    expect(db.context.nextHD).toBe(3);
    expect(db.context.nextWalletNo).toBe(4);
    expect(db.addHDNextIndexedAccountCalls).toBe(2);
  });

  it('stores a newly created HD credential as LSE after migration is complete', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    db.context.verifyString = await encryptVerifyString({ password });
    db.context.localPasswordKdfUpgraded = true;
    db.context.localPasswordKdfUpgradedTargetIterations =
      PBKDF2_CURRENT_NUM_OF_ITERATIONS;
    db.context.localSecretEnvelopeCredentialMigrated = true;
    db.context.localSecretEnvelopeCredentialMigratedTargetVersion = 1;
    const revealableSeed = {
      entropyWithLangPrefixed: 'english:00010203',
      seed: 'seed-hex',
    };
    const rs = await encryptRevealableSeed({
      rs: revealableSeed,
      password,
    });
    const adapter = buildMockLocalSecretEnvelopeLayerAdapter();
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue({
        layerAdapters: [adapter],
        strength: 'profile-bound',
      });
    const postVerifySpy = jest
      .spyOn(db, 'runPostPasswordVerifiedLazyUpgrade')
      .mockImplementation(jest.fn());

    const result = await db.createHDWallet(buildParams({ password, rs }));
    const storedCredential = db.credentials.find(
      (credential) => credential.id === result.wallet.id,
    );

    expect(postVerifySpy).toHaveBeenCalledTimes(1);
    expect(storedCredential).toBeDefined();
    expect(
      isLocalSecretEnvelopeString(storedCredential?.credential || ''),
    ).toBe(true);
    const innerCredential = await db.getCredentialInner({
      credentialId: result.wallet.id,
      resolveLayerAdapter: (layer) =>
        layer.kind === adapter.kind ? adapter : undefined,
    });
    expect(innerCredential.credential).toBe(rs);
  });
});

describe('LocalDbBase local secret envelope credentials', () => {
  it('starts post-password lazy upgrade after getContext verifies the password', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    db.context.verifyString = await encryptVerifyString({ password });
    const postVerifySpy = jest
      .spyOn(db, 'runPostPasswordVerifiedLazyUpgrade')
      .mockImplementation(jest.fn());

    await expect(db.getContext({ verifyPassword: password })).resolves.toEqual(
      db.context,
    );

    expect(postVerifySpy).toHaveBeenCalledTimes(1);
    expect(postVerifySpy).toHaveBeenCalledWith({ password });
  });

  it('can verify getContext without starting post-password lazy upgrade', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    db.context.verifyString = await encryptVerifyString({ password });
    const postVerifySpy = jest
      .spyOn(db, 'runPostPasswordVerifiedLazyUpgrade')
      .mockImplementation(jest.fn());

    await expect(
      db.getContext({ verifyPassword: password, skipLazyUpgrade: true }),
    ).resolves.toEqual(db.context);

    expect(postVerifySpy).not.toHaveBeenCalled();
  });

  it('migrates a current-KDF credential to LSE and reads the inner credential explicitly', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    const revealableSeed = {
      entropyWithLangPrefixed: 'english:00010203',
      seed: 'seed-hex',
    };
    const credential = await encryptRevealableSeed({
      rs: revealableSeed,
      password,
    });
    db.credentials = [{ id: 'hd-1', credential }];
    const adapter = buildMockLocalSecretEnvelopeLayerAdapter();

    const result = await db.migrateCredentialToLocalSecretEnvelopeIfNeeded({
      credential: await db.getCredentialRaw('hd-1'),
      layerAdapters: [adapter],
      strength: 'profile-bound',
    });

    expect(result).toEqual({ migrated: true });
    expect(isLocalSecretEnvelopeString(db.credentials[0].credential)).toBe(
      true,
    );
    expect(
      parseLocalSecretEnvelopeV1(db.credentials[0].credential),
    ).toMatchObject({
      dataType: 'credential',
      recordId: 'hd-1',
      strength: 'profile-bound',
    });

    const rawCredential = await db.getCredential('hd-1');
    expect(rawCredential.credential).toBe(db.credentials[0].credential);

    const innerCredential = await db.getCredentialInner({
      credentialId: 'hd-1',
      resolveLayerAdapter: (layer) =>
        layer.kind === adapter.kind ? adapter : undefined,
    });
    expect(innerCredential.credential).toBe(credential);

    const decrypted = await decryptRevealableSeedWithMetadata({
      password,
      rs: innerCredential.credential,
    });
    expect(decrypted.plaintext).toEqual(revealableSeed);
  });

  it('wraps a new imported credential on write when LSE is available', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    db.context.localPasswordKdfUpgraded = true;
    db.context.localPasswordKdfUpgradedTargetIterations =
      PBKDF2_CURRENT_NUM_OF_ITERATIONS;
    const importedCredential = await encryptImportedCredential({
      credential: { privateKey: 'private-key-hex' },
      password,
    });
    const adapter = buildMockLocalSecretEnvelopeLayerAdapter();
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue({
        layerAdapters: [adapter],
        strength: 'profile-bound',
      });

    const wrappedCredential =
      await db.wrapNewCredentialWithLocalSecretEnvelopeIfNeeded({
        credentialId: 'imported--60--public-key',
        credential: importedCredential,
      });

    expect(isLocalSecretEnvelopeString(wrappedCredential)).toBe(true);
    db.credentials = [
      {
        id: 'imported--60--public-key',
        credential: wrappedCredential,
      },
    ];
    const innerCredential = await db.getCredentialInner({
      credentialId: 'imported--60--public-key',
      resolveLayerAdapter: (layer) =>
        layer.kind === adapter.kind ? adapter : undefined,
    });
    expect(innerCredential.credential).toBe(importedCredential);
  });

  it('stores restored imported account credentials as LSE after migration is complete', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    db.context.localPasswordKdfUpgraded = true;
    db.context.localPasswordKdfUpgradedTargetIterations =
      PBKDF2_CURRENT_NUM_OF_ITERATIONS;
    db.context.localSecretEnvelopeCredentialMigrated = true;
    db.context.localSecretEnvelopeCredentialMigratedTargetVersion = 1;
    db.wallets = [
      db.buildSingletonWalletRecord({ walletId: WALLET_TYPE_IMPORTED }),
    ];
    const accountId = 'imported--60--public-key';
    const importedCredential = await encryptImportedCredential({
      credential: { privateKey: 'private-key-hex' },
      password,
    });
    const adapter = buildMockLocalSecretEnvelopeLayerAdapter();
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue({
        layerAdapters: [adapter],
        strength: 'profile-bound',
      });

    const restoredAccount: IDBAccount = {
      id: accountId,
      name: 'Imported Account',
      type: EDBAccountType.SIMPLE,
      path: '',
      coinType: '60',
      impl: 'evm',
      createAtNetwork: 'evm--1',
      pub: 'public-key',
      address: '0x0000000000000000000000000000000000000001',
    };

    await db.addAccountsToWallet({
      walletId: WALLET_TYPE_IMPORTED,
      importedCredential,
      applyRestoreSyncPolicy: true,
      skipEventEmit: true,
      accounts: [restoredAccount],
    });

    const storedCredential = db.credentials.find(
      (credential) => credential.id === accountId,
    );
    expect(storedCredential).toBeDefined();
    expect(
      isLocalSecretEnvelopeString(storedCredential?.credential || ''),
    ).toBe(true);
    expect(db.wallets[0].accounts).toEqual([accountId]);

    const innerCredential = await db.getCredentialInner({
      credentialId: accountId,
      resolveLayerAdapter: (layer) =>
        layer.kind === adapter.kind ? adapter : undefined,
    });
    expect(innerCredential.credential).toBe(importedCredential);
    const decrypted = await decryptImportedCredentialWithMetadata({
      password,
      credential: innerCredential.credential,
    });
    expect(decrypted.plaintext).toEqual({ privateKey: 'private-key-hex' });
  });

  it('does not wrap a new credential as LSE before KDF lazy upgrade is complete', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    const credential = await encryptRevealableSeed({
      rs: {
        entropyWithLangPrefixed: 'english:00010203',
        seed: 'seed-hex',
      },
      password,
    });
    const configSpy = jest.spyOn(
      db,
      'buildLocalSecretEnvelopeCredentialMigrationConfig',
    );

    const nextCredential =
      await db.wrapNewCredentialWithLocalSecretEnvelopeIfNeeded({
        credentialId: 'hd-1',
        credential,
      });

    expect(nextCredential).toBe(credential);
    expect(isLocalSecretEnvelopeString(nextCredential)).toBe(false);
    expect(configSpy).not.toHaveBeenCalled();
  });

  it('fails fast (retryable) when a new credential cannot be wrapped on a migrated instance', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    db.context.localPasswordKdfUpgraded = true;
    db.context.localPasswordKdfUpgradedTargetIterations =
      PBKDF2_CURRENT_NUM_OF_ITERATIONS;
    db.context.localSecretEnvelopeCredentialMigrated = true;
    db.context.localSecretEnvelopeCredentialMigratedTargetVersion = 1;
    db._localSecretEnvelopeCredentialMigrationExecuted = true;
    const importedCredential = await encryptImportedCredential({
      credential: { privateKey: 'private-key-hex' },
      password,
    });
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue(undefined);

    // The instance has already established the LSE boundary, so a transient
    // layer outage must fail fast with a retryable error rather than silently
    // persisting a non-LSE credential that bypasses the boundary.
    await expect(
      db.wrapNewCredentialWithLocalSecretEnvelopeIfNeeded({
        credentialId: 'imported--60--public-key',
        credential: importedCredential,
      }),
    ).rejects.toBeInstanceOf(LocalSecretEnvelopeUnavailable);
    // Nothing was persisted raw, so the completed marker stays intact.
    expect(db.context.localSecretEnvelopeCredentialMigrated).toBe(true);
    expect(db.context.localSecretEnvelopeCredentialMigratedTargetVersion).toBe(
      1,
    );
  });

  it('returns the raw credential when LSE is unavailable before migration completes', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    db.context.localPasswordKdfUpgraded = true;
    db.context.localPasswordKdfUpgradedTargetIterations =
      PBKDF2_CURRENT_NUM_OF_ITERATIONS;
    // Migration not yet completed: graceful degradation, the lazy migration
    // will wrap this credential on a later unlock.
    const importedCredential = await encryptImportedCredential({
      credential: { privateKey: 'private-key-hex' },
      password,
    });
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue(undefined);

    const nextCredential =
      await db.wrapNewCredentialWithLocalSecretEnvelopeIfNeeded({
        credentialId: 'imported--60--public-key',
        credential: importedCredential,
      });

    expect(nextCredential).toBe(importedCredential);
    expect(isLocalSecretEnvelopeString(nextCredential)).toBe(false);
    expect(db.context.localSecretEnvelopeCredentialMigrated).toBe(false);
  });

  it('reads an LSE credential through the default local layer resolver', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    const credential = await encryptRevealableSeed({
      rs: {
        entropyWithLangPrefixed: 'english:00010203',
        seed: 'seed-hex',
      },
      password,
    });
    db.credentials = [{ id: 'hd-1', credential }];
    const adapter = buildMockLocalSecretEnvelopeLayerAdapter();
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue({
        layerAdapters: [adapter],
        strength: 'profile-bound',
      });

    await db.migrateCredentialToLocalSecretEnvelopeIfNeeded({
      credential: { ...db.credentials[0] },
      layerAdapters: [adapter],
      strength: 'profile-bound',
    });

    const innerCredential = await db.getCredentialInner({
      credentialId: 'hd-1',
    });

    expect(innerCredential.credential).toBe(credential);
  });

  it('does not overwrite a credential changed during LSE migration', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    const originalCredential = await encryptRevealableSeed({
      rs: {
        entropyWithLangPrefixed: 'english:00010203',
        seed: 'seed-hex',
      },
      password,
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

    const result = await db.migrateCredentialToLocalSecretEnvelopeIfNeeded({
      credential: { ...db.credentials[0] },
      layerAdapters: [buildMockLocalSecretEnvelopeLayerAdapter()],
      strength: 'profile-bound',
    });

    expect(result).toEqual({
      migrated: false,
      reason: 'changed_during_migration',
    });
    expect(db.credentials[0].credential).toBe(concurrentCredential);
  });

  it('best-effort deletes layer keys created by a lost credential migration CAS', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    const originalCredential = await encryptRevealableSeed({
      rs: {
        entropyWithLangPrefixed: 'english:00010203',
        seed: 'seed-hex',
      },
      password,
    });
    const concurrentCredential = await encryptRevealableSeed({
      rs: {
        entropyWithLangPrefixed: 'english:04050607',
        seed: 'seed-hex-2',
      },
      password,
    });
    db.credentials = [{ id: 'hd-1', credential: originalCredential }];
    const dbName = `test-lse-cas-cleanup-${Math.random()}`;
    const indexedDBInstance = new IDBFactory();
    const baseAdapter = buildIndexedDbCryptoKeyLocalSecretEnvelopeLayerAdapter({
      dbName,
      indexedDBInstance,
      keyRefPrefix: 'test:lse:indexeddb-cryptokey',
    });
    const deleteLayerKey = jest.fn(
      async (
        params: Parameters<
          NonNullable<ILocalSecretEnvelopeLayerAdapter['deleteLayerKey']>
        >[0],
      ) => {
        await baseAdapter.deleteLayerKey?.(params);
      },
    );
    const adapter: ILocalSecretEnvelopeLayerAdapter = {
      ...baseAdapter,
      deleteLayerKey,
    };
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

    const result = await db.migrateCredentialToLocalSecretEnvelopeIfNeeded({
      credential: { ...db.credentials[0] },
      layerAdapters: [adapter],
      strength: 'profile-bound',
    });

    expect(result).toEqual({
      migrated: false,
      reason: 'changed_during_migration',
    });
    expect(deleteLayerKey).toHaveBeenCalledTimes(1);
    const keyRef = deleteLayerKey.mock.calls[0]?.[0].layer.keyRef;
    expect(keyRef).toEqual(expect.any(String));
    await expect(
      readIndexedDbCryptoKeyForLocalSecretEnvelope({
        dbName,
        indexedDBInstance,
        keyRef: keyRef || '',
      }),
    ).resolves.toBeUndefined();
    expect(db.credentials[0].credential).toBe(concurrentCredential);
  });

  it('keeps the legacy credential readable if LSE wrapping fails', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    const revealableSeed = {
      entropyWithLangPrefixed: 'english:00010203',
      seed: 'seed-hex',
    };
    const credential = await encryptRevealableSeed({
      rs: revealableSeed,
      password,
    });
    db.credentials = [{ id: 'hd-1', credential }];

    const result = await db.migrateCredentialToLocalSecretEnvelopeIfNeeded({
      credential: { ...db.credentials[0] },
      layerAdapters: [
        buildMockLocalSecretEnvelopeLayerAdapter({ failEncrypt: true }),
      ],
      strength: 'profile-bound',
    });

    expect(result).toEqual({
      migrated: false,
      reason: 'local_secret_envelope_wrap_failed',
    });
    expect(db.credentials[0].credential).toBe(credential);

    const innerCredential = await db.getCredentialInner({
      credentialId: 'hd-1',
    });
    expect(innerCredential.credential).toBe(credential);
  });

  it('requires an adapter to read an LSE credential as inner credential', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    const credential = await encryptRevealableSeed({
      rs: {
        entropyWithLangPrefixed: 'english:00010203',
        seed: 'seed-hex',
      },
      password,
    });
    db.credentials = [{ id: 'hd-1', credential }];
    await db.migrateCredentialToLocalSecretEnvelopeIfNeeded({
      credential: { ...db.credentials[0] },
      layerAdapters: [buildMockLocalSecretEnvelopeLayerAdapter()],
      strength: 'profile-bound',
    });
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue(undefined);

    await expect(
      db.getCredentialInner({
        credentialId: 'hd-1',
      }),
    ).rejects.toThrow(
      'Local secret envelope layer adapter is required: requiredLayers=indexeddb-cryptokey@0',
    );
  });

  it('does not start LSE migration before local password KDF migration is complete', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    db.credentials = [
      {
        id: 'hd-1',
        credential: await encryptRevealableSeed({
          rs: {
            entropyWithLangPrefixed: 'english:00010203',
            seed: 'seed-hex',
          },
          password,
        }),
      },
    ];
    const configSpy = jest.spyOn(
      db,
      'buildLocalSecretEnvelopeCredentialMigrationConfig',
    );

    await db.lazyMigrateLocalSecretEnvelopeCredentialsAfterUnlock();

    expect(configSpy).not.toHaveBeenCalled();
    expect(isLocalSecretEnvelopeString(db.credentials[0].credential)).toBe(
      false,
    );
    expect(db.context.localSecretEnvelopeCredentialMigrated).toBe(false);
  });

  it('skips LSE migration scanning for the session when no layer is available', async () => {
    const db = new TestLocalDb();
    db.context.localPasswordKdfUpgraded = true;
    db.context.localPasswordKdfUpgradedTargetIterations =
      PBKDF2_CURRENT_NUM_OF_ITERATIONS;
    const configSpy = jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue(undefined);
    const getAllCredentialsSpy = jest.spyOn(db, 'getAllCredentials');

    await db.lazyMigrateLocalSecretEnvelopeCredentialsAfterUnlock();
    await db.lazyMigrateLocalSecretEnvelopeCredentialsAfterUnlock();

    expect(configSpy).toHaveBeenCalledTimes(1);
    expect(getAllCredentialsSpy).not.toHaveBeenCalled();
    expect(db.context.localSecretEnvelopeCredentialMigrated).toBe(false);
  });

  it('migrates verifyString to LSE and still verifies the password', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    db.context.verifyString = await encryptVerifyString({ password });
    db.context.localPasswordKdfUpgraded = true;
    db.context.localPasswordKdfUpgradedTargetIterations =
      PBKDF2_CURRENT_NUM_OF_ITERATIONS;
    const adapter = buildMockLocalSecretEnvelopeLayerAdapter();
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue({
        layerAdapters: [adapter],
        strength: 'profile-bound',
      });

    await db.lazyMigrateLocalSecretEnvelopeCredentialsAfterUnlock();

    expect(isLocalSecretEnvelopeString(db.context.verifyString)).toBe(true);
    await expect(
      db.verifyPassword({ password, skipLazyUpgrade: true }),
    ).resolves.toBeUndefined();
  });

  it('does not report WrongPassword when the LSE verifyString layer cannot decrypt', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    db.context.verifyString = await encryptVerifyString({ password });
    db.context.localPasswordKdfUpgraded = true;
    db.context.localPasswordKdfUpgradedTargetIterations =
      PBKDF2_CURRENT_NUM_OF_ITERATIONS;
    const adapter = buildMockLocalSecretEnvelopeLayerAdapter();
    const configSpy = jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue({
        layerAdapters: [adapter],
        strength: 'profile-bound',
      });

    await db.lazyMigrateLocalSecretEnvelopeCredentialsAfterUnlock();

    expect(isLocalSecretEnvelopeString(db.context.verifyString)).toBe(true);
    configSpy.mockResolvedValue({
      layerAdapters: [
        buildMockLocalSecretEnvelopeLayerAdapter({ failDecrypt: true }),
      ],
      strength: 'profile-bound',
    });

    await expect(
      db.verifyPassword({ password, skipLazyUpgrade: true }),
    ).rejects.toThrow(
      'Local secret envelope layer decrypt failed: kind=indexeddb-cryptokey, index=0',
    );
    await expect(
      db.getContext({ verifyPassword: password, skipLazyUpgrade: true }),
    ).rejects.toThrow(
      'Local secret envelope layer decrypt failed: kind=indexeddb-cryptokey, index=0',
    );
  });

  it('recovers from a transient LSE capability-probe failure by re-probing once', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    const originalVerifyString = await encryptVerifyString({ password });
    db.context.verifyString = originalVerifyString;
    db.context.localPasswordKdfUpgraded = true;
    db.context.localPasswordKdfUpgradedTargetIterations =
      PBKDF2_CURRENT_NUM_OF_ITERATIONS;
    const adapter = buildMockLocalSecretEnvelopeLayerAdapter();
    const configSpy = jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue({
        layerAdapters: [adapter],
        strength: 'profile-bound',
      });

    await db.lazyMigrateLocalSecretEnvelopeCredentialsAfterUnlock();
    expect(isLocalSecretEnvelopeString(db.context.verifyString)).toBe(true);

    // First probe transiently yields no config (e.g. keychain busy at cold
    // start); the single re-probe succeeds, so unwrapping must recover instead
    // of being frozen for the whole session.
    configSpy.mockReset();
    configSpy.mockResolvedValueOnce(undefined).mockResolvedValue({
      layerAdapters: [adapter],
      strength: 'profile-bound',
    });

    await expect(
      db.getContextVerifyStringInner({ context: db.context }),
    ).resolves.toBe(originalVerifyString);
    expect(configSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    await expect(
      db.verifyPassword({ password, skipLazyUpgrade: true }),
    ).resolves.toBeUndefined();
  });

  it('throws a retryable LocalSecretEnvelopeUnavailable (not WrongPassword) when the LSE layer stays unavailable', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    db.context.verifyString = await encryptVerifyString({ password });
    db.context.localPasswordKdfUpgraded = true;
    db.context.localPasswordKdfUpgradedTargetIterations =
      PBKDF2_CURRENT_NUM_OF_ITERATIONS;
    const adapter = buildMockLocalSecretEnvelopeLayerAdapter();
    const configSpy = jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue({
        layerAdapters: [adapter],
        strength: 'profile-bound',
      });

    await db.lazyMigrateLocalSecretEnvelopeCredentialsAfterUnlock();
    expect(isLocalSecretEnvelopeString(db.context.verifyString)).toBe(true);

    // Capability stays unavailable even after the re-probe: the correct password
    // must surface a retryable error, never a misleading WrongPassword/false.
    configSpy.mockReset();
    configSpy.mockResolvedValue(undefined);

    await expect(
      db.verifyPassword({ password, skipLazyUpgrade: true }),
    ).rejects.toBeInstanceOf(LocalSecretEnvelopeUnavailable);
  });

  it('migrates LSE credentials in checkpointed batches after KDF migration is complete', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    db.context.localPasswordKdfUpgraded = true;
    db.context.localPasswordKdfUpgradedTargetIterations =
      PBKDF2_CURRENT_NUM_OF_ITERATIONS;
    db.credentials = await Promise.all(
      Array.from({ length: 5 }, async (_, index) => ({
        id: `hd-${index + 1}`,
        credential: await encryptRevealableSeed({
          rs: {
            entropyWithLangPrefixed: `english:0001020${index}`,
            seed: `seed-hex-${index}`,
          },
          password,
        }),
      })),
    );
    const adapter = buildMockLocalSecretEnvelopeLayerAdapter();
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue({
        layerAdapters: [adapter],
        strength: 'profile-bound',
      });

    await db.lazyMigrateLocalSecretEnvelopeCredentialsAfterUnlock();

    expect(
      db.credentials.filter((credential) =>
        isLocalSecretEnvelopeString(credential.credential),
      ),
    ).toHaveLength(3);
    expect(
      db.context.localSecretEnvelopeCredentialMigrationLastScannedCredentialId,
    ).toBe('hd-3');
    expect(db.context.localSecretEnvelopeCredentialMigrated).toBe(false);

    await db.lazyMigrateLocalSecretEnvelopeCredentialsAfterUnlock();

    expect(
      db.credentials.filter((credential) =>
        isLocalSecretEnvelopeString(credential.credential),
      ),
    ).toHaveLength(5);
    expect(
      db.context.localSecretEnvelopeCredentialMigrationLastScannedCredentialId,
    ).toBe('');
    expect(db.context.localSecretEnvelopeCredentialMigrated).toBe(true);
    expect(db.context.localSecretEnvelopeCredentialMigratedTargetVersion).toBe(
      1,
    );
  });

  it('does not mark LSE migration completed if a legacy credential appears during completion', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    db.context.localPasswordKdfUpgraded = true;
    db.context.localPasswordKdfUpgradedTargetIterations =
      PBKDF2_CURRENT_NUM_OF_ITERATIONS;
    const firstCredential = await encryptRevealableSeed({
      rs: {
        entropyWithLangPrefixed: 'english:00010203',
        seed: 'seed-hex',
      },
      password,
    });
    const concurrentCredential = await encryptRevealableSeed({
      rs: {
        entropyWithLangPrefixed: 'english:04050607',
        seed: 'seed-hex-2',
      },
      password,
    });
    db.credentials = [{ id: 'hd-1', credential: firstCredential }];
    const adapter = buildMockLocalSecretEnvelopeLayerAdapter();
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue({
        layerAdapters: [adapter],
        strength: 'profile-bound',
      });
    const migrateCredential =
      db.migrateCredentialToLocalSecretEnvelopeIfNeeded.bind(db);
    let injected = false;
    jest
      .spyOn(db, 'migrateCredentialToLocalSecretEnvelopeIfNeeded')
      .mockImplementation(async (params) => {
        const result = await migrateCredential(params);
        if (!injected) {
          injected = true;
          db.credentials.push({
            id: 'hd-2',
            credential: concurrentCredential,
          });
        }
        return result;
      });

    await db.lazyMigrateLocalSecretEnvelopeCredentialsAfterUnlock();

    expect(isLocalSecretEnvelopeString(db.credentials[0].credential)).toBe(
      true,
    );
    expect(isLocalSecretEnvelopeString(db.credentials[1].credential)).toBe(
      false,
    );
    expect(db.context.localSecretEnvelopeCredentialMigrated).toBe(false);
    expect(db._localSecretEnvelopeCredentialMigrationExecuted).toBe(false);

    await db.lazyMigrateLocalSecretEnvelopeCredentialsAfterUnlock();

    expect(
      db.credentials.every((credential) =>
        isLocalSecretEnvelopeString(credential.credential),
      ),
    ).toBe(true);
    expect(db.context.localSecretEnvelopeCredentialMigrated).toBe(true);
    expect(db.context.localSecretEnvelopeCredentialMigratedTargetVersion).toBe(
      1,
    );
  });

  it('does not scan LSE credentials after the persistent migration marker is set', async () => {
    const db = new TestLocalDb();
    db.context.localPasswordKdfUpgraded = true;
    db.context.localPasswordKdfUpgradedTargetIterations =
      PBKDF2_CURRENT_NUM_OF_ITERATIONS;
    db.context.localSecretEnvelopeCredentialMigrated = true;
    db.context.localSecretEnvelopeCredentialMigratedTargetVersion = 1;
    const getAllCredentialsSpy = jest.spyOn(db, 'getAllCredentials');

    await db.lazyMigrateLocalSecretEnvelopeCredentialsAfterUnlock();

    expect(getAllCredentialsSpy).not.toHaveBeenCalled();
    expect(db._localSecretEnvelopeCredentialMigrationExecuted).toBe(true);
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
      {
        id: 'imported--60--hyperliquid-agent',
        credential: '|HLP|{"privateKey":"plain","userAddress":"0x2"}',
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
    expect(db.credentials[3].credential).toBe(
      '|HLP|{"privateKey":"plain","userAddress":"0x2"}',
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

  it('skips LSE credentials during local password KDF lazy upgrade', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    const credential = await encryptRevealableSeed({
      rs: {
        entropyWithLangPrefixed: 'english:00010203',
        seed: 'seed-hex',
      },
      password,
    });
    db.credentials = [{ id: 'hd-1', credential }];
    const adapter = buildMockLocalSecretEnvelopeLayerAdapter();
    await db.migrateCredentialToLocalSecretEnvelopeIfNeeded({
      credential: { ...db.credentials[0] },
      layerAdapters: [adapter],
      strength: 'profile-bound',
    });
    const localSecretEnvelopeCredential = db.credentials[0].credential;

    expect(
      db.isLocalPasswordKdfCredentialUpgradeCandidate({
        credential: db.credentials[0],
      }),
    ).toBe(false);

    await db.lazyUpgradeLocalPasswordEncryptedRecords({ password });

    expect(db.credentials[0].credential).toBe(localSecretEnvelopeCredential);
    expect(db.context.localPasswordKdfUpgraded).toBe(true);
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

describe('LocalDbBase.setPassword', () => {
  it('wraps verifyString on initial password setup and marks KDF completed for an empty DB', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'new-password' });
    const adapter = buildMockLocalSecretEnvelopeLayerAdapter();
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue({
        layerAdapters: [adapter],
        strength: 'profile-bound',
      });

    await db.setPassword({ password });

    expect(isLocalSecretEnvelopeString(db.context.verifyString)).toBe(true);
    expect(db.context.localPasswordKdfUpgraded).toBe(true);
    expect(db.context.localPasswordKdfUpgradedTargetIterations).toBe(
      PBKDF2_CURRENT_NUM_OF_ITERATIONS,
    );

    const verifyString = await db.getContextVerifyStringInner({
      context: db.context,
    });
    const verifyStringResult = await decryptVerifyStringWithMetadata({
      password,
      verifyString,
    });
    expect(verifyStringResult.plaintext).toBe(DEFAULT_VERIFY_STRING);

    const credential = await encryptRevealableSeed({
      password,
      rs: {
        entropyWithLangPrefixed: 'english:00010203',
        seed: 'seed-hex',
      },
    });
    const nextCredential =
      await db.wrapNewCredentialWithLocalSecretEnvelopeIfNeeded({
        credentialId: 'hd-1',
        credential,
      });
    expect(isLocalSecretEnvelopeString(nextCredential)).toBe(true);
  });

  it('keeps initial password setup readable when no LSE layer is available', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'new-password' });
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue(undefined);

    await db.setPassword({ password });

    expect(isLocalSecretEnvelopeString(db.context.verifyString)).toBe(false);
    expect(db.context.localPasswordKdfUpgraded).toBe(true);
    expect(db.context.localPasswordKdfUpgradedTargetIterations).toBe(
      PBKDF2_CURRENT_NUM_OF_ITERATIONS,
    );
    const verifyStringResult = await decryptVerifyStringWithMetadata({
      password,
      verifyString: db.context.verifyString,
    });
    expect(verifyStringResult.plaintext).toBe(DEFAULT_VERIFY_STRING);
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
      {
        id: 'imported--60--hyperliquid-agent',
        credential: '|HLP|{"privateKey":"plain","userAddress":"0x2"}',
      },
    ];
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue(undefined);

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
    expect(db.credentials[3].credential).toBe(
      '|HLP|{"privateKey":"plain","userAddress":"0x2"}',
    );
  });

  it('starts post-password lazy upgrade (LSE migration) after a password change', async () => {
    const db = new TestLocalDb();
    const oldPassword = await encodePasswordAsync({ password: 'old-password' });
    const newPassword = await encodePasswordAsync({ password: 'new-password' });
    db.context.verifyString = await encryptVerifyString({
      password: oldPassword,
    });
    db.credentials = [
      {
        id: 'hd-1',
        credential: await encryptRevealableSeed({
          rs: { entropyWithLangPrefixed: 'english:00010203', seed: 'seed-hex' },
          password: oldPassword,
        }),
      },
    ];
    // Simulate a session where the lazy upgrade / migration already ran, so the
    // per-session guards are set. A password change must reset them and
    // re-trigger, otherwise the just-rewritten (still portable) records would
    // bypass the secure-storage / CryptoKey boundary until the next unlock.
    db._localPasswordKdfLazyUpgradeExecuted = true;
    db._localSecretEnvelopeCredentialMigrationExecuted = true;
    const postVerifySpy = jest
      .spyOn(db, 'runPostPasswordVerifiedLazyUpgrade')
      .mockImplementation(jest.fn());

    await db.updatePassword({ oldPassword, newPassword });

    expect(postVerifySpy).toHaveBeenCalledTimes(1);
    expect(postVerifySpy).toHaveBeenCalledWith({ password: newPassword });
    expect(db._localSecretEnvelopeCredentialMigrationExecuted).toBe(false);
    expect(db._localPasswordKdfLazyUpgradeExecuted).toBe(false);
  });

  it('does not start post-password lazy upgrade when setting the initial password', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'new-password' });
    const postVerifySpy = jest
      .spyOn(db, 'runPostPasswordVerifiedLazyUpgrade')
      .mockImplementation(jest.fn());

    await db.setPassword({ password });

    expect(postVerifySpy).not.toHaveBeenCalled();
  });

  it('keeps LSE credentials wrapped when changing password', async () => {
    const db = new TestLocalDb();
    const oldPassword = await encodePasswordAsync({ password: 'old-password' });
    const newPassword = await encodePasswordAsync({ password: 'new-password' });
    const revealableSeed = {
      entropyWithLangPrefixed: 'english:00010203',
      seed: 'seed-hex',
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
    const adapter = buildMockLocalSecretEnvelopeLayerAdapter();
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue({
        layerAdapters: [adapter],
        strength: 'profile-bound',
      });
    await db.migrateCredentialToLocalSecretEnvelopeIfNeeded({
      credential: { ...db.credentials[0] },
      layerAdapters: [adapter],
      strength: 'profile-bound',
    });
    const originalCredentialEnvelope = parseLocalSecretEnvelopeV1(
      db.credentials[0].credential,
    );

    await db.updatePassword({ oldPassword, newPassword });

    expect(isLocalSecretEnvelopeString(db.credentials[0].credential)).toBe(
      true,
    );
    const nextCredentialEnvelope = parseLocalSecretEnvelopeV1(
      db.credentials[0].credential,
    );
    expect(nextCredentialEnvelope.wrappingLayers[0].keyRef).toBe(
      originalCredentialEnvelope.wrappingLayers[0].keyRef,
    );
    expect(nextCredentialEnvelope.wrappingLayers[0].iv).not.toBe(
      originalCredentialEnvelope.wrappingLayers[0].iv,
    );
    expect(isLocalSecretEnvelopeString(db.context.verifyString)).toBe(true);
    const verifyString = await db.getContextVerifyStringInner({
      context: db.context,
    });
    const verifyStringResult = await decryptVerifyStringWithMetadata({
      password: newPassword,
      verifyString,
    });
    expect(verifyStringResult.plaintext).toBe(DEFAULT_VERIFY_STRING);

    const innerCredential = await db.getCredentialInner({
      credentialId: 'hd-1',
    });
    const hdCredentialResult = await decryptRevealableSeedWithMetadata({
      password: newPassword,
      rs: innerCredential.credential,
    });
    expect(hdCredentialResult.plaintext).toEqual(revealableSeed);
  });

  it('keeps LSE verifyString wrapped when changing password', async () => {
    const db = new TestLocalDb();
    const oldPassword = await encodePasswordAsync({ password: 'old-password' });
    const newPassword = await encodePasswordAsync({ password: 'new-password' });
    const adapter = buildMockLocalSecretEnvelopeLayerAdapter();
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue({
        layerAdapters: [adapter],
        strength: 'profile-bound',
      });
    db.context.verifyString = await encryptVerifyString({
      password: oldPassword,
    });
    await db.migrateContextVerifyStringToLocalSecretEnvelopeIfNeeded({
      layerAdapters: [adapter],
      strength: 'profile-bound',
    });
    const originalVerifyStringEnvelope = parseLocalSecretEnvelopeV1(
      db.context.verifyString,
    );

    await db.updatePassword({ oldPassword, newPassword });

    expect(isLocalSecretEnvelopeString(db.context.verifyString)).toBe(true);
    const nextVerifyStringEnvelope = parseLocalSecretEnvelopeV1(
      db.context.verifyString,
    );
    expect(nextVerifyStringEnvelope.wrappingLayers[0].keyRef).toBe(
      originalVerifyStringEnvelope.wrappingLayers[0].keyRef,
    );
    expect(nextVerifyStringEnvelope.wrappingLayers[0].iv).not.toBe(
      originalVerifyStringEnvelope.wrappingLayers[0].iv,
    );
    const verifyString = await db.getContextVerifyStringInner({
      context: db.context,
    });
    const verifyStringResult = await decryptVerifyStringWithMetadata({
      password: newPassword,
      verifyString,
    });
    expect(verifyStringResult.plaintext).toBe(DEFAULT_VERIFY_STRING);
  });

  it('does not delete reused LSE layer keys after password update succeeds', async () => {
    const db = new TestLocalDb();
    const oldPassword = await encodePasswordAsync({ password: 'old-password' });
    const newPassword = await encodePasswordAsync({ password: 'new-password' });
    const revealableSeed = {
      entropyWithLangPrefixed: 'english:00010203',
      seed: 'seed-hex',
    };
    const deleteLayerKey = jest.fn();
    const adapter = buildMockLocalSecretEnvelopeLayerAdapter({
      deleteLayerKey,
    });
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue({
        layerAdapters: [adapter],
        strength: 'profile-bound',
      });
    db.context.verifyString = await encryptVerifyString({
      password: oldPassword,
    });
    await db.migrateContextVerifyStringToLocalSecretEnvelopeIfNeeded({
      layerAdapters: [adapter],
      strength: 'profile-bound',
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
    await db.migrateCredentialToLocalSecretEnvelopeIfNeeded({
      credential: { ...db.credentials[0] },
      layerAdapters: [adapter],
      strength: 'profile-bound',
    });

    await db.updatePassword({ oldPassword, newPassword });

    expect(deleteLayerKey).not.toHaveBeenCalled();
  });

  it('does not delete reused LSE layer keys if password update aborts', async () => {
    const db = new TestLocalDb();
    const oldPassword = await encodePasswordAsync({ password: 'old-password' });
    const newPassword = await encodePasswordAsync({ password: 'new-password' });
    const revealableSeed = {
      entropyWithLangPrefixed: 'english:00010203',
      seed: 'seed-hex',
    };
    const deleteLayerKey = jest.fn();
    const adapter = buildMockLocalSecretEnvelopeLayerAdapter({
      deleteLayerKey,
    });
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue({
        layerAdapters: [adapter],
        strength: 'profile-bound',
      });
    db.context.verifyString = await encryptVerifyString({
      password: oldPassword,
    });
    await db.migrateContextVerifyStringToLocalSecretEnvelopeIfNeeded({
      layerAdapters: [adapter],
      strength: 'profile-bound',
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
    await db.migrateCredentialToLocalSecretEnvelopeIfNeeded({
      credential: { ...db.credentials[0] },
      layerAdapters: [adapter],
      strength: 'profile-bound',
    });
    deleteLayerKey.mockClear();
    db.txUpdateAllCredentialsPassword = jest.fn(async () => {
      throw new OneKeyLocalError('Mock password update abort');
    }) as TestLocalDb['txUpdateAllCredentialsPassword'];

    await expect(
      db.updatePassword({ oldPassword, newPassword }),
    ).rejects.toThrow('Mock password update abort');

    expect(deleteLayerKey).not.toHaveBeenCalled();
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
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue(undefined);

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

  it('aborts if verifyString changes after password update precomputation', async () => {
    const db = new TestLocalDb();
    const oldPassword = await encodePasswordAsync({ password: 'old-password' });
    const newPassword = await encodePasswordAsync({ password: 'new-password' });
    const concurrentPassword = await encodePasswordAsync({
      password: 'concurrent-password',
    });
    db.context.verifyString = await encryptVerifyString({
      password: oldPassword,
    });
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue(undefined);

    const wrapContextVerifyStringWithLocalSecretEnvelopeIfNeeded =
      db.wrapContextVerifyStringWithLocalSecretEnvelopeIfNeeded.bind(db);
    db.wrapContextVerifyStringWithLocalSecretEnvelopeIfNeeded = jest.fn(
      async (params) => {
        const result =
          await wrapContextVerifyStringWithLocalSecretEnvelopeIfNeeded(params);
        db.context.verifyString = await encryptVerifyString({
          password: concurrentPassword,
        });
        return result;
      },
    ) as TestLocalDb['wrapContextVerifyStringWithLocalSecretEnvelopeIfNeeded'];

    await expect(
      db.updatePassword({ oldPassword, newPassword }),
    ).rejects.toThrow('verifyString changed during password update');

    const verifyStringResult = await decryptVerifyStringWithMetadata({
      password: concurrentPassword,
      verifyString: db.context.verifyString,
    });
    expect(verifyStringResult.plaintext).toBe(DEFAULT_VERIFY_STRING);
  });
});
