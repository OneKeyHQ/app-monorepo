import { EDeviceType, EFirmwareType } from '@onekeyfe/hd-shared';
import { IDBFactory } from 'fake-indexeddb';

import {
  ESecretEncryptPayloadFormat,
  decryptImportedCredentialWithMetadata,
  decryptRevealableSeedWithMetadata,
  decryptVerifyStringWithMetadata,
  encodePasswordAsync,
  encryptHyperLiquidAgentCredential,
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
import { EHyperLiquidAgentName } from '@onekeyhq/shared/src/consts/perp';
import {
  LocalSecretEnvelopeUnavailable,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import {
  LOCAL_SECRET_ENVELOPE_CREDENTIAL_ERROR_DATA_TYPE,
  LOCAL_SECRET_ENVELOPE_ERROR_DATA_TYPE_FIELD,
} from '@onekeyhq/shared/src/errors/utils/localSecretEnvelopeErrorData';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { settingsPersistAtom } from '../../states/jotai/atoms/settings';
import { globalJotaiStorageReadyHandler } from '../../states/jotai/jotaiStorage';
import { jotaiDefaultStore } from '../../states/jotai/utils/jotaiDefaultStore';

import { EDBAccountType } from './consts';
import {
  decryptHyperLiquidAgentCredentialWithSessionKey,
  deriveHyperLiquidAgentSecretKey,
  encryptHyperLiquidAgentCredentialWithSessionKey,
  hyperLiquidAgentSecretSession,
} from './hyperLiquidAgentSecret';
import { LocalDbBase } from './LocalDbBase';
import { ELocalDBStoreNames } from './localDBStoreNames';
import {
  buildIndexedDbCryptoKeyLocalSecretEnvelopeLayerAdapter,
  isLocalSecretEnvelopeString,
  parseLocalSecretEnvelopeV1,
  readIndexedDbCryptoKeyForLocalSecretEnvelope,
  unwrapLocalSecretEnvelopeV1,
  wrapLocalSecretEnvelopeV1,
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
  ILocalDBTxRemoveRecordsParams,
  ILocalDBTxUpdateRecordsParams,
} from './types';

jest.setTimeout(120_000);

function buildNoopSyncManager() {
  return {
    buildSyncTargetByDBQuery: jest.fn(async () => ({})),
    buildSyncKeyAndPayload: jest.fn(async () => undefined),
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

  removedDeviceIds: string[] = [];

  addHDNextIndexedAccountCalls = 0;

  removeBackupHyperLiquidAgentCredentials = jest.fn(async () => undefined);

  getCachedPasswordMock = jest.fn(
    async (): Promise<string | undefined> => undefined,
  );

  buildCreateResultCalls: {
    walletId: string;
    withoutRefillWallet?: boolean;
  }[] = [];

  constructor() {
    super();

    this.setBackgroundApi({
      serviceDBBackup: {
        backupDatabaseDaily: jest.fn(async () => undefined),
        removeBackupHyperLiquidAgentCredentials:
          this.removeBackupHyperLiquidAgentCredentials,
      },
      servicePassword: {
        getCachedPassword: this.getCachedPasswordMock,
      },
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

  override async getAllWallets(): Promise<{ wallets: IDBWallet[] }> {
    return {
      wallets: this.wallets.map((wallet) => ({ ...wallet })),
    };
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
    if (name === ELocalDBStoreNames.Wallet) {
      const records = this.wallets.map((wallet) => ({ ...wallet }));
      return {
        records: records as ILocalDBTxGetAllRecordsResult<T>['records'],
        recordPairs: records.map((record) => [
          record,
          null,
        ]) as ILocalDBTxGetAllRecordsResult<T>['recordPairs'],
      };
    }
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

  override async txRemoveRecords<T extends ELocalDBStoreNames>({
    name,
    ids = [],
    recordPairs = [],
  }: ILocalDBTxRemoveRecordsParams<T>): Promise<void> {
    const targetIds = [...ids, ...recordPairs.map(([record]) => record.id)];
    if (name === ELocalDBStoreNames.Wallet) {
      this.wallets = this.wallets.filter(
        (wallet) => !targetIds.includes(wallet.id),
      );
    }
    if (name === ELocalDBStoreNames.Credential) {
      this.credentials = this.credentials.filter(
        (credential) => !targetIds.includes(credential.id),
      );
    }
    if (name === ELocalDBStoreNames.Device) {
      this.removedDeviceIds.push(...targetIds);
    }
  }

  override async buildCreateHDAndHWWalletResult({
    walletId,
    withoutRefillWallet,
  }: {
    walletId: string;
    withoutRefillWallet?: boolean;
  }) {
    this.buildCreateResultCalls.push({ walletId, withoutRefillWallet });
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
  keyRef = 'indexeddb:test-device-key:v1',
  kind = 'indexeddb-cryptokey',
}: {
  deleteLayerKey?: ILocalSecretEnvelopeLayerAdapter['deleteLayerKey'];
  failDecrypt?: boolean;
  failEncrypt?: boolean;
  keyRef?: string;
  kind?: ILocalSecretEnvelopeLayerKind;
} = {}): ILocalSecretEnvelopeLayerAdapter {
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

async function buildLegacyLocalSecretEnvelopeVerifyString({
  adapter,
  verifyString,
}: {
  adapter: ILocalSecretEnvelopeLayerAdapter;
  verifyString: string;
}): Promise<string> {
  return wrapLocalSecretEnvelopeV1({
    dataType: 'verify-string',
    layerAdapters: [adapter],
    plaintext: verifyString,
    recordId: DB_MAIN_CONTEXT_ID,
    strength: 'profile-bound',
  });
}

describe('LocalDbBase.removeWallet hardware device lifecycle', () => {
  const buildHardwareWallet = (): IDBWallet => ({
    id: 'hw-wallet-1',
    name: 'OneKey Pro 2',
    type: 'hw',
    backuped: true,
    accounts: [],
    nextIds: {},
    associatedDevice: 'device-1',
    walletNo: 1,
  });

  it('retains a mocked standard wallet as the hidden-wallet device proxy', async () => {
    const db = new TestLocalDb();
    db.wallets = [buildHardwareWallet()];

    await db.removeWallet({
      walletId: 'hw-wallet-1',
      isRemoveToMocked: true,
    });

    expect(db.wallets).toEqual([
      expect.objectContaining({
        id: 'hw-wallet-1',
        isMocked: true,
      }),
    ]);
    expect(db.removedDeviceIds).toEqual([]);
  });

  it('deletes the wallet and device record when the device is removed', async () => {
    const db = new TestLocalDb();
    db.wallets = [buildHardwareWallet()];

    await db.removeWallet({ walletId: 'hw-wallet-1' });

    expect(db.wallets).toEqual([]);
    expect(db.removedDeviceIds).toEqual(['device-1']);
  });
});

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
    db.context.localSecretEnvelopeCredentialMigratedTargetVersion = 2;
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

describe('LocalDbBase.createHwWallet', () => {
  it('returns the persisted wallet before refill for label synchronization', async () => {
    const db = new TestLocalDb();
    db.wallets = [
      {
        id: 'hw-device-db-1',
        name: 'Previous device name',
        type: 'hw',
        backuped: true,
        accounts: [],
        nextIds: {},
        associatedDevice: 'device-db-1',
        walletNo: 1,
      },
    ];
    jest.spyOn(db, 'buildHwWalletId').mockResolvedValue({
      dbDeviceId: 'device-db-1',
      dbWalletId: 'hw-device-db-1',
      deviceUUID: 'PRO2_SERIAL',
      rawDeviceId: 'PRO2_DEVICE_ID',
    });
    jest.spyOn(db, 'timeNow').mockResolvedValue(1);

    const result = await db.createHwWallet({
      device: {
        connectId: 'PRO2_USB',
        uuid: 'PRO2_SERIAL',
        deviceId: 'PRO2_DEVICE_ID',
        deviceType: EDeviceType.Pro2,
        name: 'Pro2 6136',
      },
      features: {
        label: 'Current device name',
        bleName: 'Pro2 6136',
        deviceType: EDeviceType.Pro2,
        deviceId: 'PRO2_DEVICE_ID',
        serialNo: 'PRO2_SERIAL',
      } as never,
      deviceState: {
        schemaVersion: 1,
        revision: 1,
        updatedAt: 1,
        protocol: 'V2',
        identity: {
          deviceType: EDeviceType.Pro2,
          firmwareType: EFirmwareType.Universal,
          model: 'pro2',
          vendor: 'onekey.so',
          deviceId: 'PRO2_DEVICE_ID',
          serialNo: 'PRO2_SERIAL',
          label: 'Current device name',
          bleName: 'Pro2 6136',
        },
        status: { mode: 'normal' },
        settings: {},
        versions: {},
        capabilities: [],
      } as never,
    });

    expect(result.wallet.name).toBe('Previous device name');
    expect(db.buildCreateResultCalls.at(-1)).toEqual({
      walletId: 'hw-device-db-1',
      withoutRefillWallet: true,
    });
  });
});

describe('LocalDbBase local secret envelope credentials', () => {
  beforeAll(() => {
    // These tests isolate the LSE boundary. Desktop password-session wrapping
    // is outside this suite and is replaced with the native HLP serializer.
    jest
      .spyOn(hyperLiquidAgentSecretSession, 'encryptCredential')
      .mockImplementation(async ({ credential }) =>
        encryptHyperLiquidAgentCredential({ credential }),
      );
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

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

  it('always stores HyperLiquid agent credentials inside LSE', async () => {
    const db = new TestLocalDb();
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
    const credential = {
      userAddress: '0x1111111111111111111111111111111111111111',
      agentName: EHyperLiquidAgentName.OneKeyAgent1,
      privateKey:
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      agentAddress: '0x2222222222222222222222222222222222222222',
      validUntil: 1_900_000_000_000,
    };

    const { credentialId } = await db.addHyperLiquidAgentCredential({
      credential,
    });
    const storedCredential = await db.getCredentialRaw(credentialId);

    expect(isLocalSecretEnvelopeString(storedCredential.credential)).toBe(true);
    expect(storedCredential.credential).not.toContain(credential.privateKey);
    expect(
      parseLocalSecretEnvelopeV1(storedCredential.credential),
    ).toMatchObject({
      dataType: 'credential',
      innerPrefix: '|HLP|',
      recordId: credentialId,
    });
    await expect(
      db.getHyperLiquidAgentCredential({
        userAddress: credential.userAddress,
        agentName: credential.agentName,
      }),
    ).resolves.toEqual(credential);

    await db.removeCredentials({ credentials: [storedCredential] });
    expect(db.credentials).toEqual([]);
    expect(db.removeBackupHyperLiquidAgentCredentials).toHaveBeenCalledWith({
      credentialIds: [credentialId],
    });
    expect(deleteLayerKey).toHaveBeenCalledTimes(1);
  });

  it('refuses to persist a HyperLiquid agent credential when LSE is unavailable', async () => {
    const db = new TestLocalDb();
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue(undefined);

    await expect(
      db.addHyperLiquidAgentCredential({
        credential: {
          userAddress: '0x1111111111111111111111111111111111111111',
          agentName: EHyperLiquidAgentName.OneKeyAgent1,
          privateKey:
            '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          agentAddress: '0x2222222222222222222222222222222222222222',
          validUntil: 1_900_000_000_000,
        },
      }),
    ).rejects.toBeInstanceOf(LocalSecretEnvelopeUnavailable);
    expect(db.credentials).toEqual([]);
  });

  it('updates a HyperLiquid agent credential with the existing LSE key', async () => {
    const db = new TestLocalDb();
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
    const credential = {
      userAddress: '0x1111111111111111111111111111111111111111',
      agentName: EHyperLiquidAgentName.OneKeyAgent1,
      privateKey:
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      agentAddress: '0x2222222222222222222222222222222222222222',
      validUntil: 1_900_000_000_000,
    };
    const { credentialId } = await db.addHyperLiquidAgentCredential({
      credential,
    });
    const originalEnvelope = parseLocalSecretEnvelopeV1(
      (await db.getCredentialRaw(credentialId)).credential,
    );
    const updatedCredential = {
      ...credential,
      privateKey:
        '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      agentAddress: '0x3333333333333333333333333333333333333333',
      validUntil: 2_000_000_000_000,
    };

    await db.updateHyperLiquidAgentCredential({
      credential: updatedCredential,
    });

    const nextStoredCredential = await db.getCredentialRaw(credentialId);
    const nextEnvelope = parseLocalSecretEnvelopeV1(
      nextStoredCredential.credential,
    );
    expect(nextEnvelope.wrappingLayers.map((layer) => layer.keyRef)).toEqual(
      originalEnvelope.wrappingLayers.map((layer) => layer.keyRef),
    );
    expect(nextEnvelope.wrappingLayers.map((layer) => layer.iv)).not.toEqual(
      originalEnvelope.wrappingLayers.map((layer) => layer.iv),
    );
    expect(nextStoredCredential.credential).not.toContain(
      updatedCredential.privateKey,
    );
    expect(deleteLayerKey).not.toHaveBeenCalled();
    await expect(
      db.getHyperLiquidAgentCredential({
        userAddress: updatedCredential.userAddress,
        agentName: updatedCredential.agentName,
      }),
    ).resolves.toEqual(updatedCredential);
  });

  it('upgrades a single-layer HyperLiquid agent credential on its next write', async () => {
    const db = new TestLocalDb();
    const oldBaseAdapter = buildMockLocalSecretEnvelopeLayerAdapter({
      keyRef: 'indexeddb:old-hl-key:v1',
    });
    const deleteBaseLayerKey = jest.fn();
    const nextBaseAdapter = buildMockLocalSecretEnvelopeLayerAdapter({
      deleteLayerKey: deleteBaseLayerKey,
      keyRef: 'indexeddb:next-hl-key:v1',
    });
    const enhancementAdapter = buildMockLocalSecretEnvelopeLayerAdapter({
      keyRef: 'secure-storage-global-key:v1',
      kind: 'secure-storage',
    });
    const originalCredential = {
      userAddress: '0x1111111111111111111111111111111111111111',
      agentName: EHyperLiquidAgentName.OneKeyAgent1,
      privateKey:
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      agentAddress: '0x2222222222222222222222222222222222222222',
      validUntil: 1_900_000_000_000,
    };
    const credentialId = accountUtils.buildHyperLiquidAgentCredentialId({
      userAddress: originalCredential.userAddress,
      agentName: originalCredential.agentName,
    });
    const originalInnerCredential = encryptHyperLiquidAgentCredential({
      credential: originalCredential,
    });
    const originalEnvelope = await wrapLocalSecretEnvelopeV1({
      dataType: 'credential',
      layerAdapters: [oldBaseAdapter],
      plaintext: originalInnerCredential,
      recordId: credentialId,
      strength: 'profile-bound',
    });
    db.credentials = [
      {
        id: credentialId,
        credential: originalEnvelope,
      },
    ];
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue({
        layerAdapters: [nextBaseAdapter, enhancementAdapter],
        strength: 'secure-storage-bound',
      });
    const updatedCredential = {
      ...originalCredential,
      privateKey:
        '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      agentAddress: '0x3333333333333333333333333333333333333333',
      validUntil: 2_000_000_000_000,
    };

    await db.updateHyperLiquidAgentCredential({
      credential: updatedCredential,
    });

    const nextEnvelope = parseLocalSecretEnvelopeV1(
      db.credentials[0].credential,
    );
    expect(nextEnvelope.wrappingLayers.map((layer) => layer.kind)).toEqual([
      'indexeddb-cryptokey',
      'secure-storage',
    ]);
    expect(nextEnvelope.wrappingLayers[0].keyRef).toBe(
      'indexeddb:old-hl-key:v1',
    );
    expect(deleteBaseLayerKey).not.toHaveBeenCalled();
    await expect(
      unwrapLocalSecretEnvelopeV1({
        envelope: originalEnvelope,
        expectedDataType: 'credential',
        expectedRecordId: credentialId,
        resolveLayerAdapter: () => oldBaseAdapter,
      }),
    ).resolves.toBe(originalInnerCredential);
    await expect(
      db.getHyperLiquidAgentCredential({
        userAddress: updatedCredential.userAddress,
        agentName: updatedCredential.agentName,
      }),
    ).resolves.toEqual(updatedCredential);
  });

  it('keeps the existing single layer when a HyperLiquid topology upgrade fails', async () => {
    const db = new TestLocalDb();
    const oldBaseAdapter = buildMockLocalSecretEnvelopeLayerAdapter({
      keyRef: 'indexeddb:old-hl-key:v1',
    });
    const deleteExistingBaseLayerKey = jest.fn();
    const nextBaseAdapter = buildMockLocalSecretEnvelopeLayerAdapter({
      deleteLayerKey: deleteExistingBaseLayerKey,
      keyRef: 'indexeddb:next-hl-key:v1',
    });
    const failingEnhancementAdapter = buildMockLocalSecretEnvelopeLayerAdapter({
      failEncrypt: true,
      keyRef: 'secure-storage-global-key:v1',
      kind: 'secure-storage',
    });
    const originalCredential = {
      userAddress: '0x1111111111111111111111111111111111111111',
      agentName: EHyperLiquidAgentName.OneKeyAgent1,
      privateKey:
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      agentAddress: '0x2222222222222222222222222222222222222222',
      validUntil: 1_900_000_000_000,
    };
    const credentialId = accountUtils.buildHyperLiquidAgentCredentialId({
      userAddress: originalCredential.userAddress,
      agentName: originalCredential.agentName,
    });
    db.credentials = [
      {
        id: credentialId,
        credential: await wrapLocalSecretEnvelopeV1({
          dataType: 'credential',
          layerAdapters: [oldBaseAdapter],
          plaintext: encryptHyperLiquidAgentCredential({
            credential: originalCredential,
          }),
          recordId: credentialId,
          strength: 'profile-bound',
        }),
      },
    ];
    const originalEnvelope = parseLocalSecretEnvelopeV1(
      db.credentials[0].credential,
    );
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue({
        layerAdapters: [nextBaseAdapter, failingEnhancementAdapter],
        strength: 'secure-storage-bound',
      });
    const updatedCredential = {
      ...originalCredential,
      privateKey:
        '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    };

    await db.updateHyperLiquidAgentCredential({
      credential: updatedCredential,
    });

    const nextEnvelope = parseLocalSecretEnvelopeV1(
      db.credentials[0].credential,
    );
    expect(nextEnvelope.wrappingLayers).toHaveLength(1);
    expect(nextEnvelope.wrappingLayers[0].keyRef).toBe(
      originalEnvelope.wrappingLayers[0].keyRef,
    );
    expect(nextEnvelope.wrappingLayers[0].iv).not.toBe(
      originalEnvelope.wrappingLayers[0].iv,
    );
    expect(deleteExistingBaseLayerKey).not.toHaveBeenCalled();
    await expect(
      db.getHyperLiquidAgentCredential({
        userAddress: updatedCredential.userAddress,
        agentName: updatedCredential.agentName,
      }),
    ).resolves.toEqual(updatedCredential);
  });

  it('wraps a legacy plaintext HyperLiquid agent credential before returning it', async () => {
    const db = new TestLocalDb();
    const baseAdapter = buildMockLocalSecretEnvelopeLayerAdapter();
    const enhancementAdapter = buildMockLocalSecretEnvelopeLayerAdapter({
      keyRef: 'secure-storage-global-key:v1',
      kind: 'secure-storage',
    });
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue({
        layerAdapters: [baseAdapter, enhancementAdapter],
        strength: 'secure-storage-bound',
      });
    const credential = {
      userAddress: '0x1111111111111111111111111111111111111111',
      agentName: EHyperLiquidAgentName.OneKeyAgent1,
      privateKey:
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      agentAddress: '0x2222222222222222222222222222222222222222',
      validUntil: 1_900_000_000_000,
    };
    const credentialId = accountUtils.buildHyperLiquidAgentCredentialId({
      userAddress: credential.userAddress,
      agentName: credential.agentName,
    });
    db.credentials = [
      {
        id: credentialId,
        credential: encryptHyperLiquidAgentCredential({ credential }),
      },
    ];

    await expect(
      db.getHyperLiquidAgentCredential({
        userAddress: credential.userAddress,
        agentName: credential.agentName,
      }),
    ).resolves.toEqual(credential);
    expect(isLocalSecretEnvelopeString(db.credentials[0].credential)).toBe(
      true,
    );
    expect(
      parseLocalSecretEnvelopeV1(
        db.credentials[0].credential,
      ).wrappingLayers.map((layer) => layer.kind),
    ).toEqual(['indexeddb-cryptokey', 'secure-storage']);
  });

  it('does not overwrite a concurrent HyperLiquid credential rotation during plaintext migration', async () => {
    const db = new TestLocalDb();
    const baseAdapter = buildMockLocalSecretEnvelopeLayerAdapter();
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue({
        layerAdapters: [baseAdapter],
        strength: 'profile-bound',
      });
    const originalCredential = {
      userAddress: '0x1111111111111111111111111111111111111111',
      agentName: EHyperLiquidAgentName.OneKeyAgent1,
      privateKey:
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      agentAddress: '0x2222222222222222222222222222222222222222',
      validUntil: 1_900_000_000_000,
    };
    const rotatedCredential = {
      ...originalCredential,
      privateKey:
        '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      agentAddress: '0x3333333333333333333333333333333333333333',
    };
    const credentialId = accountUtils.buildHyperLiquidAgentCredentialId({
      userAddress: originalCredential.userAddress,
      agentName: originalCredential.agentName,
    });
    const originalRawCredential = encryptHyperLiquidAgentCredential({
      credential: originalCredential,
    });
    const rotatedRawCredential = encryptHyperLiquidAgentCredential({
      credential: rotatedCredential,
    });
    db.credentials = [
      {
        id: credentialId,
        credential: originalRawCredential,
      },
    ];
    const getCredentialRaw = db.getCredentialRaw.bind(db);
    let rawReadCount = 0;
    jest.spyOn(db, 'getCredentialRaw').mockImplementation(async (id) => {
      rawReadCount += 1;
      if (rawReadCount === 2) {
        db.credentials[0].credential = rotatedRawCredential;
      }
      return getCredentialRaw(id);
    });

    await expect(
      db.getHyperLiquidAgentCredential({
        userAddress: originalCredential.userAddress,
        agentName: originalCredential.agentName,
      }),
    ).rejects.toThrow('HyperLiquid agent credential changed during update');
    expect(db.credentials[0].credential).toBe(rotatedRawCredential);
  });

  it('fails closed when a legacy plaintext agent credential cannot be wrapped', async () => {
    const db = new TestLocalDb();
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue(undefined);
    const credential = {
      userAddress: '0x1111111111111111111111111111111111111111',
      agentName: EHyperLiquidAgentName.OneKeyAgent1,
      privateKey:
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      agentAddress: '0x2222222222222222222222222222222222222222',
      validUntil: 1_900_000_000_000,
    };
    const credentialId = accountUtils.buildHyperLiquidAgentCredentialId({
      userAddress: credential.userAddress,
      agentName: credential.agentName,
    });
    const rawCredential = encryptHyperLiquidAgentCredential({ credential });
    db.credentials = [{ id: credentialId, credential: rawCredential }];

    await expect(
      db.getHyperLiquidAgentCredential({
        userAddress: credential.userAddress,
        agentName: credential.agentName,
      }),
    ).rejects.toBeInstanceOf(LocalSecretEnvelopeUnavailable);
    expect(db.credentials[0].credential).toBe(rawCredential);
  });

  it('stores restored imported account credentials as LSE after migration is complete', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    db.context.localPasswordKdfUpgraded = true;
    db.context.localPasswordKdfUpgradedTargetIterations =
      PBKDF2_CURRENT_NUM_OF_ITERATIONS;
    db.context.localSecretEnvelopeCredentialMigrated = true;
    db.context.localSecretEnvelopeCredentialMigratedTargetVersion = 2;
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

  it('refreshes an existing imported account credential during restore', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    db.context.localPasswordKdfUpgraded = true;
    db.context.localPasswordKdfUpgradedTargetIterations =
      PBKDF2_CURRENT_NUM_OF_ITERATIONS;
    db.context.localSecretEnvelopeCredentialMigrated = true;
    db.context.localSecretEnvelopeCredentialMigratedTargetVersion = 2;
    db.wallets = [
      db.buildSingletonWalletRecord({ walletId: WALLET_TYPE_IMPORTED }),
    ];
    const accountId = 'imported--60--public-key';
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
    db.accounts = [restoredAccount];
    db.wallets[0].accounts = [accountId];
    const oldImportedCredential = await encryptImportedCredential({
      credential: { privateKey: 'old-private-key-hex' },
      password,
    });
    const nextImportedCredential = await encryptImportedCredential({
      credential: { privateKey: 'next-private-key-hex' },
      password,
    });
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
    db.credentials = [
      {
        id: accountId,
        credential: await wrapLocalSecretEnvelopeV1({
          dataType: 'credential',
          layerAdapters: [adapter],
          plaintext: oldImportedCredential,
          recordId: accountId,
          strength: 'profile-bound',
        }),
      },
    ];

    await db.addAccountsToWallet({
      walletId: WALLET_TYPE_IMPORTED,
      importedCredential: nextImportedCredential,
      applyRestoreSyncPolicy: true,
      skipEventEmit: true,
      accounts: [restoredAccount],
    });

    const innerCredential = await db.getCredentialInner({
      credentialId: accountId,
      resolveLayerAdapter: (layer) =>
        layer.kind === adapter.kind ? adapter : undefined,
    });
    expect(innerCredential.credential).toBe(nextImportedCredential);
    expect(deleteLayerKey).toHaveBeenCalledTimes(1);
  });

  it('reuses an existing imported account credential during restore when no new credential is provided', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    db.context.localPasswordKdfUpgraded = true;
    db.context.localPasswordKdfUpgradedTargetIterations =
      PBKDF2_CURRENT_NUM_OF_ITERATIONS;
    db.context.localSecretEnvelopeCredentialMigrated = true;
    db.context.localSecretEnvelopeCredentialMigratedTargetVersion = 2;
    db.wallets = [
      db.buildSingletonWalletRecord({ walletId: WALLET_TYPE_IMPORTED }),
    ];
    const accountId = 'imported--60--public-key';
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
    db.accounts = [restoredAccount];
    db.wallets[0].accounts = [accountId];
    const existingImportedCredential = await encryptImportedCredential({
      credential: { privateKey: 'existing-private-key-hex' },
      password,
    });
    const deleteLayerKey = jest.fn();
    const adapter = buildMockLocalSecretEnvelopeLayerAdapter({
      deleteLayerKey,
    });
    const existingEnvelope = await wrapLocalSecretEnvelopeV1({
      dataType: 'credential',
      layerAdapters: [adapter],
      plaintext: existingImportedCredential,
      recordId: accountId,
      strength: 'profile-bound',
    });
    db.credentials = [
      {
        id: accountId,
        credential: existingEnvelope,
      },
    ];

    await db.addAccountsToWallet({
      walletId: WALLET_TYPE_IMPORTED,
      applyRestoreSyncPolicy: true,
      skipEventEmit: true,
      accounts: [restoredAccount],
    });

    expect(db.credentials[0].credential).toBe(existingEnvelope);
    const innerCredential = await db.getCredentialInner({
      credentialId: accountId,
      resolveLayerAdapter: (layer) =>
        layer.kind === adapter.kind ? adapter : undefined,
    });
    expect(innerCredential.credential).toBe(existingImportedCredential);
    expect(deleteLayerKey).not.toHaveBeenCalled();
  });

  it('refreshes an orphan imported credential during restore', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    db.context.localPasswordKdfUpgraded = true;
    db.context.localPasswordKdfUpgradedTargetIterations =
      PBKDF2_CURRENT_NUM_OF_ITERATIONS;
    db.context.localSecretEnvelopeCredentialMigrated = true;
    db.context.localSecretEnvelopeCredentialMigratedTargetVersion = 2;
    db.wallets = [
      db.buildSingletonWalletRecord({ walletId: WALLET_TYPE_IMPORTED }),
    ];
    const accountId = 'imported--60--public-key';
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
    const oldImportedCredential = await encryptImportedCredential({
      credential: { privateKey: 'old-private-key-hex' },
      password,
    });
    const nextImportedCredential = await encryptImportedCredential({
      credential: { privateKey: 'next-private-key-hex' },
      password,
    });
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
    db.credentials = [
      {
        id: accountId,
        credential: await wrapLocalSecretEnvelopeV1({
          dataType: 'credential',
          layerAdapters: [adapter],
          plaintext: oldImportedCredential,
          recordId: accountId,
          strength: 'profile-bound',
        }),
      },
    ];

    await db.addAccountsToWallet({
      walletId: WALLET_TYPE_IMPORTED,
      importedCredential: nextImportedCredential,
      applyRestoreSyncPolicy: true,
      skipEventEmit: true,
      accounts: [restoredAccount],
    });

    expect(db.accounts).toEqual([restoredAccount]);
    expect(db.wallets[0].accounts).toEqual([accountId]);
    const innerCredential = await db.getCredentialInner({
      credentialId: accountId,
      resolveLayerAdapter: (layer) =>
        layer.kind === adapter.kind ? adapter : undefined,
    });
    expect(innerCredential.credential).toBe(nextImportedCredential);
    expect(deleteLayerKey).toHaveBeenCalledTimes(1);
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
    db.context.localSecretEnvelopeCredentialMigratedTargetVersion = 2;
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
    const promise = db.wrapNewCredentialWithLocalSecretEnvelopeIfNeeded({
      credentialId: 'imported--60--public-key',
      credential: importedCredential,
    });
    await expect(promise).rejects.toBeInstanceOf(
      LocalSecretEnvelopeUnavailable,
    );
    await expect(promise).rejects.toMatchObject({
      autoToast: true,
      data: {
        [LOCAL_SECRET_ENVELOPE_ERROR_DATA_TYPE_FIELD]:
          LOCAL_SECRET_ENVELOPE_CREDENTIAL_ERROR_DATA_TYPE,
      },
    });
    // Nothing was persisted raw, so the completed marker stays intact.
    expect(db.context.localSecretEnvelopeCredentialMigrated).toBe(true);
    expect(db.context.localSecretEnvelopeCredentialMigratedTargetVersion).toBe(
      2,
    );
  });

  it('marks a new credential LSE wrap failure for auto-toast and dialog', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    db.context.localPasswordKdfUpgraded = true;
    db.context.localPasswordKdfUpgradedTargetIterations =
      PBKDF2_CURRENT_NUM_OF_ITERATIONS;
    db.context.localSecretEnvelopeCredentialMigrated = true;
    db.context.localSecretEnvelopeCredentialMigratedTargetVersion = 2;
    const importedCredential = await encryptImportedCredential({
      credential: { privateKey: 'private-key-hex' },
      password,
    });
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue({
        layerAdapters: [
          buildMockLocalSecretEnvelopeLayerAdapter({ failEncrypt: true }),
        ],
        strength: 'profile-bound',
      });

    const promise = db.wrapNewCredentialWithLocalSecretEnvelopeIfNeeded({
      credentialId: 'imported--60--public-key',
      credential: importedCredential,
    });

    await expect(promise).rejects.toBeInstanceOf(
      LocalSecretEnvelopeUnavailable,
    );
    await expect(promise).rejects.toMatchObject({
      autoToast: true,
      data: {
        [LOCAL_SECRET_ENVELOPE_ERROR_DATA_TYPE_FIELD]:
          LOCAL_SECRET_ENVELOPE_CREDENTIAL_ERROR_DATA_TYPE,
      },
    });
  });

  it('falls back to the healthy base layer when enhancement encryption fails after probing', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    db.context.localPasswordKdfUpgraded = true;
    db.context.localPasswordKdfUpgradedTargetIterations =
      PBKDF2_CURRENT_NUM_OF_ITERATIONS;
    db.context.localSecretEnvelopeCredentialMigrated = true;
    db.context.localSecretEnvelopeCredentialMigratedTargetVersion = 2;
    const importedCredential = await encryptImportedCredential({
      credential: { privateKey: 'private-key-hex' },
      password,
    });
    const baseAdapter = buildMockLocalSecretEnvelopeLayerAdapter();
    const enhancementAdapter: ILocalSecretEnvelopeLayerAdapter = {
      ...buildMockLocalSecretEnvelopeLayerAdapter({ failEncrypt: true }),
      kind: 'secure-storage',
      prepareLayer: async () => ({
        alg: 'AES-256-GCM',
        capabilities: {
          extractable: 'unknown',
          keyAccess: 'raw-key-readable',
          sync: 'local-only',
        },
        iv: 'secure-storage-iv',
        keyRef: 'secure-storage-test-key',
        kind: 'secure-storage',
      }),
    };
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValueOnce({
        layerAdapters: [baseAdapter, enhancementAdapter],
        strength: 'secure-storage-bound',
      })
      .mockResolvedValue({
        layerAdapters: [baseAdapter],
        strength: 'profile-bound',
      });

    const wrapped = await db.wrapNewCredentialWithLocalSecretEnvelopeIfNeeded({
      credentialId: 'imported--60--public-key',
      credential: importedCredential,
    });

    expect(
      parseLocalSecretEnvelopeV1(wrapped).wrappingLayers.map(
        (layer) => layer.kind,
      ),
    ).toEqual(['indexeddb-cryptokey']);
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

  it('reads a historical secureStorage-only credential without the new mandatory base layer', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    const credential = await encryptRevealableSeed({
      rs: {
        entropyWithLangPrefixed: 'english:00010203',
        seed: 'seed-hex',
      },
      password,
    });
    const secureStorageAdapter = buildMockLocalSecretEnvelopeLayerAdapter({
      kind: 'secure-storage',
      keyRef: 'secure-storage-global-key:v1',
    });
    db.credentials = [
      {
        id: 'hd-1',
        credential: await wrapLocalSecretEnvelopeV1({
          dataType: 'credential',
          layerAdapters: [secureStorageAdapter],
          plaintext: credential,
          recordId: 'hd-1',
          strength: 'secure-storage-bound',
        }),
      },
    ];
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue(undefined);
    const requiredResolverSpy = jest
      .spyOn(db, 'buildRequiredLocalSecretEnvelopeLayerAdapterResolver')
      .mockResolvedValue((layer) =>
        layer.kind === secureStorageAdapter.kind
          ? secureStorageAdapter
          : undefined,
      );

    const innerCredential = await db.getCredentialInner({
      credentialId: 'hd-1',
    });

    expect(requiredResolverSpy).toHaveBeenCalledWith({
      requiredLayerKinds: ['secure-storage'],
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

  it('replaces an existing credential with a current LSE-wrapped credential', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    db.context.localPasswordKdfUpgraded = true;
    db.context.localPasswordKdfUpgradedTargetIterations =
      PBKDF2_CURRENT_NUM_OF_ITERATIONS;
    db.context.localSecretEnvelopeCredentialMigrated = true;
    db.context.localSecretEnvelopeCredentialMigratedTargetVersion = 2;
    const originalCredential = await encryptRevealableSeed({
      rs: {
        entropyWithLangPrefixed: 'english:00010203',
        seed: 'seed-hex',
      },
      password,
    });
    const nextCredential = await encryptRevealableSeed({
      rs: {
        entropyWithLangPrefixed: 'english:04050607',
        seed: 'seed-hex-2',
      },
      password,
    });
    const dbName = `test-lse-replace-cleanup-${Math.random()}`;
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
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue({
        layerAdapters: [adapter],
        strength: 'profile-bound',
      });
    const originalEnvelope = await wrapLocalSecretEnvelopeV1({
      dataType: 'credential',
      layerAdapters: [adapter],
      plaintext: originalCredential,
      recordId: 'hd-1',
      strength: 'profile-bound',
    });
    db.credentials = [{ id: 'hd-1', credential: originalEnvelope }];

    const replaced = await db.replaceCredentialWithLocalSecretEnvelopeIfNeeded({
      credentialId: 'hd-1',
      credential: nextCredential,
    });

    expect(replaced).toBe(true);
    expect(isLocalSecretEnvelopeString(db.credentials[0].credential)).toBe(
      true,
    );
    const innerCredential = await db.getCredentialInner({
      credentialId: 'hd-1',
      resolveLayerAdapter: (layer) =>
        layer.kind === adapter.kind ? adapter : undefined,
    });
    expect(innerCredential.credential).toBe(nextCredential);
    expect(deleteLayerKey).toHaveBeenCalledTimes(1);
  });

  it('refuses to downgrade an already-LSE credential when the layer is unavailable mid-migration', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    db.context.localPasswordKdfUpgraded = true;
    db.context.localPasswordKdfUpgradedTargetIterations =
      PBKDF2_CURRENT_NUM_OF_ITERATIONS;
    // Global migration flag intentionally NOT set: the per-record lazy
    // migration has already wrapped this credential, but the batch has not
    // completed yet, so the write helper still degrades to the raw portable
    // value when the layer config is unavailable.
    const originalCredential = await encryptRevealableSeed({
      rs: {
        entropyWithLangPrefixed: 'english:00010203',
        seed: 'seed-hex',
      },
      password,
    });
    const nextCredential = await encryptRevealableSeed({
      rs: {
        entropyWithLangPrefixed: 'english:04050607',
        seed: 'seed-hex-2',
      },
      password,
    });
    const adapter = buildMockLocalSecretEnvelopeLayerAdapter();
    const originalEnvelope = await wrapLocalSecretEnvelopeV1({
      dataType: 'credential',
      layerAdapters: [adapter],
      plaintext: originalCredential,
      recordId: 'hd-1',
      strength: 'profile-bound',
    });
    db.credentials = [{ id: 'hd-1', credential: originalEnvelope }];
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue(undefined);

    const promise = db.replaceCredentialWithLocalSecretEnvelopeIfNeeded({
      credentialId: 'hd-1',
      credential: nextCredential,
    });

    await expect(promise).rejects.toBeInstanceOf(
      LocalSecretEnvelopeUnavailable,
    );
    await expect(promise).rejects.toMatchObject({
      autoToast: true,
      data: {
        [LOCAL_SECRET_ENVELOPE_ERROR_DATA_TYPE_FIELD]:
          LOCAL_SECRET_ENVELOPE_CREDENTIAL_ERROR_DATA_TYPE,
      },
    });
    // The protected envelope stays untouched — no silent downgrade to the
    // portable value.
    expect(db.credentials[0].credential).toBe(originalEnvelope);
  });

  it('preserves an existing dual-layer envelope when the enhancement is temporarily unavailable', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    db.context.localPasswordKdfUpgraded = true;
    db.context.localPasswordKdfUpgradedTargetIterations =
      PBKDF2_CURRENT_NUM_OF_ITERATIONS;
    db.context.localSecretEnvelopeCredentialMigrated = true;
    db.context.localSecretEnvelopeCredentialMigratedTargetVersion = 2;
    const originalCredential = await encryptRevealableSeed({
      rs: {
        entropyWithLangPrefixed: 'english:00010203',
        seed: 'seed-hex',
      },
      password,
    });
    const nextCredential = await encryptRevealableSeed({
      rs: {
        entropyWithLangPrefixed: 'english:04050607',
        seed: 'seed-hex-2',
      },
      password,
    });
    const baseAdapter = buildMockLocalSecretEnvelopeLayerAdapter();
    const enhancementAdapter: ILocalSecretEnvelopeLayerAdapter = {
      ...buildMockLocalSecretEnvelopeLayerAdapter(),
      kind: 'secure-storage',
      prepareLayer: async () => ({
        alg: 'AES-256-GCM',
        capabilities: {
          extractable: 'unknown',
          keyAccess: 'raw-key-readable',
          sync: 'local-only',
        },
        iv: 'secure-storage-iv',
        keyRef: 'secure-storage-test-key',
        kind: 'secure-storage',
      }),
    };
    const originalEnvelope = await wrapLocalSecretEnvelopeV1({
      dataType: 'credential',
      layerAdapters: [baseAdapter, enhancementAdapter],
      plaintext: originalCredential,
      recordId: 'hd-1',
      strength: 'secure-storage-bound',
    });
    db.credentials = [{ id: 'hd-1', credential: originalEnvelope }];
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue({
        layerAdapters: [baseAdapter],
        strength: 'profile-bound',
      });

    await expect(
      db.replaceCredentialWithLocalSecretEnvelopeIfNeeded({
        credentialId: 'hd-1',
        credential: nextCredential,
      }),
    ).rejects.toBeInstanceOf(LocalSecretEnvelopeUnavailable);
    expect(db.credentials[0].credential).toBe(originalEnvelope);
    expect(
      parseLocalSecretEnvelopeV1(db.credentials[0].credential).wrappingLayers,
    ).toHaveLength(2);
  });

  it('refreshes an existing TON mnemonic credential during restore', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    db.context.localPasswordKdfUpgraded = true;
    db.context.localPasswordKdfUpgradedTargetIterations =
      PBKDF2_CURRENT_NUM_OF_ITERATIONS;
    db.context.localSecretEnvelopeCredentialMigrated = true;
    db.context.localSecretEnvelopeCredentialMigratedTargetVersion = 2;
    const accountId = 'imported--607--public-key';
    const credentialId = accountUtils.buildTonMnemonicCredentialId({
      accountId,
    });
    const originalRs = await encryptRevealableSeed({
      rs: {
        entropyWithLangPrefixed: 'english:00010203',
        seed: 'seed-hex',
      },
      password,
    });
    const nextRs = await encryptRevealableSeed({
      rs: {
        entropyWithLangPrefixed: 'english:04050607',
        seed: 'seed-hex-2',
      },
      password,
    });
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
    db.credentials = [
      {
        id: credentialId,
        credential: await wrapLocalSecretEnvelopeV1({
          dataType: 'credential',
          layerAdapters: [adapter],
          plaintext: originalRs,
          recordId: credentialId,
          strength: 'profile-bound',
        }),
      },
    ];

    await db.saveTonImportedAccountMnemonic({
      accountId,
      rs: nextRs,
    });

    const innerCredential = await db.getCredentialInner({
      credentialId,
      resolveLayerAdapter: (layer) =>
        layer.kind === adapter.kind ? adapter : undefined,
    });
    expect(innerCredential.credential).toBe(nextRs);
    expect(deleteLayerKey).toHaveBeenCalledTimes(1);
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

    const promise = db.getCredentialInner({
      credentialId: 'hd-1',
    });

    await expect(promise).rejects.toMatchObject({
      autoToast: true,
      data: {
        [LOCAL_SECRET_ENVELOPE_ERROR_DATA_TYPE_FIELD]:
          LOCAL_SECRET_ENVELOPE_CREDENTIAL_ERROR_DATA_TYPE,
      },
      message:
        'Local secret envelope layer adapter is required: requiredLayers=indexeddb-cryptokey@0',
    });
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

  it('keeps verifyString portable during LSE migration and still verifies the password', async () => {
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

    expect(isLocalSecretEnvelopeString(db.context.verifyString)).toBe(false);
    await expect(
      db.verifyPassword({ password, skipLazyUpgrade: true }),
    ).resolves.toBeUndefined();
  });

  it('removes a legacy LSE verifyString when its local layer is available', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    const originalVerifyString = await encryptVerifyString({ password });
    db.context.localPasswordKdfUpgraded = true;
    db.context.localPasswordKdfUpgradedTargetIterations =
      PBKDF2_CURRENT_NUM_OF_ITERATIONS;
    const deleteLayerKey = jest.fn();
    const adapter = buildMockLocalSecretEnvelopeLayerAdapter({
      deleteLayerKey,
    });
    db.context.verifyString = await buildLegacyLocalSecretEnvelopeVerifyString({
      adapter,
      verifyString: originalVerifyString,
    });
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue({
        layerAdapters: [adapter],
        strength: 'profile-bound',
      });

    await db.lazyMigrateLocalSecretEnvelopeCredentialsAfterUnlock();

    expect(db.context.verifyString).toBe(originalVerifyString);
    expect(isLocalSecretEnvelopeString(db.context.verifyString)).toBe(false);
    expect(deleteLayerKey).toHaveBeenCalledTimes(1);
    await expect(
      db.verifyPassword({ password, skipLazyUpgrade: true }),
    ).resolves.toBeUndefined();
  });

  it('does not report WrongPassword when the LSE verifyString layer cannot decrypt', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    const adapter = buildMockLocalSecretEnvelopeLayerAdapter();
    db.context.verifyString = await buildLegacyLocalSecretEnvelopeVerifyString({
      adapter,
      verifyString: await encryptVerifyString({ password }),
    });
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue({
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

    db.context.verifyString = await buildLegacyLocalSecretEnvelopeVerifyString({
      adapter,
      verifyString: originalVerifyString,
    });
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
    const adapter = buildMockLocalSecretEnvelopeLayerAdapter();
    db.context.verifyString = await buildLegacyLocalSecretEnvelopeVerifyString({
      adapter,
      verifyString: await encryptVerifyString({ password }),
    });
    const configSpy = jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue({
        layerAdapters: [adapter],
        strength: 'profile-bound',
      });
    expect(isLocalSecretEnvelopeString(db.context.verifyString)).toBe(true);

    // Capability stays unavailable even after the re-probe: the correct password
    // must surface a retryable error, never a misleading WrongPassword/false.
    configSpy.mockReset();
    configSpy.mockResolvedValue(undefined);

    await expect(
      db.verifyPassword({ password, skipLazyUpgrade: true }),
    ).rejects.toBeInstanceOf(LocalSecretEnvelopeUnavailable);
  });

  it('does not mark the session complete if legacy LSE verifyString removal fails', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    const adapter = buildMockLocalSecretEnvelopeLayerAdapter();
    db.context.verifyString = await buildLegacyLocalSecretEnvelopeVerifyString({
      adapter,
      verifyString: await encryptVerifyString({ password }),
    });
    db.context.localPasswordKdfUpgraded = true;
    db.context.localPasswordKdfUpgradedTargetIterations =
      PBKDF2_CURRENT_NUM_OF_ITERATIONS;
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue({
        layerAdapters: [
          buildMockLocalSecretEnvelopeLayerAdapter({ failDecrypt: true }),
        ],
        strength: 'profile-bound',
      });

    await db.lazyMigrateLocalSecretEnvelopeCredentialsAfterUnlock();

    expect(isLocalSecretEnvelopeString(db.context.verifyString)).toBe(true);
    expect(db.context.localSecretEnvelopeCredentialMigrated).toBe(true);
    expect(db._localSecretEnvelopeCredentialMigrationExecuted).toBe(false);
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
      2,
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
      2,
    );
  });

  it('defers online HLP credentials to the browser-class HLE migration', async () => {
    const db = new TestLocalDb();
    db.context.localPasswordKdfUpgraded = true;
    db.context.localPasswordKdfUpgradedTargetIterations =
      PBKDF2_CURRENT_NUM_OF_ITERATIONS;
    db.context.localSecretEnvelopeCredentialMigrated = true;
    db.context.localSecretEnvelopeCredentialMigratedTargetVersion = 1;
    const credential = {
      userAddress: '0x1111111111111111111111111111111111111111',
      agentName: EHyperLiquidAgentName.OneKeyAgent1,
      privateKey:
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      agentAddress: '0x2222222222222222222222222222222222222222',
      validUntil: 1_900_000_000_000,
    };
    const credentialId = accountUtils.buildHyperLiquidAgentCredentialId({
      userAddress: credential.userAddress,
      agentName: credential.agentName,
    });
    const onlineCredential = encryptHyperLiquidAgentCredential({ credential });
    db.credentials = [{ id: credentialId, credential: onlineCredential }];
    const adapter = buildMockLocalSecretEnvelopeLayerAdapter();
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue({
        layerAdapters: [adapter],
        strength: 'profile-bound',
      });

    await db.lazyMigrateLocalSecretEnvelopeCredentialsAfterUnlock();

    expect(db.credentials[0].credential).toBe(onlineCredential);
    expect(isLocalSecretEnvelopeString(db.credentials[0].credential)).toBe(
      false,
    );
    expect(db.context.localSecretEnvelopeCredentialMigrated).toBe(true);
    expect(db.context.localSecretEnvelopeCredentialMigratedTargetVersion).toBe(
      2,
    );
  });

  it('does not scan LSE credentials after the persistent migration marker is set', async () => {
    const db = new TestLocalDb();
    db.context.localPasswordKdfUpgraded = true;
    db.context.localPasswordKdfUpgradedTargetIterations =
      PBKDF2_CURRENT_NUM_OF_ITERATIONS;
    db.context.localSecretEnvelopeCredentialMigrated = true;
    db.context.localSecretEnvelopeCredentialMigratedTargetVersion = 2;
    const getAllCredentialsSpy = jest.spyOn(db, 'getAllCredentials');

    await db.lazyMigrateLocalSecretEnvelopeCredentialsAfterUnlock();

    expect(getAllCredentialsSpy).not.toHaveBeenCalled();
    expect(db._localSecretEnvelopeCredentialMigrationExecuted).toBe(true);
  });
});

describe('LocalDbBase HyperLiquid agent password session', () => {
  afterEach(async () => {
    await hyperLiquidAgentSecretSession.clear();
  });

  it('migrates an online HLP credential directly to LSE(HLE) on unlock', async () => {
    globalJotaiStorageReadyHandler.resolveReady(true);
    jotaiDefaultStore.set(settingsPersistAtom.atom(), {
      ...jotaiDefaultStore.get(settingsPersistAtom.atom()),
      sensitiveEncodeKey: 'test-hle-unlock-migration-salt',
    });
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    const credential = {
      userAddress: '0x1111111111111111111111111111111111111111',
      agentName: EHyperLiquidAgentName.OneKeyAgent1,
      privateKey:
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      agentAddress: '0x2222222222222222222222222222222222222222',
      validUntil: 2_000_000_000_000,
    };
    const credentialId = accountUtils.buildHyperLiquidAgentCredentialId({
      userAddress: credential.userAddress,
      agentName: credential.agentName,
    });
    const adapter = buildMockLocalSecretEnvelopeLayerAdapter();
    db.credentials = [
      {
        id: credentialId,
        credential: encryptHyperLiquidAgentCredential({ credential }),
      },
    ];
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue({
        layerAdapters: [adapter],
        strength: 'profile-bound',
      });

    await db.unlockHyperLiquidAgentSecretSession({
      password,
    });
    expect(hyperLiquidAgentSecretSession.isReady()).toBe(true);

    const storedCredential = db.credentials[0].credential;
    expect(isLocalSecretEnvelopeString(storedCredential)).toBe(true);
    expect(parseLocalSecretEnvelopeV1(storedCredential).innerPrefix).toBe(
      '|HLE|',
    );
    expect(storedCredential).not.toContain(credential.privateKey);
    await expect(
      db.getHyperLiquidAgentCredential({
        userAddress: credential.userAddress,
        agentName: credential.agentName,
      }),
    ).resolves.toEqual(credential);
  });

  it('skips session derivation on unlock when no agent credentials exist', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    db.credentials = [];

    await db.unlockHyperLiquidAgentSecretSession({
      password,
      skipWhenNoCredentials: true,
    });

    expect(hyperLiquidAgentSecretSession.isReady()).toBe(false);
  });

  it('clears a stale session when replacing the password with no agent credentials', async () => {
    globalJotaiStorageReadyHandler.resolveReady(true);
    jotaiDefaultStore.set(settingsPersistAtom.atom(), {
      ...jotaiDefaultStore.get(settingsPersistAtom.atom()),
      sensitiveEncodeKey: 'test-hle-stale-session-salt',
    });
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    const otherPassword = await encodePasswordAsync({
      password: 'new-password',
    });
    db.credentials = [];

    await db.unlockHyperLiquidAgentSecretSession({ password });
    expect(hyperLiquidAgentSecretSession.isReady()).toBe(true);

    await db.unlockHyperLiquidAgentSecretSession({
      password: otherPassword,
      replaceSessionKey: true,
      skipWhenNoCredentials: true,
    });

    expect(hyperLiquidAgentSecretSession.isReady()).toBe(false);
  });

  it('establishes the session on demand when adding the first agent credential', async () => {
    globalJotaiStorageReadyHandler.resolveReady(true);
    jotaiDefaultStore.set(settingsPersistAtom.atom(), {
      ...jotaiDefaultStore.get(settingsPersistAtom.atom()),
      sensitiveEncodeKey: 'test-hle-on-demand-init-salt',
    });
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    db.credentials = [];
    db.getCachedPasswordMock.mockResolvedValue(password);
    const adapter = buildMockLocalSecretEnvelopeLayerAdapter();
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue({
        layerAdapters: [adapter],
        strength: 'profile-bound',
      });
    const credential = {
      userAddress: '0x3333333333333333333333333333333333333333',
      agentName: EHyperLiquidAgentName.OneKeyAgent1,
      privateKey:
        '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      agentAddress: '0x4444444444444444444444444444444444444444',
      validUntil: 2_000_000_000_000,
    };
    const credentialId = accountUtils.buildHyperLiquidAgentCredentialId({
      userAddress: credential.userAddress,
      agentName: credential.agentName,
    });
    expect(hyperLiquidAgentSecretSession.isReady()).toBe(false);

    await expect(
      db.addHyperLiquidAgentCredential({ credential }),
    ).resolves.toEqual({ credentialId });

    expect(db.getCachedPasswordMock).toHaveBeenCalled();
    expect(hyperLiquidAgentSecretSession.isReady()).toBe(true);
    const storedCredential = db.credentials[0].credential;
    expect(isLocalSecretEnvelopeString(storedCredential)).toBe(true);
    expect(parseLocalSecretEnvelopeV1(storedCredential).innerPrefix).toBe(
      '|HLE|',
    );
    expect(storedCredential).not.toContain(credential.privateKey);
    await expect(
      db.getHyperLiquidAgentCredential({
        userAddress: credential.userAddress,
        agentName: credential.agentName,
      }),
    ).resolves.toEqual(credential);
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
  it('keeps verifyString portable on initial password setup and marks KDF completed for an empty DB', async () => {
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
  it('updates persisted HLE credentials in the password transaction', async () => {
    globalJotaiStorageReadyHandler.resolveReady(true);
    jotaiDefaultStore.set(settingsPersistAtom.atom(), {
      ...jotaiDefaultStore.get(settingsPersistAtom.atom()),
      sensitiveEncodeKey: 'test-hle-password-update-salt',
    });
    const db = new TestLocalDb();
    const oldPassword = await encodePasswordAsync({ password: 'old-password' });
    const newPassword = await encodePasswordAsync({ password: 'new-password' });
    db.context.verifyString = await encryptVerifyString({
      password: oldPassword,
    });
    const credential = {
      userAddress: '0x1111111111111111111111111111111111111111',
      agentName: EHyperLiquidAgentName.OneKeyAgent1,
      privateKey:
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      agentAddress: '0x2222222222222222222222222222222222222222',
      validUntil: 2_000_000_000_000,
    };
    const credentialId = accountUtils.buildHyperLiquidAgentCredentialId({
      userAddress: credential.userAddress,
      agentName: credential.agentName,
    });
    const oldDerivedKey = await deriveHyperLiquidAgentSecretKey({
      password: oldPassword,
    });
    oldDerivedKey.rawKey.fill(0);
    const adapter = buildMockLocalSecretEnvelopeLayerAdapter();
    db.credentials = [
      {
        id: credentialId,
        credential: await wrapLocalSecretEnvelopeV1({
          dataType: 'credential',
          layerAdapters: [adapter],
          plaintext: await encryptHyperLiquidAgentCredentialWithSessionKey({
            credential,
            key: oldDerivedKey.key,
            recordId: credentialId,
          }),
          recordId: credentialId,
          strength: 'profile-bound',
        }),
      },
    ];
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue({
        layerAdapters: [adapter],
        strength: 'profile-bound',
      });

    await db.updatePassword({ oldPassword, newPassword });

    const nextInnerCredential = await db.getCredentialInner({ credentialId });
    const newDerivedKey = await deriveHyperLiquidAgentSecretKey({
      password: newPassword,
    });
    newDerivedKey.rawKey.fill(0);
    await expect(
      decryptHyperLiquidAgentCredentialWithSessionKey({
        credential: nextInnerCredential.credential,
        key: newDerivedKey.key,
        recordId: credentialId,
      }),
    ).resolves.toEqual(credential);
    await expect(
      decryptHyperLiquidAgentCredentialWithSessionKey({
        credential: nextInnerCredential.credential,
        key: oldDerivedKey.key,
        recordId: credentialId,
      }),
    ).rejects.toThrow();
  });

  it('re-encrypts an HLE credential with the new password key', async () => {
    const db = new TestLocalDb();
    const credential = {
      userAddress: '0x1111111111111111111111111111111111111111',
      agentName: EHyperLiquidAgentName.OneKeyAgent1,
      privateKey:
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      agentAddress: '0x2222222222222222222222222222222222222222',
      validUntil: 2_000_000_000_000,
    };
    const credentialId = accountUtils.buildHyperLiquidAgentCredentialId({
      userAddress: credential.userAddress,
      agentName: credential.agentName,
    });
    const [oldKey, newKey] = await Promise.all([
      crypto.subtle.generateKey({ length: 256, name: 'AES-GCM' }, false, [
        'encrypt',
        'decrypt',
      ]),
      crypto.subtle.generateKey({ length: 256, name: 'AES-GCM' }, false, [
        'encrypt',
        'decrypt',
      ]),
    ]);
    const adapter = buildMockLocalSecretEnvelopeLayerAdapter();
    const originalInnerCredential =
      await encryptHyperLiquidAgentCredentialWithSessionKey({
        credential,
        key: oldKey,
        recordId: credentialId,
      });
    const originalCredential = await wrapLocalSecretEnvelopeV1({
      dataType: 'credential',
      layerAdapters: [adapter],
      plaintext: originalInnerCredential,
      recordId: credentialId,
      strength: 'profile-bound',
    });
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue({
        layerAdapters: [adapter],
        strength: 'profile-bound',
      });

    const prepared = await db.buildCredentialPasswordUpdate({
      credential: { id: credentialId, credential: originalCredential },
      hyperLiquidAgentPasswordUpdateKeys: { newKey, oldKey },
      kdfParams: {},
      newPassword: 'unused',
      oldPassword: 'unused',
    });

    const nextInnerCredential = await unwrapLocalSecretEnvelopeV1({
      envelope: prepared.nextCredential,
      expectedDataType: 'credential',
      expectedRecordId: credentialId,
      resolveLayerAdapter: () => adapter,
    });
    await expect(
      decryptHyperLiquidAgentCredentialWithSessionKey({
        credential: nextInnerCredential,
        key: newKey,
        recordId: credentialId,
      }),
    ).resolves.toEqual(credential);
    await expect(
      decryptHyperLiquidAgentCredentialWithSessionKey({
        credential: nextInnerCredential,
        key: oldKey,
        recordId: credentialId,
      }),
    ).rejects.toThrow();
  });

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
    expect(isLocalSecretEnvelopeString(db.context.verifyString)).toBe(false);
    const verifyStringResult = await decryptVerifyStringWithMetadata({
      password: newPassword,
      verifyString: db.context.verifyString,
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

  it('upgrades a readable single-layer LSE credential on password change', async () => {
    const db = new TestLocalDb();
    const oldPassword = await encodePasswordAsync({ password: 'old-password' });
    const newPassword = await encodePasswordAsync({ password: 'new-password' });
    const revealableSeed = {
      entropyWithLangPrefixed: 'english:00010203',
      seed: 'seed-hex',
    };
    const oldBaseAdapter = buildMockLocalSecretEnvelopeLayerAdapter({
      keyRef: 'indexeddb:old-device-key:v1',
    });
    const deleteBaseLayerKey = jest.fn();
    const nextBaseAdapter = buildMockLocalSecretEnvelopeLayerAdapter({
      deleteLayerKey: deleteBaseLayerKey,
      keyRef: 'indexeddb:next-device-key:v1',
    });
    const enhancementAdapter = buildMockLocalSecretEnvelopeLayerAdapter({
      keyRef: 'secure-storage-global-key:v1',
      kind: 'secure-storage',
    });
    db.context.verifyString = await encryptVerifyString({
      password: oldPassword,
    });
    const innerCredential = await encryptRevealableSeed({
      rs: revealableSeed,
      password: oldPassword,
    });
    const originalEnvelope = await wrapLocalSecretEnvelopeV1({
      dataType: 'credential',
      layerAdapters: [oldBaseAdapter],
      plaintext: innerCredential,
      recordId: 'hd-1',
      strength: 'profile-bound',
    });
    db.credentials = [{ id: 'hd-1', credential: originalEnvelope }];
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue({
        layerAdapters: [nextBaseAdapter, enhancementAdapter],
        strength: 'secure-storage-bound',
      });

    await db.updatePassword({ oldPassword, newPassword });

    const nextEnvelope = parseLocalSecretEnvelopeV1(
      db.credentials[0].credential,
    );
    expect(nextEnvelope.wrappingLayers.map((layer) => layer.kind)).toEqual([
      'indexeddb-cryptokey',
      'secure-storage',
    ]);
    expect(nextEnvelope.wrappingLayers[0].keyRef).toBe(
      'indexeddb:old-device-key:v1',
    );
    expect(deleteBaseLayerKey).not.toHaveBeenCalled();

    const backupInnerCredential = await unwrapLocalSecretEnvelopeV1({
      envelope: originalEnvelope,
      expectedDataType: 'credential',
      expectedRecordId: 'hd-1',
      resolveLayerAdapter: () => oldBaseAdapter,
    });
    const backupResult = await decryptRevealableSeedWithMetadata({
      password: oldPassword,
      rs: backupInnerCredential,
    });
    expect(backupResult.plaintext).toEqual(revealableSeed);

    const nextInnerCredential = await db.getCredentialInner({
      credentialId: 'hd-1',
    });
    const result = await decryptRevealableSeedWithMetadata({
      password: newPassword,
      rs: nextInnerCredential.credential,
    });
    expect(result.plaintext).toEqual(revealableSeed);
  });

  it('marks an LSE credential unwrap failure during password update for auto-toast and dialog', async () => {
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
          rs: {
            entropyWithLangPrefixed: 'english:00010203',
            seed: 'seed-hex',
          },
          password: oldPassword,
        }),
      },
    ];
    const adapter = buildMockLocalSecretEnvelopeLayerAdapter();
    await db.migrateCredentialToLocalSecretEnvelopeIfNeeded({
      credential: { ...db.credentials[0] },
      layerAdapters: [adapter],
      strength: 'profile-bound',
    });
    expect(isLocalSecretEnvelopeString(db.credentials[0].credential)).toBe(
      true,
    );
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue(undefined);

    const promise = db.updatePassword({ oldPassword, newPassword });

    await expect(promise).rejects.toBeInstanceOf(
      LocalSecretEnvelopeUnavailable,
    );
    await expect(promise).rejects.toMatchObject({
      autoToast: true,
      data: {
        [LOCAL_SECRET_ENVELOPE_ERROR_DATA_TYPE_FIELD]:
          LOCAL_SECRET_ENVELOPE_CREDENTIAL_ERROR_DATA_TYPE,
      },
    });
  });

  it('removes legacy LSE verifyString when changing password', async () => {
    const db = new TestLocalDb();
    const oldPassword = await encodePasswordAsync({ password: 'old-password' });
    const newPassword = await encodePasswordAsync({ password: 'new-password' });
    const deleteLayerKey = jest.fn();
    const adapter = buildMockLocalSecretEnvelopeLayerAdapter();
    const cleanupAdapter = buildMockLocalSecretEnvelopeLayerAdapter({
      deleteLayerKey,
    });
    jest
      .spyOn(db, 'buildLocalSecretEnvelopeCredentialMigrationConfig')
      .mockResolvedValue({
        layerAdapters: [cleanupAdapter],
        strength: 'profile-bound',
      });
    const originalVerifyString = await encryptVerifyString({
      password: oldPassword,
    });
    db.context.verifyString = await buildLegacyLocalSecretEnvelopeVerifyString({
      adapter,
      verifyString: originalVerifyString,
    });
    const originalVerifyStringEnvelope = parseLocalSecretEnvelopeV1(
      db.context.verifyString,
    );
    expect(originalVerifyStringEnvelope.dataType).toBe('verify-string');

    await db.updatePassword({ oldPassword, newPassword });

    expect(isLocalSecretEnvelopeString(db.context.verifyString)).toBe(false);
    expect(deleteLayerKey).toHaveBeenCalledTimes(1);
    const verifyStringResult = await decryptVerifyStringWithMetadata({
      password: newPassword,
      verifyString: db.context.verifyString,
    });
    expect(verifyStringResult.plaintext).toBe(DEFAULT_VERIFY_STRING);
  });

  it('does not wrap verifyString through the legacy migration shim', async () => {
    const db = new TestLocalDb();
    const password = await encodePasswordAsync({ password: 'test-password' });
    const adapter = buildMockLocalSecretEnvelopeLayerAdapter();
    db.context.verifyString = await encryptVerifyString({
      password,
    });

    await db.migrateContextVerifyStringToLocalSecretEnvelopeIfNeeded({
      layerAdapters: [adapter],
      strength: 'profile-bound',
    });

    expect(isLocalSecretEnvelopeString(db.context.verifyString)).toBe(false);
    const verifyStringResult = await decryptVerifyStringWithMetadata({
      password,
      verifyString: db.context.verifyString,
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
