import { uniq } from 'lodash';
import natsort from 'natsort';

import {
  decryptImportedCredentialWithMetadata,
  decryptRevealableSeedWithMetadata,
  decryptVerifyStringWithMetadata,
  encodePasswordAsync,
  encryptImportedCredential,
  encryptRevealableSeed,
  encryptVerifyString,
} from '@onekeyhq/core/src/secret';
import type { IBackgroundMethodWithDevOnlyPassword } from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  backgroundClass,
  backgroundMethodForDev,
  checkDevOnlyPassword,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  DB_MAIN_CONTEXT_ID,
  DEFAULT_VERIFY_STRING,
} from '@onekeyhq/shared/src/consts/dbConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import secureStorageInstance from '@onekeyhq/shared/src/storage/instance/secureStorageInstance';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { swrCacheUtils } from '@onekeyhq/shared/src/utils/swrCacheUtils';

import localDb from '../dbs/local/localDb';
import { ELocalDBStoreNames } from '../dbs/local/localDBStoreNames';
import {
  buildLocalSecretEnvelopeLayerAdapterResolver,
  buildSecureStorageLocalSecretEnvelopeLayerAdapter,
  deleteIndexedDbCryptoKeyForLocalSecretEnvelope,
  isLocalSecretEnvelopeString,
  parseLocalSecretEnvelopeV1,
  unwrapLocalSecretEnvelopeV1,
  wrapLocalSecretEnvelopeV1,
} from '../dbs/local/localSecretEnvelope';
import { EIndexedDBBucketNames } from '../dbs/local/types';
import {
  settingsAtomInitialValue,
  settingsPersistAtom,
} from '../states/jotai/atoms';
import { addressBookPersistAtom } from '../states/jotai/atoms/addressBooks';
import {
  passwordAtomInitialValue,
  passwordPersistAtom,
} from '../states/jotai/atoms/password';

import ServiceBase from './ServiceBase';
import { buildLegacyCredentialsForCloudBackup } from './ServiceCloudBackup/credentialUtils';
import { normalizePrimeTransferCredential } from './ServicePrimeTransfer/servicePrimeTransferUtils';

import type {
  ILocalSecretEnvelopeLayerAdapter,
  ILocalSecretEnvelopeLayerKind,
  ILocalSecretEnvelopeRuntimePlatform,
  ILocalSecretEnvelopeStrength,
  ILocalSecretEnvelopeV1,
} from '../dbs/local/localSecretEnvelope';
import type {
  IDBAccount,
  IDBBaseObject,
  IDBCredentialBase,
  IDBDevice,
} from '../dbs/local/types';

type ILocalSecretEnvelopeE2ESelfTestResult = {
  credentialLayerKinds: ILocalSecretEnvelopeLayerKind[];
  credentialStrength: ILocalSecretEnvelopeStrength;
  cryptoKeyDeletionBlocksUnwrap: boolean;
  layerDeletionBlocksUnwrap: Partial<
    Record<ILocalSecretEnvelopeLayerKind, boolean>
  >;
  runtimePlatform: string;
  secureStorageDeletionBlocksUnwrap: boolean;
  verifyStringIsLse: boolean;
  verifyStringLayerKinds: ILocalSecretEnvelopeLayerKind[];
  verifyStringStrength: ILocalSecretEnvelopeStrength;
};

type ILocalSecretEnvelopeRestoreSelfTestResult = {
  backupPortableCredentialPrefix: string;
  backupRejectsRawLocalSecretEnvelope: boolean;
  credentialLayerKinds: ILocalSecretEnvelopeLayerKind[];
  credentialStrength: ILocalSecretEnvelopeStrength;
  innerCredentialPrefix: string;
  primeTransferPortableCredentialPrefix: string;
  primeTransferRejectsRawLocalSecretEnvelope: boolean;
  rawCredentialIsLse: boolean;
  runtimePlatform: string;
};

type ILocalSecretEnvelopeE2ESelfTestOptions = {
  expectedCredentialLayerKinds?: ILocalSecretEnvelopeLayerKind[];
  expectedRuntimePlatform?: ILocalSecretEnvelopeRuntimePlatform;
  expectedStrength?: ILocalSecretEnvelopeStrength;
};

const LOCAL_SECRET_ENVELOPE_E2E_PASSWORD = 'onekey-lse-e2e-password';
const LOCAL_SECRET_ENVELOPE_E2E_CREDENTIAL_ID_PREFIX = 'hd-lse-e2e-credential';
const LOCAL_SECRET_ENVELOPE_E2E_RESTORE_CREDENTIAL_ID_PREFIX =
  'imported-lse-restore-e2e-credential';

function assertLocalSecretEnvelopeE2E(
  condition: boolean,
  message: string,
): asserts condition {
  if (!condition) {
    throw new OneKeyLocalError(message);
  }
}

function getLocalSecretEnvelopeLayerKinds(envelope: ILocalSecretEnvelopeV1) {
  return envelope.wrappingLayers.map((layer) => layer.kind);
}

function assertLocalSecretEnvelopeLayerKinds({
  actualLayerKinds,
  expectedLayerKinds,
  label,
}: {
  actualLayerKinds: ILocalSecretEnvelopeLayerKind[];
  expectedLayerKinds: ILocalSecretEnvelopeLayerKind[];
  label: string;
}) {
  assertLocalSecretEnvelopeE2E(
    actualLayerKinds.length === expectedLayerKinds.length &&
      actualLayerKinds.every(
        (kind, index) => kind === expectedLayerKinds[index],
      ),
    `Local secret envelope ${label} layers mismatch: expected ${expectedLayerKinds.join(
      ',',
    )}, got ${actualLayerKinds.join(',')}`,
  );
}

