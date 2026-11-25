import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { isLocalSecretEnvelopeKeyLossDevBuild } from '@onekeyhq/shared/src/utils/localSecretEnvelopeDevUtils';

import {
  DEFAULT_MMKV_PROFILE_KEY_LSE_KEY_REF,
  LOCAL_SECRET_ENVELOPE_INNER_PREFIX,
} from './consts';
import { isLocalSecretEnvelopeIndexedDbKeyRef } from './indexedDbCryptoKeyLayerAdapter';
import {
  isLocalSecretEnvelopeString,
  parseLocalSecretEnvelopeV1,
} from './parser';
import { DEFAULT_SECURE_STORAGE_LSE_GLOBAL_KEY_REF } from './secureStorageLayerAdapter';

import type {
  ILocalSecretEnvelopeLayer,
  ILocalSecretEnvelopeV1,
} from './types';
import type { IDBCredentialBase } from '../types';

export type IWalletLseKeyLossSnapshot = {
  credentialOwners: Map<string, string>;
  credentials: IDBCredentialBase[];
  verifyString: string;
};

export type IWalletLseKeyLossResult = {
  walletCount: number;
  affectedWalletCount: number;
  skippedWalletCount: number;
  deletedKeyCount: number;
  protectedKeyCount: number;
  failedKeyCount: number;
  stopped: boolean;
};

export async function assertLocalSecretEnvelopeWalletKeyLossAllowed(
  isDeveloperModeEnabled: () => Promise<boolean>,
) {
  if (
    !isLocalSecretEnvelopeKeyLossDevBuild() ||
    !(await isDeveloperModeEnabled())
  ) {
    throw new OneKeyLocalError(
      'LSE key deletion requires a local development build with developer mode enabled',
    );
  }
}

const getLayerKey = ({
  keyRef,
  kind,
}: Pick<ILocalSecretEnvelopeLayer, 'keyRef' | 'kind'>) => {
  const storageKind =
    kind === 'keychain' || kind === 'keystore' ? 'secure-storage' : kind;
  return `${storageKind}:${keyRef}`;
};

function isWalletLseKey(layer: ILocalSecretEnvelopeLayer) {
  if (layer.alg !== 'AES-256-GCM' || layer.capabilities.requireAuth)
    return false;
  switch (layer.kind) {
    case 'secure-storage':
      return layer.keyRef === DEFAULT_SECURE_STORAGE_LSE_GLOBAL_KEY_REF;
    case 'mmkv-profile-key':
      return layer.keyRef === DEFAULT_MMKV_PROFILE_KEY_LSE_KEY_REF;
    case 'indexeddb-cryptokey':
      return isLocalSecretEnvelopeIndexedDbKeyRef(layer.keyRef);
    default:
      return false;
  }
}

function snapshotsMatch(
  before: IWalletLseKeyLossSnapshot,
  after: IWalletLseKeyLossSnapshot,
) {
  const records = new Map(
    after.credentials.map(({ id, credential }) => [id, credential]),
  );
  return (
    before.verifyString === after.verifyString &&
    before.credentialOwners.size === after.credentialOwners.size &&
    before.credentials.length === records.size &&
    before.credentials.every(
      ({ id, credential }) => records.get(id) === credential,
    ) &&
    [...before.credentialOwners].every(
      ([id, owner]) => after.credentialOwners.get(id) === owner,
    )
  );
}

