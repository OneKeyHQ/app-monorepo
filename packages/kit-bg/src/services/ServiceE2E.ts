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
  getSecretEncryptV2LocalTargetIterations,
  readSecretEncryptPayloadMetadata,
} from '@onekeyhq/core/src/secret';
import { PBKDF2_LEGACY_NUM_OF_ITERATIONS } from '@onekeyhq/shared/src/appCrypto/consts';
import {
  aesGcmDecrypt,
  aesGcmEncrypt,
} from '@onekeyhq/shared/src/appCrypto/modules/aesGcm';
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
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import { swrCacheUtils } from '@onekeyhq/shared/src/utils/swrCacheUtils';

import localDb from '../dbs/local/localDb';
import { ELocalDBStoreNames } from '../dbs/local/localDBStoreNames';
import {
  buildLocalSecretEnvelopeLayerAdapterResolver,
  buildSecureStorageLocalSecretEnvelopeLayerAdapter,
  classifyLocalSecretEnvelopeMigrationCandidate,
  deleteIndexedDbCryptoKeyForLocalSecretEnvelope,
  detectLocalSecretEnvelopeRuntimePlatform,
  isIndexedDbCryptoKeyLocalSecretEnvelopeLayerAvailable,
  isLocalSecretEnvelopeString,
  isSecureStorageLocalSecretEnvelopeLayerAvailable,
  parseLocalSecretEnvelopeV1,
  resetSecureStorageLocalSecretEnvelopeProbeCache,
  stripLocalSecretPrefix,
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
  ILocalSecretEnvelopeLayerAdapterResolver,
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

type ILocalSecretEnvelopeE2ESelfTestOptions = {
  expectedCredentialLayerKinds?: ILocalSecretEnvelopeLayerKind[];
  expectedRuntimePlatform?: ILocalSecretEnvelopeRuntimePlatform;
  expectedStrength?: ILocalSecretEnvelopeStrength;
};

export type ILocalSecretEnvelopeE2ECheckpointStatus =
  | 'passed'
  | 'failed'
  | 'skipped';

export type ILocalSecretEnvelopeE2ECheckpoint = {
  group: string;
  label: string;
  status: ILocalSecretEnvelopeE2ECheckpointStatus;
  detail?: string;
};

export type ILocalSecretEnvelopeE2ETestReport = {
  testName: string;
  runtimePlatform: string;
  passed: boolean;
  passedCount: number;
  failedCount: number;
  skippedCount: number;
  checkpoints: ILocalSecretEnvelopeE2ECheckpoint[];
  // Condensed raw result kept for "copy raw JSON" debugging.
  summary?: Record<string, unknown>;
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

function localSecretEnvelopeLayerKindsEqual(
  actualLayerKinds: ILocalSecretEnvelopeLayerKind[],
  expectedLayerKinds: ILocalSecretEnvelopeLayerKind[],
): boolean {
  return (
    actualLayerKinds.length === expectedLayerKinds.length &&
    actualLayerKinds.every((kind, index) => kind === expectedLayerKinds[index])
  );
}

function getLocalSecretEnvelopeE2EErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

type ILocalSecretEnvelopeDiagnosticCategory =
  | 'lse'
  | 'legacy-current'
  | 'legacy-needs-upgrade'
  | 'legacy-no-iterations'
  | 'default'
  | 'unknown';

// Mask a record id (walletId / accountId) before surfacing it in the dev UI.
// The id is the DB key, not the credential secret, but imported-account ids can
// embed an address — so long ids are truncated to avoid showing it in full.
function maskLocalSecretEnvelopeRecordId(id: string): string {
  if (!id) {
    return '(empty id)';
  }
  if (id.length <= 16) {
    return id;
  }
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

// Render a KDF iteration count with an explicit confidence tag, so the UI shows
// whether the number is a 100%-certain value read from a real header
// ("confirmed") or just a best-guess default we could not verify ("inferred").
function formatKdfIterations({
  confidence,
  iterations,
  kdf = 'PBKDF2-SHA256',
}: {
  confidence: 'confirmed' | 'inferred';
  iterations: number;
  kdf?: string;
}): string {
  return `${kdf} @ ${iterations} iterations [${
    confidence === 'confirmed'
      ? 'confirmed: exact value read from header'
      : 'inferred: default, not stored in header'
  }]`;
}

// Read the inner password-encrypted payload's KDF iteration count for an
// LSE-wrapped record by peeling ONLY the device-bound layer(s). Unwrapping
// returns the original inner value (e.g. `|RP|<v2-payload>`), which is STILL
// password-encrypted — the user password is a deeper layer we never touch. We
// parse only that inner value's plaintext V2 header for the iteration count and
// discard the inner value; it is never returned, logged, or surfaced.
async function readLocalSecretEnvelopeInnerKdf({
  dataType,
  envelopeString,
  resolveLayerAdapter,
}: {
  dataType: 'credential' | 'verify-string';
  envelopeString: string;
  resolveLayerAdapter?: ILocalSecretEnvelopeLayerAdapterResolver;
}): Promise<string> {
  const targetIterations = getSecretEncryptV2LocalTargetIterations();
  // No device-layer adapter available (e.g. keychain locked / wrong platform):
  // fall back to the migration-gate guarantee that the inner KDF is at target.
  if (!resolveLayerAdapter) {
    return formatKdfIterations({
      confidence: 'inferred',
      iterations: targetIterations,
    });
  }
  try {
    const innerValue = await unwrapLocalSecretEnvelopeV1({
      envelope: envelopeString,
      expectedDataType: dataType,
      resolveLayerAdapter,
    });
    const innerMeta = readSecretEncryptPayloadMetadata({
      data: stripLocalSecretPrefix(innerValue),
    });
    if (innerMeta.format === 'v2' && typeof innerMeta.iterations === 'number') {
      return formatKdfIterations({
        confidence: 'confirmed',
        iterations: innerMeta.iterations,
        kdf: innerMeta.kdf,
      });
    }
    if (innerMeta.format === 'legacy-gcm') {
      return `legacy AES-GCM inner (pre-V2) · ${formatKdfIterations({
        confidence: 'inferred',
        iterations: PBKDF2_LEGACY_NUM_OF_ITERATIONS,
      })}`;
    }
    return `legacy/unknown inner container · ${formatKdfIterations({
      confidence: 'inferred',
      iterations: PBKDF2_LEGACY_NUM_OF_ITERATIONS,
    })}`;
  } catch {
    // Device key unavailable / biometric declined / adapter missing: keep the
    // inferred target value rather than failing the whole scan.
    return formatKdfIterations({
      confidence: 'inferred',
      iterations: targetIterations,
    });
  }
}

// Classify a single stored secret record by its ENCRYPTION CONTAINER, reporting
// the encryption method and KDF iteration count. It NEVER exposes ciphertext or
// plaintext, and NEVER decrypts the secret: for LSE records it peels only the
// device-bound layer (not the password) to read the exact inner iterations.
async function describeLocalSecretEnvelopeRecordEncryption({
  dataType,
  rawValue,
  recordId,
  resolveLayerAdapter,
}: {
  dataType: 'credential' | 'verify-string';
  rawValue: string;
  recordId: string;
  resolveLayerAdapter?: ILocalSecretEnvelopeLayerAdapterResolver;
}): Promise<{
  category: ILocalSecretEnvelopeDiagnosticCategory;
  detail: string;
  status: ILocalSecretEnvelopeE2ECheckpointStatus;
}> {
  const targetIterations = getSecretEncryptV2LocalTargetIterations();

  // Empty / default verify-string placeholder: nothing is encrypted yet.
  if (dataType === 'verify-string' && rawValue === DEFAULT_VERIFY_STRING) {
    return {
      category: 'default',
      detail: 'default verify-string placeholder · no secret stored · KDF n/a',
      status: 'skipped',
    };
  }

  // LSE-wrapped: surface the envelope's safe metadata (version / strength /
  // layer kinds + algorithms) and the exact inner KDF iterations obtained by
  // peeling only the device layer (see readLocalSecretEnvelopeInnerKdf).
  if (isLocalSecretEnvelopeString(rawValue)) {
    let envelope: ILocalSecretEnvelopeV1;
    try {
      envelope = parseLocalSecretEnvelopeV1(rawValue);
    } catch (error) {
      return {
        category: 'unknown',
        detail: `LSE-prefixed but could not be parsed: ${getLocalSecretEnvelopeE2EErrorMessage(
          error,
        )}`,
        status: 'failed',
      };
    }
    const layers = envelope.wrappingLayers
      .map((layer) => `${layer.kind}/${layer.alg}`)
      .join(' + ');
    const innerKdf = await readLocalSecretEnvelopeInnerKdf({
      dataType,
      envelopeString: rawValue,
      resolveLayerAdapter,
    });
    return {
      category: 'lse',
      detail: `LSE v${envelope.version} · strength=${envelope.strength} · layers=[${layers}] · inner ${innerKdf}`,
      status: 'passed',
    };
  }

  // Legacy (not LSE-wrapped): explain whether it WILL be migrated on the next
  // unlock or is intentionally skipped — so a record that lingers as legacy
  // (e.g. a keyless wallet whose credential has no |RP|/|PK| inner prefix) shows
  // a concrete reason rather than looking like a stuck migration.
  const candidate = classifyLocalSecretEnvelopeMigrationCandidate({
    dataType,
    recordId,
    rawValue,
  });
  const migrationNote = candidate.canMigrate
    ? 'migratable=yes (will wrap on next unlock)'
    : `migratable=no (${candidate.reason})`;

  // Read the inner container's plaintext header only.
  const meta = readSecretEncryptPayloadMetadata({
    data: stripLocalSecretPrefix(rawValue),
  });

  if (meta.format === 'v2' && typeof meta.iterations === 'number') {
    const needsUpgrade = meta.iterations < targetIterations;
    return {
      category: needsUpgrade ? 'legacy-needs-upgrade' : 'legacy-current',
      detail: `legacy ${
        meta.cipher ?? 'AES-256-GCM'
      } (V2, not LSE-wrapped) · ${formatKdfIterations({
        confidence: 'confirmed',
        iterations: meta.iterations,
        kdf: meta.kdf,
      })} (target ${targetIterations})${
        needsUpgrade ? ' · NEEDS KDF UPGRADE' : ''
      } · ${migrationNote}`,
      status: needsUpgrade ? 'failed' : 'skipped',
    };
  }

  if (meta.format === 'legacy-gcm') {
    return {
      category: 'legacy-no-iterations',
      detail: `legacy AES-GCM (pre-V2) · ${formatKdfIterations({
        confidence: 'inferred',
        iterations: PBKDF2_LEGACY_NUM_OF_ITERATIONS,
      })} · NEEDS UPGRADE · ${migrationNote}`,
      status: 'failed',
    };
  }

  return {
    category: 'unknown',
    detail: `legacy CBC or unrecognized container (pre-V2) · ${formatKdfIterations(
      {
        confidence: 'inferred',
        iterations: PBKDF2_LEGACY_NUM_OF_ITERATIONS,
      },
    )} · NEEDS UPGRADE · ${migrationNote}`,
    status: 'failed',
  };
}

// Collects per-checkpoint pass/fail/skip results so the self-test can run to
// the end and report every checkpoint, instead of throwing on first failure.
function createLocalSecretEnvelopeE2EReporter() {
  const checkpoints: ILocalSecretEnvelopeE2ECheckpoint[] = [];

  const pass = (group: string, label: string, detail?: string) => {
    checkpoints.push({ group, label, status: 'passed', detail });
  };

  const fail = (group: string, label: string, detail?: string) => {
    checkpoints.push({ group, label, status: 'failed', detail });
  };

  const skip = (group: string, label: string, detail?: string) => {
    checkpoints.push({ group, label, status: 'skipped', detail });
  };

  // Records a boolean assertion as a checkpoint and returns the condition so
  // callers can branch (e.g. stop early when a hard precondition fails).
  const check = (
    group: string,
    label: string,
    condition: boolean,
    detail?: string,
  ): boolean => {
    if (condition) {
      pass(group, label, detail);
    } else {
      fail(group, label, detail);
    }
    return condition;
  };

  const toReport = ({
    testName,
    runtimePlatform,
    summary,
  }: {
    testName: string;
    runtimePlatform: string;
    summary?: Record<string, unknown>;
  }): ILocalSecretEnvelopeE2ETestReport => {
    const passedCount = checkpoints.filter(
      (item) => item.status === 'passed',
    ).length;
    const failedCount = checkpoints.filter(
      (item) => item.status === 'failed',
    ).length;
    const skippedCount = checkpoints.filter(
      (item) => item.status === 'skipped',
    ).length;
    return {
      checkpoints,
      failedCount,
      passed: failedCount === 0 && passedCount > 0,
      passedCount,
      runtimePlatform,
      skippedCount,
      summary,
      testName,
    };
  };

  return { check, fail, pass, skip, toReport };
}

type ILocalSecretEnvelopeE2EReporter = ReturnType<
  typeof createLocalSecretEnvelopeE2EReporter
>;

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
  // Keep within expo-secure-store's allowed key charset [A-Za-z0-9_.-]: a ":"
  // would make the native OS secure storage reject the key.
  const keyRef = `onekey_lse_e2e_secure_storage_${runId}_${index}`;
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

  async collectLocalSecretEnvelopeDebugCredentialCheckpoints({
    credentialId,
    expectedLayerKinds,
    expectedStrength,
    group,
    layerAdapters,
    password,
    reporter,
    seedMarker,
  }: {
    credentialId: string;
    expectedLayerKinds: ILocalSecretEnvelopeLayerKind[];
    expectedStrength: ILocalSecretEnvelopeStrength;
    group: string;
    layerAdapters: ILocalSecretEnvelopeLayerAdapter[];
    password: string;
    reporter: ILocalSecretEnvelopeE2EReporter;
    seedMarker: string;
  }): Promise<ILocalSecretEnvelopeV1 | undefined> {
    const revealableSeed = {
      entropyWithLangPrefixed: `english:00010203${seedMarker}`,
      seed: `seed-hex-${seedMarker}`,
    };
    try {
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
      const envelope = parseLocalSecretEnvelopeV1(rawCredential.credential);
      const actualLayerKinds = getLocalSecretEnvelopeLayerKinds(envelope);
      reporter.check(
        group,
        'Stored as LSE with expected layers',
        isLocalSecretEnvelopeString(rawCredential.credential) &&
          localSecretEnvelopeLayerKindsEqual(
            actualLayerKinds,
            expectedLayerKinds,
          ),
        `expected ${expectedLayerKinds.join(',')}, got ${actualLayerKinds.join(
          ',',
        )}`,
      );
      reporter.check(
        group,
        'Credential strength matches expected',
        envelope.strength === expectedStrength,
        `expected ${expectedStrength}, got ${envelope.strength}`,
      );

      const resolveLayerAdapter =
        buildLocalSecretEnvelopeLayerAdapterResolver(layerAdapters);
      if (!resolveLayerAdapter) {
        reporter.fail(
          group,
          'Inner seed decrypts back',
          'layer adapter resolver is unavailable',
        );
        return envelope;
      }
      const innerCredential = await localDb.getCredentialInner({
        credentialId,
        resolveLayerAdapter,
      });
      const decrypted = await decryptRevealableSeedWithMetadata({
        password,
        rs: innerCredential.credential,
      });
      reporter.check(
        group,
        'Inner seed decrypts back',
        decrypted.plaintext.seed === revealableSeed.seed &&
          decrypted.plaintext.entropyWithLangPrefixed ===
            revealableSeed.entropyWithLangPrefixed &&
          !decrypted.needsUpgrade,
      );

      return envelope;
    } catch (error) {
      reporter.fail(
        group,
        'Create & read credential',
        getLocalSecretEnvelopeE2EErrorMessage(error),
      );
      return undefined;
    }
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
  ): Promise<ILocalSecretEnvelopeE2ETestReport> {
    checkDevOnlyPassword(params);
    const reporter = createLocalSecretEnvelopeE2EReporter();
    const testName = 'LSE Restore Self-Test';
    let runtimePlatform = 'unknown';
    let credentialEnvelope: ILocalSecretEnvelopeV1 | undefined;
    let rawCredentialValue: string | undefined;
    let innerCredentialValue: string | undefined;
    let backupRejectsRawLocalSecretEnvelope = false;
    let primeTransferRejectsRawLocalSecretEnvelope = false;
    let backupPortableCredentialPrefix = '';
    let innerCredentialPrefix = '';
    let primeTransferPortableCredentialPrefix = '';
    const runId = `${Date.now().toString(36)}-${generateUUID({
      removeDashes: true,
    }).slice(0, 6)}`;
    const credentialId = buildLocalSecretEnvelopeRestoreCredentialId({
      runId,
    });

    try {
      const config =
        await localDb.buildLocalSecretEnvelopeCredentialMigrationConfig();
      if (!config) {
        reporter.fail(
          'Config',
          'LSE restore config is available',
          'config is unavailable',
        );
        return reporter.toReport({ runtimePlatform, testName });
      }
      reporter.pass('Config', 'LSE restore config is available');

      runtimePlatform = config.runtimePlatform ?? 'unknown';
      const configuredLayerKinds = config.layerAdapters.map(
        (adapter) => adapter.kind,
      );
      const expectedLayerKinds =
        options.expectedCredentialLayerKinds ?? configuredLayerKinds;
      const expectedStrength = options.expectedStrength ?? config.strength;

      if (options.expectedRuntimePlatform) {
        reporter.check(
          'Config',
          'Runtime platform matches expected',
          runtimePlatform === options.expectedRuntimePlatform,
          `expected ${options.expectedRuntimePlatform}, got ${runtimePlatform}`,
        );
      }
      if (
        !reporter.check(
          'Config',
          'At least one expected layer',
          expectedLayerKinds.length > 0,
          `expected layers: ${expectedLayerKinds.join(',') || '(none)'}`,
        )
      ) {
        return reporter.toReport({ runtimePlatform, testName });
      }
      reporter.check(
        'Config',
        'Configured layers match expected',
        localSecretEnvelopeLayerKindsEqual(
          configuredLayerKinds,
          expectedLayerKinds,
        ),
        `expected ${expectedLayerKinds.join(',')}, got ${configuredLayerKinds.join(
          ',',
        )}`,
      );
      reporter.check(
        'Config',
        'Config strength matches expected',
        config.strength === expectedStrength,
        `expected ${expectedStrength}, got ${config.strength}`,
      );

      const resolveLayerAdapter = buildLocalSecretEnvelopeLayerAdapterResolver(
        config.layerAdapters,
      );
      if (!resolveLayerAdapter) {
        reporter.fail(
          'Config',
          'Layer adapter resolver is available',
          'resolver is unavailable',
        );
        return reporter.toReport({ runtimePlatform, testName });
      }
      reporter.pass('Config', 'Layer adapter resolver is available');

      let password: string;
      try {
        password = await encodePasswordAsync({
          password: LOCAL_SECRET_ENVELOPE_E2E_PASSWORD,
        });
      } catch (error) {
        reporter.fail(
          'Setup',
          'Encode E2E password',
          getLocalSecretEnvelopeE2EErrorMessage(error),
        );
        return reporter.toReport({ runtimePlatform, testName });
      }

      const importedCredential = {
        privateKey: 'private-key-hex',
      };

      // Build credential chain: wrap -> store -> read raw -> unwrap inner.
      try {
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
        rawCredentialValue = rawCredential.credential;
        reporter.check(
          'Credential',
          'Stored as raw LSE',
          isLocalSecretEnvelopeString(rawCredentialValue),
        );
        credentialEnvelope = parseLocalSecretEnvelopeV1(rawCredentialValue);
        const actualLayerKinds =
          getLocalSecretEnvelopeLayerKinds(credentialEnvelope);
        reporter.check(
          'Credential',
          'Layers match expected',
          localSecretEnvelopeLayerKindsEqual(
            actualLayerKinds,
            expectedLayerKinds,
          ),
          `expected ${expectedLayerKinds.join(',')}, got ${actualLayerKinds.join(
            ',',
          )}`,
        );
        reporter.check(
          'Credential',
          'Strength matches expected',
          credentialEnvelope.strength === expectedStrength,
          `expected ${expectedStrength}, got ${credentialEnvelope.strength}`,
        );

        const innerCredential = await localDb.getCredentialInner({
          credentialId,
          resolveLayerAdapter,
        });
        innerCredentialValue = innerCredential.credential;
        innerCredentialPrefix = innerCredentialValue.slice(0, 4);
        reporter.check(
          'Credential',
          'Inner credential is portable |PK|',
          innerCredentialValue.startsWith('|PK|'),
        );
        const decryptedCredential = await decryptImportedCredentialWithMetadata(
          {
            password,
            credential: innerCredentialValue,
          },
        );
        reporter.check(
          'Credential',
          'Inner credential decrypts back',
          decryptedCredential.plaintext.privateKey ===
            importedCredential.privateKey && !decryptedCredential.needsUpgrade,
        );
      } catch (error) {
        reporter.fail(
          'Credential',
          'Build & read credential chain',
          getLocalSecretEnvelopeE2EErrorMessage(error),
        );
      }

      if (
        rawCredentialValue !== undefined &&
        innerCredentialValue !== undefined
      ) {
        const rawCredential = rawCredentialValue;
        const innerCredential = innerCredentialValue;

        // Cloud Backup export guard.
        try {
          const backupCredentials = await buildLegacyCredentialsForCloudBackup({
            credentials: {
              [credentialId]: innerCredential,
            },
            password,
          });
          const backupCredential = backupCredentials[credentialId];
          backupPortableCredentialPrefix =
            typeof backupCredential === 'string'
              ? backupCredential.slice(0, 4)
              : '';
          reporter.check(
            'Cloud Backup export',
            'Exports portable |PK| credential',
            typeof backupCredential === 'string' &&
              backupCredential.startsWith('|PK|') &&
              backupCredential !== rawCredential,
          );
        } catch (error) {
          reporter.fail(
            'Cloud Backup export',
            'Exports portable |PK| credential',
            getLocalSecretEnvelopeE2EErrorMessage(error),
          );
        }
        try {
          const rawBackup = await buildLegacyCredentialsForCloudBackup({
            credentials: {
              [credentialId]: rawCredential,
            },
            password,
          });
          // Cloud Backup must filter raw LSE out (not export it as a portable
          // credential), so the result map must not contain this id.
          backupRejectsRawLocalSecretEnvelope =
            rawBackup[credentialId] === undefined;
        } catch {
          // Throwing is also an acceptable form of rejection.
          backupRejectsRawLocalSecretEnvelope = true;
        }
        reporter.check(
          'Cloud Backup export',
          'Filters out raw LSE credential',
          backupRejectsRawLocalSecretEnvelope,
          backupRejectsRawLocalSecretEnvelope
            ? undefined
            : 'raw LSE was exported instead of being filtered out',
        );

        // Prime Transfer export guard.
        try {
          const primeTransferCredential = normalizePrimeTransferCredential({
            credential: innerCredential,
          });
          primeTransferPortableCredentialPrefix =
            typeof primeTransferCredential === 'string'
              ? primeTransferCredential.slice(0, 4)
              : '';
          reporter.check(
            'Prime Transfer export',
            'Accepts portable |PK| credential',
            typeof primeTransferCredential === 'string' &&
              primeTransferCredential.startsWith('|PK|'),
          );
        } catch (error) {
          reporter.fail(
            'Prime Transfer export',
            'Accepts portable |PK| credential',
            getLocalSecretEnvelopeE2EErrorMessage(error),
          );
        }
        try {
          // Prime Transfer must filter raw LSE out (returns undefined), not
          // accept it for transfer.
          const normalizedRaw = normalizePrimeTransferCredential(rawCredential);
          primeTransferRejectsRawLocalSecretEnvelope = !normalizedRaw;
        } catch {
          // Throwing is also an acceptable form of rejection.
          primeTransferRejectsRawLocalSecretEnvelope = true;
        }
        reporter.check(
          'Prime Transfer export',
          'Filters out raw LSE credential',
          primeTransferRejectsRawLocalSecretEnvelope,
          primeTransferRejectsRawLocalSecretEnvelope
            ? undefined
            : 'raw LSE was accepted instead of being filtered out',
        );
      } else {
        reporter.skip(
          'Cloud Backup export',
          'Cloud Backup export checks',
          'credential chain unavailable',
        );
        reporter.skip(
          'Prime Transfer export',
          'Prime Transfer export checks',
          'credential chain unavailable',
        );
      }

      const summary: Record<string, unknown> = {
        backupPortableCredentialPrefix,
        backupRejectsRawLocalSecretEnvelope,
        credentialLayerKinds: credentialEnvelope
          ? getLocalSecretEnvelopeLayerKinds(credentialEnvelope)
          : [],
        credentialStrength: credentialEnvelope?.strength,
        innerCredentialPrefix,
        primeTransferPortableCredentialPrefix,
        primeTransferRejectsRawLocalSecretEnvelope,
        rawCredentialIsLse: rawCredentialValue
          ? isLocalSecretEnvelopeString(rawCredentialValue)
          : false,
        runtimePlatform,
      };

      return reporter.toReport({ runtimePlatform, summary, testName });
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
  ): Promise<ILocalSecretEnvelopeE2ETestReport> {
    checkDevOnlyPassword(params);
    const reporter = createLocalSecretEnvelopeE2EReporter();
    const testName = 'LSE Self-Test';
    let runtimePlatform = 'unknown';
    let verifyStringEnvelope: ILocalSecretEnvelopeV1 | undefined;
    const credentialEnvelopes: ILocalSecretEnvelopeV1[] = [];
    const credentialIdsToCleanup: string[] = [];
    const layerDeletionBlocksUnwrap: Partial<
      Record<ILocalSecretEnvelopeLayerKind, boolean>
    > = {};
    const runId = `${Date.now().toString(36)}-${generateUUID({
      removeDashes: true,
    }).slice(0, 6)}`;

    try {
      const config =
        await localDb.buildLocalSecretEnvelopeCredentialMigrationConfig();
      if (!config) {
        reporter.fail(
          'Config',
          'LSE config is available',
          'config is unavailable',
        );
        return reporter.toReport({ runtimePlatform, testName });
      }
      reporter.pass('Config', 'LSE config is available');

      runtimePlatform = config.runtimePlatform ?? 'unknown';
      const configuredLayerKinds = config.layerAdapters.map(
        (adapter) => adapter.kind,
      );
      const expectedLayerKinds =
        options.expectedCredentialLayerKinds ?? configuredLayerKinds;
      const expectedStrength = options.expectedStrength ?? config.strength;

      if (options.expectedRuntimePlatform) {
        reporter.check(
          'Config',
          'Runtime platform matches expected',
          runtimePlatform === options.expectedRuntimePlatform,
          `expected ${options.expectedRuntimePlatform}, got ${runtimePlatform}`,
        );
      }
      if (
        !reporter.check(
          'Config',
          'At least one expected layer',
          expectedLayerKinds.length > 0,
          `expected layers: ${expectedLayerKinds.join(',') || '(none)'}`,
        )
      ) {
        return reporter.toReport({ runtimePlatform, testName });
      }
      reporter.check(
        'Config',
        'Configured layers match expected',
        localSecretEnvelopeLayerKindsEqual(
          configuredLayerKinds,
          expectedLayerKinds,
        ),
        `expected ${expectedLayerKinds.join(',')}, got ${configuredLayerKinds.join(
          ',',
        )}`,
      );
      reporter.check(
        'Config',
        'Config strength matches expected',
        config.strength === expectedStrength,
        `expected ${expectedStrength}, got ${config.strength}`,
      );

      const resolveLayerAdapter = buildLocalSecretEnvelopeLayerAdapterResolver(
        config.layerAdapters,
      );
      if (!resolveLayerAdapter) {
        reporter.fail(
          'Config',
          'Layer adapter resolver is available',
          'resolver is unavailable',
        );
        return reporter.toReport({ runtimePlatform, testName });
      }
      reporter.pass('Config', 'Layer adapter resolver is available');

      let password: string;
      try {
        password = await encodePasswordAsync({
          password: LOCAL_SECRET_ENVELOPE_E2E_PASSWORD,
        });
      } catch (error) {
        reporter.fail(
          'Setup',
          'Encode E2E password',
          getLocalSecretEnvelopeE2EErrorMessage(error),
        );
        return reporter.toReport({ runtimePlatform, testName });
      }

      // Verify-string round trip.
      try {
        const verifyStringInner = await encryptVerifyString({ password });
        const wrappedVerifyString = await wrapLocalSecretEnvelopeV1({
          dataType: 'verify-string',
          layerAdapters: config.layerAdapters,
          plaintext: verifyStringInner,
          recordId: DB_MAIN_CONTEXT_ID,
          strength: expectedStrength,
        });
        verifyStringEnvelope = parseLocalSecretEnvelopeV1(wrappedVerifyString);
        const actualLayerKinds =
          getLocalSecretEnvelopeLayerKinds(verifyStringEnvelope);
        reporter.check(
          'Verify string',
          'Wrapped as LSE with expected layers',
          localSecretEnvelopeLayerKindsEqual(
            actualLayerKinds,
            expectedLayerKinds,
          ),
          `expected ${expectedLayerKinds.join(',')}, got ${actualLayerKinds.join(
            ',',
          )}`,
        );
        reporter.check(
          'Verify string',
          'Strength matches expected',
          verifyStringEnvelope.strength === expectedStrength,
          `expected ${expectedStrength}, got ${verifyStringEnvelope.strength}`,
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
        reporter.check(
          'Verify string',
          'Decrypts back to default verify string',
          decryptedVerifyString.plaintext === DEFAULT_VERIFY_STRING &&
            !decryptedVerifyString.needsUpgrade,
        );
      } catch (error) {
        reporter.fail(
          'Verify string',
          'Verify string round trip',
          getLocalSecretEnvelopeE2EErrorMessage(error),
        );
      }

      // Per-layer credential wrap + key-deletion guard.
      for (let index = 0; index < expectedLayerKinds.length; index += 1) {
        const layerKind = expectedLayerKinds[index];
        const group = `Credential layer: ${layerKind}`;
        const credentialId = buildLocalSecretEnvelopeDebugCredentialId({
          index,
          layerKind,
          runId,
        });
        credentialIdsToCleanup.push(credentialId);
        const credentialEnvelope =
          await this.collectLocalSecretEnvelopeDebugCredentialCheckpoints({
            credentialId,
            expectedLayerKinds,
            expectedStrength,
            group,
            layerAdapters: config.layerAdapters,
            password,
            reporter,
            seedMarker: String(index + 1).padStart(2, '0'),
          });
        if (!credentialEnvelope) {
          reporter.skip(
            group,
            'Deleting key blocks unwrap',
            'credential was not created',
          );
        } else {
          credentialEnvelopes.push(credentialEnvelope);

          const layer = credentialEnvelope.wrappingLayers.find(
            (item) => item.kind === layerKind,
          );
          if (!layer) {
            reporter.fail(
              group,
              'Deleting key blocks unwrap',
              `layer missing: ${layerKind}`,
            );
          } else {
            try {
              const deletionBlocksUnwrap =
                layerKind === 'secure-storage'
                  ? await checkSecureStorageDeletionBlocksUnwrapInIsolatedLayer(
                      {
                        index,
                        runId,
                      },
                    )
                  : await (async () => {
                      await removeLocalSecretEnvelopeLayerKey(layer);
                      return this.checkLocalSecretEnvelopeCredentialReadBlocked(
                        {
                          credentialId,
                        },
                      );
                    })();
              layerDeletionBlocksUnwrap[layerKind] = deletionBlocksUnwrap;
              reporter.check(
                group,
                'Deleting key blocks unwrap',
                deletionBlocksUnwrap,
                deletionBlocksUnwrap
                  ? undefined
                  : `still readable after deleting ${layerKind} layer`,
              );
            } catch (error) {
              reporter.fail(
                group,
                'Deleting key blocks unwrap',
                getLocalSecretEnvelopeE2EErrorMessage(error),
              );
            }
          }
        }
      }

      const lastCredentialEnvelope =
        credentialEnvelopes[credentialEnvelopes.length - 1];
      const summary: Record<string, unknown> = {
        credentialLayerKinds: lastCredentialEnvelope
          ? getLocalSecretEnvelopeLayerKinds(lastCredentialEnvelope)
          : [],
        credentialStrength: lastCredentialEnvelope?.strength,
        cryptoKeyDeletionBlocksUnwrap:
          layerDeletionBlocksUnwrap['indexeddb-cryptokey'] === true,
        layerDeletionBlocksUnwrap,
        runtimePlatform,
        secureStorageDeletionBlocksUnwrap:
          layerDeletionBlocksUnwrap['secure-storage'] === true,
        verifyStringIsLse: Boolean(verifyStringEnvelope),
        verifyStringLayerKinds: verifyStringEnvelope
          ? getLocalSecretEnvelopeLayerKinds(verifyStringEnvelope)
          : [],
        verifyStringStrength: verifyStringEnvelope?.strength,
      };

      return reporter.toReport({ runtimePlatform, summary, testName });
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
    const runId = `${Date.now().toString(36)}-${generateUUID({
      removeDashes: true,
    }).slice(0, 6)}`;

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

  // Dev-only, read-only, NON-destructive inventory of every locally stored
  // secret record (all credentials + the context verify-string). For each
  // record it reports the encryption method and KDF iteration count, tagged as
  // "confirmed" (exact value read from a header) or "inferred" (a default we
  // could not verify). For LSE records it peels ONLY the device-bound layer
  // (never the user password) to read the exact inner iterations; the inner
  // password-encrypted value is parsed for its header and discarded — never
  // returned, logged, or surfaced. It never exposes ciphertext or plaintext and
  // never decrypts the secret. Works on every platform (Realm native +
  // IndexedDB ext/web/desktop) via the platform-agnostic localDb APIs.
  @backgroundMethodForDev()
  async runLocalSecretEnvelopeMigrationDiagnostic(
    params: IBackgroundMethodWithDevOnlyPassword,
  ): Promise<ILocalSecretEnvelopeE2ETestReport> {
    checkDevOnlyPassword(params);
    const reporter = createLocalSecretEnvelopeE2EReporter();
    const testName = 'LSE Migration Diagnostic';
    let runtimePlatform = 'unknown';

    const categoryCounts: Partial<
      Record<ILocalSecretEnvelopeDiagnosticCategory, number>
    > = {};
    const bumpCategory = (category: ILocalSecretEnvelopeDiagnosticCategory) => {
      categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
    };
    const reportRecord = (
      group: string,
      label: string,
      result: Awaited<
        ReturnType<typeof describeLocalSecretEnvelopeRecordEncryption>
      >,
    ) => {
      bumpCategory(result.category);
      if (result.status === 'passed') {
        reporter.pass(group, label, result.detail);
      } else if (result.status === 'failed') {
        reporter.fail(group, label, result.detail);
      } else {
        reporter.skip(group, label, result.detail);
      }
    };

    try {
      // The runtime platform is detected directly (NOT taken from config):
      // config is undefined whenever no layer is available, which would
      // otherwise mislabel the platform as "unknown".
      const detectedPlatform = detectLocalSecretEnvelopeRuntimePlatform();
      runtimePlatform = detectedPlatform;

      // --- Capability breakdown --------------------------------------------
      // The layer availability probes swallow their own error (return false),
      // so when config is empty we cannot tell WHY. Re-test each underlying
      // primitive independently here and surface the exact failing step. All
      // probe values below are throwaway test material, never real secrets.
      reporter.skip(
        'Capabilities',
        'runtime platform',
        `detected=${detectedPlatform}`,
      );

      // 1) secure random (used to generate layer keys + nonces)
      try {
        const randomFn = globalThis.crypto?.getRandomValues?.bind(
          globalThis.crypto,
        );
        if (typeof randomFn !== 'function') {
          throw new OneKeyLocalError(
            'globalThis.crypto.getRandomValues is missing',
          );
        }
        randomFn(new Uint8Array(12));
        reporter.pass('Capabilities', 'crypto.getRandomValues', 'available');
      } catch (error) {
        reporter.fail(
          'Capabilities',
          'crypto.getRandomValues',
          getLocalSecretEnvelopeE2EErrorMessage(error),
        );
      }

      // 2) OS secure storage (expo-secure-store) write/read round-trip
      // Mirror the real layer's key charset: expo-secure-store only accepts
      // [A-Za-z0-9_.-], so use "_" separators (a ":" is rejected).
      const secureStorageProbeKey = `onekey_lse_diagnostic_probe_${Date.now()}`;
      try {
        const supported =
          secureStorageInstance.supportSecureStorageWithoutInteraction
            ? await secureStorageInstance.supportSecureStorageWithoutInteraction()
            : await secureStorageInstance.supportSecureStorage();
        if (!supported) {
          throw new OneKeyLocalError('supportSecureStorage returned false');
        }
        await secureStorageInstance.setSecureItem(
          secureStorageProbeKey,
          'diagnostic-probe',
        );
        const readBack = await secureStorageInstance.getSecureItem(
          secureStorageProbeKey,
        );
        if (readBack !== 'diagnostic-probe') {
          throw new OneKeyLocalError(
            `round-trip mismatch (read ${
              readBack === null ? 'null' : 'a different value'
            })`,
          );
        }
        reporter.pass(
          'Capabilities',
          'OS secure storage set/get',
          'round-trip ok',
        );
      } catch (error) {
        reporter.fail(
          'Capabilities',
          'OS secure storage set/get',
          getLocalSecretEnvelopeE2EErrorMessage(error),
        );
      } finally {
        await secureStorageInstance
          .removeSecureItem(secureStorageProbeKey)
          .catch(() => undefined);
      }

      // 3) app AES-256-GCM encrypt/decrypt round-trip (the layer's cipher)
      try {
        const probeKey = Buffer.alloc(32, 7);
        const probeNonce = Buffer.alloc(12, 3);
        const probeAad = bufferUtils.utf8ToBytes('lse-diagnostic-aad');
        const encrypted = await aesGcmEncrypt({
          aad: probeAad,
          data: bufferUtils.utf8ToBytes('lse-diagnostic-plaintext'),
          key: probeKey,
          nonce: probeNonce,
        });
        const decrypted = await aesGcmDecrypt({
          aad: probeAad,
          data: encrypted,
          key: probeKey,
          nonce: probeNonce,
        });
        if (bufferUtils.bytesToUtf8(decrypted) !== 'lse-diagnostic-plaintext') {
          throw new OneKeyLocalError('round-trip mismatch');
        }
        reporter.pass(
          'Capabilities',
          'app AES-256-GCM cipher',
          'round-trip ok',
        );
      } catch (error) {
        reporter.fail(
          'Capabilities',
          'app AES-256-GCM cipher',
          getLocalSecretEnvelopeE2EErrorMessage(error),
        );
      }

      // 4) the real layer availability probes (booleans; their internal error
      //    is swallowed, so the per-primitive steps above localize the cause).
      //    Reset the failure cache first to force a fresh probe.
      resetSecureStorageLocalSecretEnvelopeProbeCache();
      try {
        const secureAvailable =
          await isSecureStorageLocalSecretEnvelopeLayerAvailable();
        if (secureAvailable) {
          reporter.pass(
            'Capabilities',
            'secure-storage layer probe',
            'available',
          );
        } else {
          reporter.fail(
            'Capabilities',
            'secure-storage layer probe',
            'unavailable (probe returned false — see the failing step above)',
          );
        }
      } catch (error) {
        reporter.fail(
          'Capabilities',
          'secure-storage layer probe',
          getLocalSecretEnvelopeE2EErrorMessage(error),
        );
      }
      try {
        const indexedDbCryptoKeyAvailable =
          await isIndexedDbCryptoKeyLocalSecretEnvelopeLayerAvailable();
        reporter.skip(
          'Capabilities',
          'indexeddb-cryptokey layer probe',
          indexedDbCryptoKeyAvailable
            ? 'available'
            : 'unavailable (expected on native: no IndexedDB / WebCrypto)',
        );
      } catch (error) {
        reporter.skip(
          'Capabilities',
          'indexeddb-cryptokey layer probe',
          getLocalSecretEnvelopeE2EErrorMessage(error),
        );
      }
      // ---------------------------------------------------------------------

      const config =
        await localDb.buildLocalSecretEnvelopeCredentialMigrationConfig();
      reporter.skip(
        'Runtime',
        'Platform / configured layers',
        `platform=${detectedPlatform} · layers=[${
          (config?.layerAdapters ?? [])
            .map((adapter) => adapter.kind)
            .join(' + ') || '(none)'
        }] · strength=${config?.strength ?? 'unavailable'}`,
      );

      // Resolver for peeling ONLY the device-bound layer of LSE records, so the
      // exact inner KDF iteration count can be read. If the platform has no
      // configured layers, LSE records fall back to the inferred target value.
      const resolveLayerAdapter = config?.layerAdapters?.length
        ? buildLocalSecretEnvelopeLayerAdapterResolver(config.layerAdapters)
        : undefined;

      // Context verify-string (lives in the Context store, not Credential).
      try {
        const context = await localDb.getContext();
        reportRecord(
          'Verify String',
          'context verifyString',
          await describeLocalSecretEnvelopeRecordEncryption({
            dataType: 'verify-string',
            rawValue: context.verifyString ?? '',
            recordId: DB_MAIN_CONTEXT_ID,
            resolveLayerAdapter,
          }),
        );
      } catch (error) {
        reporter.fail(
          'Verify String',
          'context verifyString',
          getLocalSecretEnvelopeE2EErrorMessage(error),
        );
      }

      // All credential records.
      const credentials = await localDb.getAllCredentials();
      reporter.skip(
        'Credentials',
        'total credential records',
        `${credentials.length} record(s)`,
      );
      const sortedCredentials = [...credentials].toSorted((a, b) =>
        natsort({ insensitive: true })(a.id, b.id),
      );
      for (const credential of sortedCredentials) {
        reportRecord(
          'Credentials',
          maskLocalSecretEnvelopeRecordId(credential.id),
          // eslint-disable-next-line no-await-in-loop
          await describeLocalSecretEnvelopeRecordEncryption({
            dataType: 'credential',
            rawValue: credential.credential ?? '',
            recordId: credential.id,
            resolveLayerAdapter,
          }),
        );
      }

      // Guarantees passedCount > 0 so a clean scan reads as "completed", even
      // when every record is skipped (e.g. fresh wallet, default verify-string).
      reporter.pass(
        'Summary',
        'scan completed',
        Object.entries(categoryCounts)
          .map(([category, count]) => `${category}=${count}`)
          .join(' · ') || 'no records found',
      );
    } catch (error) {
      reporter.fail(
        'Diagnostic',
        'scan local secret records',
        getLocalSecretEnvelopeE2EErrorMessage(error),
      );
    }

    return reporter.toReport({
      runtimePlatform,
      testName,
      summary: { categoryCounts },
    });
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