async function removeLocalSecretEnvelopeLayerKey({
  keyRef,
  kind,
}: ILocalSecretEnvelopeV1['wrappingLayers'][number]) {
  if (kind === 'indexeddb-cryptokey') {
    await deleteIndexedDbCryptoKeyForLocalSecretEnvelope({
      keyRef,
    });
  }
}

async function checkSecureStorageDeletionBlocksUnwrapInIsolatedLayer({
  index,
  runId,
}: {
  index: number;
  runId: string;
}): Promise<boolean> {
  const keyRef = `onekey:lse:e2e:secure-storage:${runId}:${index}`;
  const recordId = `lse-e2e-secure-storage-${runId}-${index}`;
  const plaintext = '|PK|lse-e2e-secure-storage-portable-payload';
  const adapter = buildSecureStorageLocalSecretEnvelopeLayerAdapter({
    keyRef,
    secureStorage: secureStorageInstance,
  });
  let envelope: ILocalSecretEnvelopeV1 | undefined;

  try {
    const wrapped = await wrapLocalSecretEnvelopeV1({
      dataType: 'credential',
      layerAdapters: [adapter],
      plaintext,
      recordId,
      strength: 'secure-storage-bound',
    });
    envelope = parseLocalSecretEnvelopeV1(wrapped);
    const restored = await unwrapLocalSecretEnvelopeV1({
      envelope: wrapped,
      expectedDataType: 'credential',
      expectedRecordId: recordId,
      resolveLayerAdapter: () => adapter,
    });
    if (restored !== plaintext) {
      return false;
    }

    await secureStorageInstance.removeSecureItem(
      envelope.wrappingLayers[0].keyRef,
    );
    try {
      await unwrapLocalSecretEnvelopeV1({
        envelope: wrapped,
        expectedDataType: 'credential',
        expectedRecordId: recordId,
        resolveLayerAdapter: () => adapter,
      });
      return false;
    } catch {
      return true;
    }
  } finally {
    if (envelope) {
      await secureStorageInstance
        .removeSecureItem(envelope.wrappingLayers[0].keyRef)
        .catch(() => undefined);
    }
  }
}

async function removeLocalSecretEnvelopeLayerKeys(
  envelope: ILocalSecretEnvelopeV1 | undefined,
) {
  if (!envelope) {
    return;
  }
  for (const layer of envelope.wrappingLayers) {
    try {
      await removeLocalSecretEnvelopeLayerKey(layer);
    } catch {
      // Best-effort cleanup for E2E-only local keys.
    }
  }
}

function buildLocalSecretEnvelopeE2ECredentialId({
  index,
  layerKind,
}: {
  index: number;
  layerKind: ILocalSecretEnvelopeLayerKind;
}) {
  return `${LOCAL_SECRET_ENVELOPE_E2E_CREDENTIAL_ID_PREFIX}-${index}-${layerKind}`;
}

function buildLocalSecretEnvelopeDebugCredentialId({
  index,
  layerKind,
  runId,
}: {
  index: number;
  layerKind: ILocalSecretEnvelopeLayerKind;
  runId: string;
}) {
  return `${LOCAL_SECRET_ENVELOPE_E2E_CREDENTIAL_ID_PREFIX}-debug-${runId}-${index}-${layerKind}`;
}

function buildLocalSecretEnvelopeRestoreCredentialId({
  runId,
}: {
  runId: string;
}) {
  return `${LOCAL_SECRET_ENVELOPE_E2E_RESTORE_CREDENTIAL_ID_PREFIX}-${runId}`;
}

