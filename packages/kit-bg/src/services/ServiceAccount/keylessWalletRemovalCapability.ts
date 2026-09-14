import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { MalformedKeylessWalletRemovalCapability } from './malformedKeylessWalletRemovalCapability';

import type { IDBWallet } from '../../dbs/local/types';

export type IKeylessWalletRemovalIdentity = {
  walletId: string;
  keylessOwnerId: string;
  keylessProvider: EOAuthSocialLoginProvider;
  socialUserIdHash: string;
};

export type IMalformedKeylessWalletFingerprint = {
  walletId: string;
  isKeyless: boolean | null;
  keylessOwnerId: string | null;
  keylessProvider: string | null;
  socialUserIdHash: string | null;
};

const keylessWalletRemovalCapabilityBrand = Symbol(
  'keylessWalletRemovalCapability',
);

class KeylessWalletRemovalCapability {
  readonly [keylessWalletRemovalCapabilityBrand] = true;

  readonly expectedIdentity: Readonly<IKeylessWalletRemovalIdentity>;

  readonly operationId: string;

  readonly lifecycleRevision: number;

  private consumed = false;

  constructor({
    expectedIdentity,
    operationId,
    lifecycleRevision,
  }: {
    expectedIdentity: IKeylessWalletRemovalIdentity;
    operationId: string;
    lifecycleRevision: number;
  }) {
    this.expectedIdentity = Object.freeze({ ...expectedIdentity });
    this.operationId = operationId;
    this.lifecycleRevision = lifecycleRevision;
  }

  consume({
    operationId,
    lifecycleRevision,
  }: {
    operationId: string;
    lifecycleRevision: number;
  }) {
    if (
      this.consumed ||
      operationId !== this.operationId ||
      lifecycleRevision !== this.lifecycleRevision
    ) {
      throw new OneKeyLocalError(
        'The Keyless wallet removal authorization is invalid or already used.',
      );
    }
    this.consumed = true;
  }
}

export type IKeylessWalletRemovalCapability = KeylessWalletRemovalCapability;
export type IMalformedKeylessWalletRemovalCapability =
  MalformedKeylessWalletRemovalCapability;

/**
 * Creates an in-memory authorization that cannot survive an RPC boundary.
 * The identity-exit coordinator must issue it only after password verification
 * and its final state revalidation.
 */
export function createKeylessWalletRemovalCapability(params: {
  expectedIdentity: IKeylessWalletRemovalIdentity;
  operationId: string;
  lifecycleRevision: number;
}): IKeylessWalletRemovalCapability {
  return new KeylessWalletRemovalCapability(params);
}

export function createMalformedKeylessWalletRemovalCapability(params: {
  expectedFingerprint: IMalformedKeylessWalletFingerprint;
  operationId: string;
  lifecycleRevision: number;
}): IMalformedKeylessWalletRemovalCapability {
  return new MalformedKeylessWalletRemovalCapability(params);
}

export function isIdentityManagedKeylessWallet(
  wallet: IDBWallet | undefined,
): boolean {
  if (!wallet || accountUtils.isBotWallet({ walletId: wallet.id })) {
    return false;
  }
  return Boolean(
    wallet.isKeyless || wallet.keylessDetails || wallet.keylessDetailsInfo,
  );
}

function normalizeRuntimeString(value: unknown): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return String(value);
}

export function getMalformedKeylessWalletFingerprint(
  wallet: IDBWallet,
): IMalformedKeylessWalletFingerprint {
  return {
    walletId: wallet.id,
    isKeyless: typeof wallet.isKeyless === 'boolean' ? wallet.isKeyless : null,
    keylessOwnerId: normalizeRuntimeString(
      wallet.keylessDetailsInfo?.keylessOwnerId,
    ),
    keylessProvider: normalizeRuntimeString(
      wallet.keylessDetailsInfo?.keylessProvider,
    ),
    socialUserIdHash: normalizeRuntimeString(
      wallet.keylessDetailsInfo?.socialUserIdHash,
    ),
  };
}

export function getMalformedKeylessWalletDataError(
  wallet: IDBWallet,
): string | undefined {
  const fingerprint = getMalformedKeylessWalletFingerprint(wallet);
  if (fingerprint.isKeyless !== true) {
    return `Keyless wallet isKeyless is invalid for wallet ${
      wallet.id
    }: ${String(wallet.isKeyless)}.`;
  }
  if (!fingerprint.keylessOwnerId) {
    return 'Keyless wallet keylessDetailsInfo.keylessOwnerId is missing.';
  }
  if (!fingerprint.keylessProvider) {
    return 'Keyless wallet keylessDetailsInfo.keylessProvider is missing.';
  }
  if (
    fingerprint.keylessProvider !== EOAuthSocialLoginProvider.Google &&
    fingerprint.keylessProvider !== EOAuthSocialLoginProvider.Apple
  ) {
    return `Keyless wallet keylessDetailsInfo.keylessProvider is invalid: ${fingerprint.keylessProvider}.`;
  }
  if (!fingerprint.socialUserIdHash) {
    return 'Keyless wallet keylessDetailsInfo.socialUserIdHash is missing.';
  }
  return undefined;
}