export async function simulateWalletLocalSecretEnvelopeKeyLoss({
  assertAllowed,
  readSnapshot,
  authenticate,
  removeKey,
}: {
  assertAllowed: () => Promise<void>;
  readSnapshot: () => Promise<IWalletLseKeyLossSnapshot>;
  authenticate: (credential: IDBCredentialBase) => Promise<void>;
  removeKey: (layer: ILocalSecretEnvelopeLayer) => Promise<void>;
}): Promise<IWalletLseKeyLossResult> {
  await assertAllowed();
  const snapshot = await readSnapshot();
  const before = {
    ...snapshot,
    credentialOwners: new Map(snapshot.credentialOwners),
    credentials: snapshot.credentials.map(({ id, credential }) => ({
      id,
      credential,
    })),
  };
  const protectedKeys = new Set<string>();
  const wallets = new Set<string>();
  const verifiedWallets = new Map<string, Set<string>>();
  const candidates = new Map<string, ILocalSecretEnvelopeLayer>();
  const walletCredentials: Array<{
    credential: IDBCredentialBase;
    envelope: ILocalSecretEnvelopeV1;
    owner: string;
  }> = [];

  try {
    if (isLocalSecretEnvelopeString(before.verifyString)) {
      for (const layer of parseLocalSecretEnvelopeV1(before.verifyString)
        .wrappingLayers) {
        protectedKeys.add(getLayerKey(layer));
      }
    }
    for (const credential of before.credentials.filter(
      ({ credential: value }) => isLocalSecretEnvelopeString(value),
    )) {
      const envelope = parseLocalSecretEnvelopeV1(credential.credential);
      const owner = before.credentialOwners.get(credential.id);
      if (owner) wallets.add(owner);
      if (
        owner &&
        envelope.dataType === 'credential' &&
        envelope.recordId === credential.id &&
        (!envelope.innerPrefix ||
          envelope.innerPrefix ===
            LOCAL_SECRET_ENVELOPE_INNER_PREFIX.hdCredential ||
          envelope.innerPrefix ===
            LOCAL_SECRET_ENVELOPE_INNER_PREFIX.importedCredential)
      ) {
        walletCredentials.push({ credential, envelope, owner });
      } else {
        envelope.wrappingLayers.forEach((layer) =>
          protectedKeys.add(getLayerKey(layer)),
        );
      }
    }
  } catch {
    throw new OneKeyLocalError(
      'Unable to verify all LSE key references. Wallet keys were kept.',
    );
  }

  for (const { credential, envelope, owner } of walletCredentials) {
    const authenticated = await authenticate(credential).then(
      () => true,
      () => false,
    );
    if (authenticated) {
      const verifiedKeys = verifiedWallets.get(owner) ?? new Set<string>();
      verifiedWallets.set(owner, verifiedKeys);
      for (const layer of envelope.wrappingLayers) {
        verifiedKeys.add(getLayerKey(layer));
        if (isWalletLseKey(layer)) candidates.set(getLayerKey(layer), layer);
      }
    } else if (!envelope.innerPrefix) {
      // Older envelopes without a prefix can only be identified after unwrap.
      envelope.wrappingLayers.forEach((layer) =>
        protectedKeys.add(getLayerKey(layer)),
      );
    }
  }
  const deletedKeys = new Set<string>();
  let failedKeyCount = 0;
  let stopped = false;
  const removableKeys = [...candidates].filter(
    ([key]) => !protectedKeys.has(key),
  );
  for (const [key, layer] of removableKeys) {
    try {
      await assertAllowed();
      if (!snapshotsMatch(before, await readSnapshot())) {
        stopped = true;
        break;
      }
      await assertAllowed();
    } catch (error) {
      if (!deletedKeys.size && !failedKeyCount) throw error;
      stopped = true;
      break;
    }
    try {
      await removeKey(layer);
      deletedKeys.add(key);
    } catch {
      failedKeyCount += 1;
    }
  }
  const affectedWalletCount = [...verifiedWallets.values()].filter((keys) =>
    [...keys].some((key) => deletedKeys.has(key)),
  ).length;
  return {
    walletCount: wallets.size,
    affectedWalletCount,
    skippedWalletCount: wallets.size - affectedWalletCount,
    deletedKeyCount: deletedKeys.size,
    protectedKeyCount: candidates.size - removableKeys.length,
    failedKeyCount,
    stopped,
  };
}