@backgroundClass()
class ServiceE2E extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethodForDev()
  async clearWalletsAndAccounts(params: IBackgroundMethodWithDevOnlyPassword) {
    checkDevOnlyPassword(params);
    await localDb.clearRecords({
      name: ELocalDBStoreNames.Account,
    });
    await localDb.clearRecords({
      name: ELocalDBStoreNames.Wallet,
    });
    await localDb.clearRecords({
      name: ELocalDBStoreNames.Credential,
    });
    await localDb.clearRecords({
      name: ELocalDBStoreNames.Address,
    });
    await localDb.clearRecords({
      name: ELocalDBStoreNames.IndexedAccount,
    });
    await localDb.clearRecords({
      name: ELocalDBStoreNames.Device,
    });
    await localDb.clearRecords({
      name: ELocalDBStoreNames.Address,
    });
    await localDb.resetContext();

    await this.backgroundApi.simpleDb.accountSelector.clearRawData();

    // Wipe every SWR namespace (walletList, accountSelectorList,
    // allNetCompat, netContent, unsMeta, recentNets, defiEnabled, etc.).
    // This dev wipe means to reset all wallet state, so the broad clear
    // is intentional — keeping non-account namespaces around would leave
    // them referencing IDs that no longer exist in localDb.
    // ServiceApp.resetApp clears the entire coldStartCacheStorage (jotai
    // snapshot included); this path is narrower (SWR only). flushNow
    // persists the empty snapshot immediately — clearAll alone debounces
    // the MMKV write 2s, which could lose the wipe on a fast kill.
    swrCacheUtils.clearAll();
    swrCacheUtils.flushNow();

    appEventBus.emit(EAppEventBusNames.WalletClear, undefined);
  }

  @backgroundMethodForDev()
  async clearAddressBook(params: IBackgroundMethodWithDevOnlyPassword) {
    checkDevOnlyPassword(params);
    const { simpleDb } = this.backgroundApi;
    await simpleDb.addressBook.clearRawData();
    await addressBookPersistAtom.set((prev) => ({
      ...prev,
      updateTimestamp: undefined,
    }));
  }

  @backgroundMethodForDev()
  async clearPassword(
    params: IBackgroundMethodWithDevOnlyPassword,
  ): Promise<void> {
    checkDevOnlyPassword(params);
    await passwordPersistAtom.set((v) => ({ ...v, isPasswordSet: false }));
    await localDb.resetPasswordSet();
  }

  @backgroundMethodForDev()
  async clearDiscoveryPageData(params: IBackgroundMethodWithDevOnlyPassword) {
    checkDevOnlyPassword(params);
    const { serviceDiscovery } = this.backgroundApi;
    await serviceDiscovery.clearDiscoveryPageData();
  }

  @backgroundMethodForDev()
  async clearSettings(params: IBackgroundMethodWithDevOnlyPassword) {
    checkDevOnlyPassword(params);
    await settingsPersistAtom.set(settingsAtomInitialValue);
    await passwordPersistAtom.set(passwordAtomInitialValue);
  }

  @backgroundMethodForDev()
  async clearHistoryData(params: IBackgroundMethodWithDevOnlyPassword) {
    checkDevOnlyPassword(params);
    await this.backgroundApi.simpleDb.localHistory.clearRawData();
    await localDb.clearRecords({
      name: ELocalDBStoreNames.SignedMessage,
    });
    await localDb.clearRecords({
      name: ELocalDBStoreNames.SignedTransaction,
    });
    await localDb.clearRecords({
      name: ELocalDBStoreNames.ConnectedSite,
    });
  }

  async resetLocalSecretEnvelopeE2ESelfTestState(
    params: IBackgroundMethodWithDevOnlyPassword,
  ) {
    await this.clearWalletsAndAccounts(params);
    await this.clearPassword(params);
  }

  async addAndVerifyLocalSecretEnvelopeE2ECredential({
    credentialId,
    expectedLayerKinds,
    expectedStrength,
    password,
    seedMarker,
  }: {
    credentialId: string;
    expectedLayerKinds: ILocalSecretEnvelopeLayerKind[];
    expectedStrength: ILocalSecretEnvelopeStrength;
    password: string;
    seedMarker: string;
  }): Promise<ILocalSecretEnvelopeV1> {
    const revealableSeed = {
      entropyWithLangPrefixed: `english:00010203${seedMarker}`,
      seed: `seed-hex-${seedMarker}`,
    };
    const credential = await encryptRevealableSeed({
      password,
      rs: revealableSeed,
    });
    const wrappedCredential =
      await localDb.wrapNewCredentialWithLocalSecretEnvelopeIfNeeded({
        credential,
        credentialId,
      });
    assertLocalSecretEnvelopeE2E(
      isLocalSecretEnvelopeString(wrappedCredential),
      'E2E credential was not wrapped by local secret envelope',
    );

    await localDb.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
      await localDb.txAddRecords({
        tx,
        name: ELocalDBStoreNames.Credential,
        records: [
          {
            credential: wrappedCredential,
            id: credentialId,
          } satisfies IDBCredentialBase,
        ],
      });
    });

    const rawCredential = await localDb.getCredentialRaw(credentialId);
    const envelope = parseLocalSecretEnvelopeV1(rawCredential.credential);
    assertLocalSecretEnvelopeLayerKinds({
      actualLayerKinds: getLocalSecretEnvelopeLayerKinds(envelope),
      expectedLayerKinds,
      label: 'credential',
    });
    assertLocalSecretEnvelopeE2E(
      envelope.strength === expectedStrength,
      `Local secret envelope credential strength mismatch: expected ${expectedStrength}, got ${envelope.strength}`,
    );

    const innerCredential = await localDb.getCredentialInner({ credentialId });
    const decrypted = await decryptRevealableSeedWithMetadata({
      password,
      rs: innerCredential.credential,
    });
    assertLocalSecretEnvelopeE2E(
      decrypted.plaintext.seed === revealableSeed.seed &&
        decrypted.plaintext.entropyWithLangPrefixed ===
          revealableSeed.entropyWithLangPrefixed &&
        !decrypted.needsUpgrade,
      'E2E credential cannot be read back from local secret envelope',
    );

    return envelope;
  }

  async addAndVerifyLocalSecretEnvelopeDebugCredential({
    credentialId,
    expectedLayerKinds,
    expectedStrength,
    layerAdapters,
    password,
    seedMarker,
  }: {
    credentialId: string;
    expectedLayerKinds: ILocalSecretEnvelopeLayerKind[];
    expectedStrength: ILocalSecretEnvelopeStrength;
    layerAdapters: ILocalSecretEnvelopeLayerAdapter[];
    password: string;
    seedMarker: string;
  }): Promise<ILocalSecretEnvelopeV1> {
    const revealableSeed = {
      entropyWithLangPrefixed: `english:00010203${seedMarker}`,
      seed: `seed-hex-${seedMarker}`,
    };
    const credential = await encryptRevealableSeed({
      password,
      rs: revealableSeed,
    });
    const wrappedCredential = await wrapLocalSecretEnvelopeV1({
      dataType: 'credential',
      layerAdapters,
      plaintext: credential,
      recordId: credentialId,
      strength: expectedStrength,
    });

    await localDb.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
      await localDb.txAddRecords({
        tx,
        name: ELocalDBStoreNames.Credential,
        records: [
          {
            credential: wrappedCredential,
            id: credentialId,
          } satisfies IDBCredentialBase,
        ],
      });
    });

    const rawCredential = await localDb.getCredentialRaw(credentialId);
    const envelope = parseLocalSecretEnvelopeV1(rawCredential.credential);
    assertLocalSecretEnvelopeLayerKinds({
      actualLayerKinds: getLocalSecretEnvelopeLayerKinds(envelope),
      expectedLayerKinds,
      label: 'debug credential',
    });
    assertLocalSecretEnvelopeE2E(
      envelope.strength === expectedStrength,
      `Local secret envelope debug credential strength mismatch: expected ${expectedStrength}, got ${envelope.strength}`,
    );

    const resolveLayerAdapter =
      buildLocalSecretEnvelopeLayerAdapterResolver(layerAdapters);
    if (!resolveLayerAdapter) {
      throw new OneKeyLocalError(
        'Local secret envelope debug layer adapter resolver is unavailable',
      );
    }
    const innerCredential = await localDb.getCredentialInner({
      credentialId,
      resolveLayerAdapter,
    });
    const decrypted = await decryptRevealableSeedWithMetadata({
      password,
      rs: innerCredential.credential,
    });
    assertLocalSecretEnvelopeE2E(
      decrypted.plaintext.seed === revealableSeed.seed &&
        decrypted.plaintext.entropyWithLangPrefixed ===
          revealableSeed.entropyWithLangPrefixed &&
        !decrypted.needsUpgrade,
      'E2E debug credential cannot be read back from local secret envelope',
    );

    return envelope;
  }

  async checkLocalSecretEnvelopeCredentialReadBlocked({
    credentialId,
  }: {
    credentialId: string;
  }): Promise<boolean> {
    try {
      await localDb.getCredentialInner({ credentialId });
      return false;
    } catch {
      return true;
    }
  }

  @backgroundMethodForDev()
  async runLocalSecretEnvelopeRestoreSelfTest(
    params: IBackgroundMethodWithDevOnlyPassword,
    options: ILocalSecretEnvelopeE2ESelfTestOptions = {},
  ): Promise<ILocalSecretEnvelopeRestoreSelfTestResult> {
    checkDevOnlyPassword(params);
    let credentialEnvelope: ILocalSecretEnvelopeV1 | undefined;
    const runId = `${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const credentialId = buildLocalSecretEnvelopeRestoreCredentialId({
      runId,
    });

    try {
      const config =
        await localDb.buildLocalSecretEnvelopeCredentialMigrationConfig();
      if (!config) {
        throw new OneKeyLocalError(
          'Local secret envelope restore config is unavailable',
        );
      }

      const runtimePlatform = config.runtimePlatform ?? 'unknown';
      const configuredLayerKinds = config.layerAdapters.map(
        (adapter) => adapter.kind,
      );
      const expectedLayerKinds =
        options.expectedCredentialLayerKinds ?? configuredLayerKinds;
      const expectedStrength = options.expectedStrength ?? config.strength;

      if (options.expectedRuntimePlatform) {
        assertLocalSecretEnvelopeE2E(
          runtimePlatform === options.expectedRuntimePlatform,
          `Local secret envelope restore runtime platform mismatch: expected ${options.expectedRuntimePlatform}, got ${runtimePlatform}`,
        );
      }
      assertLocalSecretEnvelopeE2E(
        expectedLayerKinds.length > 0,
        'Local secret envelope restore self-test requires at least one expected layer',
      );
      assertLocalSecretEnvelopeLayerKinds({
        actualLayerKinds: configuredLayerKinds,
        expectedLayerKinds,
        label: 'restore config',
      });
      assertLocalSecretEnvelopeE2E(
        config.strength === expectedStrength,
        `Local secret envelope restore config strength mismatch: expected ${expectedStrength}, got ${config.strength}`,
      );

      const resolveLayerAdapter = buildLocalSecretEnvelopeLayerAdapterResolver(
        config.layerAdapters,
      );
      if (!resolveLayerAdapter) {
        throw new OneKeyLocalError(
          'Local secret envelope restore layer adapter resolver is unavailable',
        );
      }

      const password = await encodePasswordAsync({
        password: LOCAL_SECRET_ENVELOPE_E2E_PASSWORD,
      });
      const importedCredential = {
        privateKey: 'private-key-hex',
      };
      const portableCredential = await encryptImportedCredential({
        password,
        credential: importedCredential,
      });
      const wrappedCredential = await wrapLocalSecretEnvelopeV1({
        dataType: 'credential',
        layerAdapters: config.layerAdapters,
        plaintext: portableCredential,
        recordId: credentialId,
        strength: expectedStrength,
      });

      await localDb.withTransaction(
        EIndexedDBBucketNames.account,
        async (tx) => {
          await localDb.txAddRecords({
            tx,
            name: ELocalDBStoreNames.Credential,
            records: [
              {
                credential: wrappedCredential,
                id: credentialId,
              } satisfies IDBCredentialBase,
            ],
          });
        },
      );

      const rawCredential = await localDb.getCredentialRaw(credentialId);
      assertLocalSecretEnvelopeE2E(
        isLocalSecretEnvelopeString(rawCredential.credential),
        'Local secret envelope restore credential was not stored as raw LSE',
      );
      credentialEnvelope = parseLocalSecretEnvelopeV1(rawCredential.credential);
      assertLocalSecretEnvelopeLayerKinds({
        actualLayerKinds: getLocalSecretEnvelopeLayerKinds(credentialEnvelope),
        expectedLayerKinds,
        label: 'restore credential',
      });
      assertLocalSecretEnvelopeE2E(
        credentialEnvelope.strength === expectedStrength,
        `Local secret envelope restore credential strength mismatch: expected ${expectedStrength}, got ${credentialEnvelope.strength}`,
      );

      const innerCredential = await localDb.getCredentialInner({
        credentialId,
        resolveLayerAdapter,
      });
      assertLocalSecretEnvelopeE2E(
        innerCredential.credential.startsWith('|PK|'),
        'Local secret envelope restore inner credential is not portable |PK|',
      );
      const decryptedCredential = await decryptImportedCredentialWithMetadata({
        password,
        credential: innerCredential.credential,
      });
      assertLocalSecretEnvelopeE2E(
        decryptedCredential.plaintext.privateKey ===
          importedCredential.privateKey && !decryptedCredential.needsUpgrade,
        'Local secret envelope restore inner credential cannot be decrypted',
      );

      const backupCredentials = await buildLegacyCredentialsForCloudBackup({
        credentials: {
          [credentialId]: innerCredential.credential,
        },
        password,
      });
      const backupCredential = backupCredentials[credentialId];
      assertLocalSecretEnvelopeE2E(
        typeof backupCredential === 'string' &&
          backupCredential.startsWith('|PK|') &&
          backupCredential !== rawCredential.credential,
        'Cloud Backup restore self-test did not produce portable |PK| credential',
      );

      let backupRejectsRawLocalSecretEnvelope = false;
      try {
        await buildLegacyCredentialsForCloudBackup({
          credentials: {
            [credentialId]: rawCredential.credential,
          },
          password,
        });
      } catch {
        backupRejectsRawLocalSecretEnvelope = true;
      }
      assertLocalSecretEnvelopeE2E(
        backupRejectsRawLocalSecretEnvelope,
        'Cloud Backup did not reject raw local secret envelope credential',
      );

      const primeTransferCredential = normalizePrimeTransferCredential({
        credential: innerCredential.credential,
      });
      assertLocalSecretEnvelopeE2E(
        typeof primeTransferCredential === 'string' &&
          primeTransferCredential.startsWith('|PK|'),
        'Prime Transfer restore self-test did not accept portable |PK| credential',
      );

      let primeTransferRejectsRawLocalSecretEnvelope = false;
      try {
        normalizePrimeTransferCredential(rawCredential.credential);
      } catch {
        primeTransferRejectsRawLocalSecretEnvelope = true;
      }
      assertLocalSecretEnvelopeE2E(
        primeTransferRejectsRawLocalSecretEnvelope,
        'Prime Transfer did not reject raw local secret envelope credential',
      );

      return {
        backupPortableCredentialPrefix: backupCredential.slice(0, 4),
        backupRejectsRawLocalSecretEnvelope,
        credentialLayerKinds:
          getLocalSecretEnvelopeLayerKinds(credentialEnvelope),
        credentialStrength: credentialEnvelope.strength,
        innerCredentialPrefix: innerCredential.credential.slice(0, 4),
        primeTransferPortableCredentialPrefix: primeTransferCredential.slice(
          0,
          4,
        ),
        primeTransferRejectsRawLocalSecretEnvelope,
        rawCredentialIsLse: true,
        runtimePlatform,
      };
    } finally {
      await removeLocalSecretEnvelopeLayerKeys(credentialEnvelope);
      try {
        await localDb.withTransaction(
          EIndexedDBBucketNames.account,
          async (tx) => {
            await localDb.txRemoveRecords({
              tx,
              name: ELocalDBStoreNames.Credential,
              ids: [credentialId],
            });
          },
        );
      } catch {
        // Best-effort cleanup for E2E-only local records.
      }
    }
  }

  @backgroundMethodForDev()
  async runLocalSecretEnvelopeDebugSelfTest(
    params: IBackgroundMethodWithDevOnlyPassword,
    options: ILocalSecretEnvelopeE2ESelfTestOptions = {},
  ): Promise<ILocalSecretEnvelopeE2ESelfTestResult> {
    checkDevOnlyPassword(params);
    let verifyStringEnvelope: ILocalSecretEnvelopeV1 | undefined;
    const credentialEnvelopes: ILocalSecretEnvelopeV1[] = [];
    const credentialIdsToCleanup: string[] = [];
    const runId = `${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    try {
      const config =
        await localDb.buildLocalSecretEnvelopeCredentialMigrationConfig();
      if (!config) {
        throw new OneKeyLocalError(
          'Local secret envelope config is unavailable',
        );
      }
      const runtimePlatform = config.runtimePlatform ?? 'unknown';
      const configuredLayerKinds = config.layerAdapters.map(
        (adapter) => adapter.kind,
      );
      const expectedLayerKinds =
        options.expectedCredentialLayerKinds ?? configuredLayerKinds;
      const expectedStrength = options.expectedStrength ?? config.strength;

      if (options.expectedRuntimePlatform) {
        assertLocalSecretEnvelopeE2E(
          runtimePlatform === options.expectedRuntimePlatform,
          `Local secret envelope runtime platform mismatch: expected ${options.expectedRuntimePlatform}, got ${runtimePlatform}`,
        );
      }
      assertLocalSecretEnvelopeE2E(
        expectedLayerKinds.length > 0,
        'Local secret envelope debug self-test requires at least one expected layer',
      );
      assertLocalSecretEnvelopeLayerKinds({
        actualLayerKinds: configuredLayerKinds,
        expectedLayerKinds,
        label: 'debug config',
      });
      assertLocalSecretEnvelopeE2E(
        config.strength === expectedStrength,
        `Local secret envelope debug config strength mismatch: expected ${expectedStrength}, got ${config.strength}`,
      );

      const resolveLayerAdapter = buildLocalSecretEnvelopeLayerAdapterResolver(
        config.layerAdapters,
      );
      if (!resolveLayerAdapter) {
        throw new OneKeyLocalError(
          'Local secret envelope debug layer adapter resolver is unavailable',
        );
      }

      const password = await encodePasswordAsync({
        password: LOCAL_SECRET_ENVELOPE_E2E_PASSWORD,
      });
      const verifyStringInner = await encryptVerifyString({ password });
      const wrappedVerifyString = await wrapLocalSecretEnvelopeV1({
        dataType: 'verify-string',
        layerAdapters: config.layerAdapters,
        plaintext: verifyStringInner,
        recordId: DB_MAIN_CONTEXT_ID,
        strength: expectedStrength,
      });
      verifyStringEnvelope = parseLocalSecretEnvelopeV1(wrappedVerifyString);
      assertLocalSecretEnvelopeLayerKinds({
        actualLayerKinds:
          getLocalSecretEnvelopeLayerKinds(verifyStringEnvelope),
        expectedLayerKinds,
        label: 'debug verifyString',
      });
      assertLocalSecretEnvelopeE2E(
        verifyStringEnvelope.strength === expectedStrength,
        `Local secret envelope debug verifyString strength mismatch: expected ${expectedStrength}, got ${verifyStringEnvelope.strength}`,
      );

      const context = await localDb.getContext();
      const innerVerifyString = await localDb.getContextVerifyStringInner({
        context: {
          ...context,
          verifyString: wrappedVerifyString,
        },
        resolveLayerAdapter,
      });
      const decryptedVerifyString = await decryptVerifyStringWithMetadata({
        password,
        verifyString: innerVerifyString,
      });
      assertLocalSecretEnvelopeE2E(
        decryptedVerifyString.plaintext === DEFAULT_VERIFY_STRING &&
          !decryptedVerifyString.needsUpgrade,
        'E2E debug verifyString cannot be read back from local secret envelope',
      );

      const layerDeletionBlocksUnwrap: Partial<
        Record<ILocalSecretEnvelopeLayerKind, boolean>
      > = {};
      for (let index = 0; index < expectedLayerKinds.length; index += 1) {
        const layerKind = expectedLayerKinds[index];
        const credentialId = buildLocalSecretEnvelopeDebugCredentialId({
          index,
          layerKind,
          runId,
        });
        credentialIdsToCleanup.push(credentialId);
        const credentialEnvelope =
          await this.addAndVerifyLocalSecretEnvelopeDebugCredential({
            credentialId,
            expectedLayerKinds,
            expectedStrength,
            layerAdapters: config.layerAdapters,
            password,
            seedMarker: String(index + 1).padStart(2, '0'),
          });
        credentialEnvelopes.push(credentialEnvelope);

        const layer = credentialEnvelope.wrappingLayers.find(
          (item) => item.kind === layerKind,
        );
        if (!layer) {
          throw new OneKeyLocalError(
            `E2E debug credential layer is missing: ${layerKind}`,
          );
        }
        const deletionBlocksUnwrap =
          layerKind === 'secure-storage'
            ? await checkSecureStorageDeletionBlocksUnwrapInIsolatedLayer({
                index,
                runId,
              })
            : await (async () => {
                await removeLocalSecretEnvelopeLayerKey(layer);
                return this.checkLocalSecretEnvelopeCredentialReadBlocked({
                  credentialId,
                });
              })();
        layerDeletionBlocksUnwrap[layerKind] = deletionBlocksUnwrap;
        assertLocalSecretEnvelopeE2E(
          deletionBlocksUnwrap,
          `E2E debug credential is still readable after deleting ${layerKind} layer`,
        );
      }

      const lastCredentialEnvelope =
        credentialEnvelopes[credentialEnvelopes.length - 1];
      if (!lastCredentialEnvelope) {
        throw new OneKeyLocalError(
          'Local secret envelope debug credential was not created',
        );
      }

      return {
        credentialLayerKinds: getLocalSecretEnvelopeLayerKinds(
          lastCredentialEnvelope,
        ),
        credentialStrength: lastCredentialEnvelope.strength,
        cryptoKeyDeletionBlocksUnwrap:
          layerDeletionBlocksUnwrap['indexeddb-cryptokey'] === true,
        layerDeletionBlocksUnwrap,
        runtimePlatform,
        secureStorageDeletionBlocksUnwrap:
          layerDeletionBlocksUnwrap['secure-storage'] === true,
        verifyStringIsLse: true,
        verifyStringLayerKinds:
          getLocalSecretEnvelopeLayerKinds(verifyStringEnvelope),
        verifyStringStrength: verifyStringEnvelope.strength,
      };
    } finally {
      await removeLocalSecretEnvelopeLayerKeys(verifyStringEnvelope);
      for (const envelope of credentialEnvelopes) {
        await removeLocalSecretEnvelopeLayerKeys(envelope);
      }
      if (credentialIdsToCleanup.length) {
        try {
          await localDb.withTransaction(
            EIndexedDBBucketNames.account,
            async (tx) => {
              await localDb.txRemoveRecords({
                tx,
                name: ELocalDBStoreNames.Credential,
                ids: credentialIdsToCleanup,
              });
            },
          );
        } catch {
          // Best-effort cleanup for E2E-only local records.
        }
      }
    }
  }

  @backgroundMethodForDev()
  async runLocalSecretEnvelopeSelfTest(
    params: IBackgroundMethodWithDevOnlyPassword,
    options: ILocalSecretEnvelopeE2ESelfTestOptions = {},
  ): Promise<ILocalSecretEnvelopeE2ESelfTestResult> {
    checkDevOnlyPassword(params);
    let verifyStringEnvelope: ILocalSecretEnvelopeV1 | undefined;
    const credentialEnvelopes: ILocalSecretEnvelopeV1[] = [];
    const runId = `${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    try {
      await this.resetLocalSecretEnvelopeE2ESelfTestState(params);

      const config =
        await localDb.buildLocalSecretEnvelopeCredentialMigrationConfig();
      if (!config) {
        throw new OneKeyLocalError(
          'Local secret envelope config is unavailable',
        );
      }
      const runtimePlatform = config.runtimePlatform ?? 'unknown';
      const configuredLayerKinds = config.layerAdapters.map(
        (adapter) => adapter.kind,
      );
      const expectedLayerKinds =
        options.expectedCredentialLayerKinds ?? configuredLayerKinds;
      const expectedStrength = options.expectedStrength ?? config.strength;

      if (options.expectedRuntimePlatform) {
        assertLocalSecretEnvelopeE2E(
          runtimePlatform === options.expectedRuntimePlatform,
          `Local secret envelope runtime platform mismatch: expected ${options.expectedRuntimePlatform}, got ${runtimePlatform}`,
        );
      }
      assertLocalSecretEnvelopeE2E(
        expectedLayerKinds.length > 0,
        'Local secret envelope E2E requires at least one expected layer',
      );
      assertLocalSecretEnvelopeLayerKinds({
        actualLayerKinds: configuredLayerKinds,
        expectedLayerKinds,
        label: 'config',
      });
      assertLocalSecretEnvelopeE2E(
        config.strength === expectedStrength,
        `Local secret envelope config strength mismatch: expected ${expectedStrength}, got ${config.strength}`,
      );
      const adapterKinds = new Set(configuredLayerKinds);
      assertLocalSecretEnvelopeE2E(
        expectedLayerKinds.every((layerKind) => adapterKinds.has(layerKind)),
        'Local secret envelope config is missing expected layer adapters',
      );

      const password = await encodePasswordAsync({
        password: LOCAL_SECRET_ENVELOPE_E2E_PASSWORD,
      });
      await localDb.setPassword({ password });

      const context = await localDb.getContext();
      assertLocalSecretEnvelopeE2E(
        isLocalSecretEnvelopeString(context.verifyString),
        'E2E verifyString was not wrapped by local secret envelope',
      );
      verifyStringEnvelope = parseLocalSecretEnvelopeV1(context.verifyString);
      assertLocalSecretEnvelopeE2E(
        verifyStringEnvelope.recordId === DB_MAIN_CONTEXT_ID &&
          verifyStringEnvelope.dataType === 'verify-string',
        'E2E verifyString local secret envelope metadata mismatch',
      );
      assertLocalSecretEnvelopeLayerKinds({
        actualLayerKinds:
          getLocalSecretEnvelopeLayerKinds(verifyStringEnvelope),
        expectedLayerKinds,
        label: 'verifyString',
      });
      assertLocalSecretEnvelopeE2E(
        verifyStringEnvelope.strength === expectedStrength,
        `Local secret envelope verifyString strength mismatch: expected ${expectedStrength}, got ${verifyStringEnvelope.strength}`,
      );
      const innerVerifyString = await localDb.getContextVerifyStringInner({
        context,
      });
      const decryptedVerifyString = await decryptVerifyStringWithMetadata({
        password,
        verifyString: innerVerifyString,
      });
      assertLocalSecretEnvelopeE2E(
        decryptedVerifyString.plaintext === DEFAULT_VERIFY_STRING &&
          !decryptedVerifyString.needsUpgrade,
        'E2E verifyString cannot be read back from local secret envelope',
      );

      const layerDeletionBlocksUnwrap: Partial<
        Record<ILocalSecretEnvelopeLayerKind, boolean>
      > = {};
      for (let index = 0; index < expectedLayerKinds.length; index += 1) {
        const layerKind = expectedLayerKinds[index];
        const credentialId = buildLocalSecretEnvelopeE2ECredentialId({
          index,
          layerKind,
        });
        const credentialEnvelope =
          await this.addAndVerifyLocalSecretEnvelopeE2ECredential({
            credentialId,
            expectedLayerKinds,
            expectedStrength,
            password,
            seedMarker: String(index + 1).padStart(2, '0'),
          });
        credentialEnvelopes.push(credentialEnvelope);

        const layer = credentialEnvelope.wrappingLayers.find(
          (item) => item.kind === layerKind,
        );
        if (!layer) {
          throw new OneKeyLocalError(
            `E2E credential layer is missing: ${layerKind}`,
          );
        }
        const deletionBlocksUnwrap =
          layerKind === 'secure-storage'
            ? await checkSecureStorageDeletionBlocksUnwrapInIsolatedLayer({
                index,
                runId,
              })
            : await (async () => {
                await removeLocalSecretEnvelopeLayerKey(layer);
                return this.checkLocalSecretEnvelopeCredentialReadBlocked({
                  credentialId,
                });
              })();
        layerDeletionBlocksUnwrap[layerKind] = deletionBlocksUnwrap;
        assertLocalSecretEnvelopeE2E(
          deletionBlocksUnwrap,
          `E2E credential is still readable after deleting ${layerKind} layer`,
        );
      }

      const lastCredentialEnvelope =
        credentialEnvelopes[credentialEnvelopes.length - 1];
      if (!lastCredentialEnvelope) {
        throw new OneKeyLocalError(
          'Local secret envelope E2E credential was not created',
        );
      }

      return {
        credentialLayerKinds: getLocalSecretEnvelopeLayerKinds(
          lastCredentialEnvelope,
        ),
        credentialStrength: lastCredentialEnvelope.strength,
        cryptoKeyDeletionBlocksUnwrap:
          layerDeletionBlocksUnwrap['indexeddb-cryptokey'] === true,
        layerDeletionBlocksUnwrap,
        runtimePlatform,
        secureStorageDeletionBlocksUnwrap:
          layerDeletionBlocksUnwrap['secure-storage'] === true,
        verifyStringIsLse: true,
        verifyStringLayerKinds:
          getLocalSecretEnvelopeLayerKinds(verifyStringEnvelope),
        verifyStringStrength: verifyStringEnvelope.strength,
      };
    } finally {
      await removeLocalSecretEnvelopeLayerKeys(verifyStringEnvelope);
      for (const envelope of credentialEnvelopes) {
        await removeLocalSecretEnvelopeLayerKeys(envelope);
      }
      await this.resetLocalSecretEnvelopeE2ESelfTestState(params);
    }
  }

  @backgroundMethodForDev()
  async exportAllAccountsData(
    params: IBackgroundMethodWithDevOnlyPassword,
    { normalize }: { normalize?: boolean } = {},
  ) {
    checkDevOnlyPassword(params);
    const { serviceAccount, serviceV4Migration, serviceNetwork } =
      this.backgroundApi;
    let { accounts } = await serviceAccount.getAllAccounts();
    const { wallets } = await serviceAccount.getAllWallets();
    const { devices } = await serviceAccount.getAllDevices();
    const sortFn = (a: IDBBaseObject, b: IDBBaseObject) =>
      natsort({ insensitive: true })(a.id, b.id);
    const v4dbExists = await serviceV4Migration.checkIfV4DbExist();

    if (normalize) {
      accounts = accounts.map((account) => {
        account.name = account.name || 'mockName';
        // account.no
        return account;
      });
    }

    wallets.forEach((wallet) => {
      wallet.accounts = (wallet.accounts || []).toSorted((a, b) =>
        natsort({ insensitive: true })(a, b),
      );
    });

    const { networks } = await serviceNetwork.getAllNetworks();

    const getMissingImpls = async (accounts0: IDBAccount[]) => {
      const missingImpls: string[] = [];

      for (const network of networks) {
        const impl = network.impl;
        const deriveItems =
          await this.backgroundApi.serviceNetwork.getDeriveInfoItemsOfNetwork({
            networkId: network.id,
          });
        for (const deriveItem of deriveItems) {
          const matchedAccount = accounts0.find(
            (account) =>
              account.impl === impl &&
              (!account.template ||
                (account.template &&
                  account.template === deriveItem.item.template)),
          );
          if (!matchedAccount) {
            missingImpls.push(`${impl} - ${deriveItem.value}`);
          }
        }
      }

      return uniq(missingImpls);
    };

    const accountsGroupedByWallet: {
      [walletId: string]: IDBAccount[];
    } = {};

    accounts.forEach((account) => {
      const walletId = accountUtils.getWalletIdFromAccountId({
        accountId: account.id,
      });
      if (!accountsGroupedByWallet[walletId]) {
        accountsGroupedByWallet[walletId] = [];
      }
      accountsGroupedByWallet[walletId].push(account);
    });

    const accountMissingImpls: {
      [walletId: string]: string[];
    } = {};

    for (const walletId of Object.keys(accountsGroupedByWallet)) {
      const accounts0: IDBAccount[] = accountsGroupedByWallet[walletId];
      accountMissingImpls[walletId] = await getMissingImpls(accounts0);
    }

    return {
      v4dbExists,
      accountMissingImpls,
      accounts: (accounts || []).toSorted(sortFn),
      wallets: (wallets || []).toSorted(sortFn),
      devices: (devices || []).toSorted(sortFn).map((device: IDBDevice) => {
        delete (device as { features?: string })?.features;
        return device;
      }),
    };
  }
}

export default ServiceE2E;