export function assertWalletCanUseGenericRemoval(
  wallet: IDBWallet | undefined,
): void {
  if (isIdentityManagedKeylessWallet(wallet)) {
    throw new OneKeyLocalError(
      'Keyless wallets must be removed through the identity exit coordinator.',
    );
  }
}

function assertSameIdentityField(params: {
  field: keyof IKeylessWalletRemovalIdentity;
  actual: string | undefined;
  expected: string;
}): void {
  const { field, actual, expected } = params;
  if (actual !== expected) {
    throw new OneKeyLocalError(
      `Keyless wallet identity changed: ${field} expected ${expected}, received ${
        actual ?? 'undefined'
      }.`,
    );
  }
}

export function assertKeylessWalletRemovalAuthorized(params: {
  capability: IKeylessWalletRemovalCapability;
  expectedIdentity: IKeylessWalletRemovalIdentity;
  wallet: IDBWallet | undefined;
  operationId: string;
  lifecycleRevision: number;
}): void {
  const {
    capability,
    expectedIdentity,
    wallet,
    operationId,
    lifecycleRevision,
  } = params;
  if (!(capability instanceof KeylessWalletRemovalCapability)) {
    throw new OneKeyLocalError(
      'A valid background Keyless wallet removal capability is required.',
    );
  }

  const capabilityIdentity = capability.expectedIdentity;
  assertSameIdentityField({
    field: 'walletId',
    actual: capabilityIdentity.walletId,
    expected: expectedIdentity.walletId,
  });
  assertSameIdentityField({
    field: 'keylessOwnerId',
    actual: capabilityIdentity.keylessOwnerId,
    expected: expectedIdentity.keylessOwnerId,
  });
  assertSameIdentityField({
    field: 'keylessProvider',
    actual: capabilityIdentity.keylessProvider,
    expected: expectedIdentity.keylessProvider,
  });
  assertSameIdentityField({
    field: 'socialUserIdHash',
    actual: capabilityIdentity.socialUserIdHash,
    expected: expectedIdentity.socialUserIdHash,
  });

  if (!wallet) {
    throw new OneKeyLocalError(
      `Keyless wallet not found: ${expectedIdentity.walletId}.`,
    );
  }
  if (!wallet.isKeyless) {
    throw new OneKeyLocalError(
      `Keyless wallet isKeyless is missing or false: ${expectedIdentity.walletId}.`,
    );
  }
  if (!isIdentityManagedKeylessWallet(wallet)) {
    throw new OneKeyLocalError(
      `Wallet is no longer a Keyless wallet: ${expectedIdentity.walletId}.`,
    );
  }

  assertSameIdentityField({
    field: 'walletId',
    actual: wallet.id,
    expected: expectedIdentity.walletId,
  });
  assertSameIdentityField({
    field: 'keylessOwnerId',
    actual: wallet.keylessDetailsInfo?.keylessOwnerId,
    expected: expectedIdentity.keylessOwnerId,
  });
  assertSameIdentityField({
    field: 'keylessProvider',
    actual: wallet.keylessDetailsInfo?.keylessProvider,
    expected: expectedIdentity.keylessProvider,
  });
  assertSameIdentityField({
    field: 'socialUserIdHash',
    actual: wallet.keylessDetailsInfo?.socialUserIdHash,
    expected: expectedIdentity.socialUserIdHash,
  });

  capability.consume({ operationId, lifecycleRevision });
}

export function assertMalformedKeylessWalletRemovalAuthorized(params: {
  capability: IMalformedKeylessWalletRemovalCapability;
  expectedFingerprint: IMalformedKeylessWalletFingerprint;
  wallet: IDBWallet | undefined;
  operationId: string;
  lifecycleRevision: number;
}): void {
  const {
    capability,
    expectedFingerprint,
    wallet,
    operationId,
    lifecycleRevision,
  } = params;
  if (!(capability instanceof MalformedKeylessWalletRemovalCapability)) {
    throw new OneKeyLocalError(
      'A valid background malformed Keyless wallet removal capability is required.',
    );
  }
  if (!wallet) {
    throw new OneKeyLocalError(
      `Keyless wallet not found: ${expectedFingerprint.walletId}.`,
    );
  }
  if (!isIdentityManagedKeylessWallet(wallet)) {
    throw new OneKeyLocalError(
      `Wallet is no longer an identity-managed Keyless wallet: ${expectedFingerprint.walletId}.`,
    );
  }
  const capabilityFingerprint = capability.expectedFingerprint;
  const currentFingerprint = getMalformedKeylessWalletFingerprint(wallet);
  const expectedFields: Array<keyof IMalformedKeylessWalletFingerprint> = [
    'walletId',
    'isKeyless',
    'keylessOwnerId',
    'keylessProvider',
    'socialUserIdHash',
  ];
  for (const field of expectedFields) {
    if (
      capabilityFingerprint[field] !== expectedFingerprint[field] ||
      currentFingerprint[field] !== expectedFingerprint[field]
    ) {
      throw new OneKeyLocalError(
        `Malformed Keyless wallet identity changed: ${field}.`,
      );
    }
  }
  if (!getMalformedKeylessWalletDataError(wallet)) {
    throw new OneKeyLocalError(
      'The Keyless wallet data is no longer malformed. Please retry the normal flow.',
    );
  }
  capability.consume({ operationId, lifecycleRevision });
}
