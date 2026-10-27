import { ZCASH_ADDRESS_SCHEME_VERSION } from '@onekeyhq/core/src/chains/zcash/sdkZcash/constants';
import type { IZcashDeriveAddressFromUfvkResult } from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

import { getLastLocalWalletChainTip } from '../../localWallet/privacyChainCacheStore';
import { getViewingKeyFingerprint } from '../../localWallet/viewingKeyFingerprint';
import {
  getLocalWalletViewingKey,
  isLocalWalletViewingKeyMismatchError,
  saveLocalWalletViewingKey,
} from '../../localWallet/viewingKeyStore';

import {
  clampZcashBirthdayHeight,
  estimateZcashBirthdayHeight,
} from './birthday';
import {
  createZcashIdentityMismatchError,
  createZcashSetupIncompleteError,
  zcashIdentityMismatchAccountIds,
} from './vaultUtils';

import type { IBackgroundApi } from '../../../apis/IBackgroundApi';
import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IZcashAccountMeta,
  SimpleDbEntityPrivacyChainState,
} from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainState';

export type IZcashDerivedViewingMeta = {
  ufvk: string;
  unifiedAddress: string;
  // Hardware keyring only: the app-derived counterpart of a device-displayed address.
  derivedUnifiedAddress?: string;
  transparentAddress: string;
  seedFingerprintHex: string;
};

// The UFVK the meta names; missing or mismatched means unfinished setup, which Repair derives again.
export async function getZcashAccountUfvk({
  backgroundApi,
  networkId,
  accountId,
  meta,
}: {
  backgroundApi: IBackgroundApi;
  networkId: string;
  accountId: string;
  meta: IZcashAccountMeta;
}): Promise<string> {
  const key = await getLocalWalletViewingKey({
    backgroundApi,
    networkId,
    accountId,
  });
  if (!key || key.vkFp !== meta.vkFp) {
    throw createZcashSetupIncompleteError();
  }
  return key.value;
}

export async function hasZcashAccountViewingKey({
  backgroundApi,
  networkId,
  accountId,
  vkFp,
}: {
  backgroundApi: IBackgroundApi;
  networkId: string;
  accountId: string;
  vkFp: string;
}): Promise<boolean> {
  const key = await getLocalWalletViewingKey({
    backgroundApi,
    networkId,
    accountId,
  });
  return key?.vkFp === vkFp;
}

// The UFVK is stored before the meta naming it; a different key stops setup so the identity never switches.
async function saveZcashViewingKey({
  backgroundApi,
  networkId,
  accountId,
  ufvk,
  expectedVkFp,
}: {
  backgroundApi: IBackgroundApi;
  networkId: string;
  accountId: string;
  ufvk: string;
  expectedVkFp?: string;
}): Promise<string> {
  if (
    expectedVkFp !== undefined &&
    getViewingKeyFingerprint({ networkId, viewingKey: ufvk }) !== expectedVkFp
  ) {
    zcashIdentityMismatchAccountIds.add(accountId);
    throw createZcashIdentityMismatchError();
  }
  try {
    const { vkFp } = await saveLocalWalletViewingKey({
      backgroundApi,
      networkId,
      accountId,
      value: ufvk,
    });
    zcashIdentityMismatchAccountIds.delete(accountId);
    return vkFp;
  } catch (error) {
    if (isLocalWalletViewingKeyMismatchError(error)) {
      zcashIdentityMismatchAccountIds.add(accountId);
      throw createZcashIdentityMismatchError();
    }
    throw error;
  }
}

export async function resolveAndSaveZcashAccountMeta({
  backgroundApi,
  networkId,
  account,
  derive,
  forceDerivation = false,
}: {
  backgroundApi: IBackgroundApi;
  networkId: string;
  account: IDBAccount;
  derive: (params: {
    hdIndex: number;
  }) => Promise<IZcashDerivedViewingMeta & { chainTip: number | null }>;
  forceDerivation?: boolean;
}): Promise<void> {
  const hdIndex = checkIsDefined(account.pathIndex);
  const [existing, privacyModeState, storedKey] = await Promise.all([
    backgroundApi.simpleDb.privacyChainState.getZcashAccountMeta({
      accountId: account.id,
    }),
    backgroundApi.simpleDb.privacyChainState.getZcashPrivacyModeState({
      accountId: account.id,
    }),
    getLocalWalletViewingKey({
      backgroundApi,
      networkId,
      accountId: account.id,
    }),
  ]);
  const keyMatchesMeta = !!existing && storedKey?.vkFp === existing.vkFp;
  if (existing?.birthdayHeight && keyMatchesMeta && !forceDerivation) {
    return;
  }
  if (
    !existing?.birthdayHeight &&
    privacyModeState.birthdayHeight === undefined &&
    privacyModeState.birthdayTimestamp === undefined
  ) {
    throw new OneKeyLocalError(
      'zcash: privacy birthday is required before deriving viewing metadata',
    );
  }

  const epoch = await backgroundApi.simpleDb.privacyChainState.getAccountEpoch({
    accountId: account.id,
  });
  const derived = await derive({ hdIndex });
  if (
    !(await backgroundApi.serviceAccount.getDBAccountSafe({
      accountId: account.id,
    }))
  ) {
    throw new OneKeyLocalError('zcash: account removed during privacy setup');
  }
  // Local data deleted (or reset) while deriving: never write the key back.
  if (
    (await backgroundApi.simpleDb.privacyChainState.getAccountEpoch({
      accountId: account.id,
    })) !== epoch
  ) {
    throw new OneKeyLocalError('zcash: privacy state changed during setup');
  }
  const vkFp = await saveZcashViewingKey({
    backgroundApi,
    networkId,
    accountId: account.id,
    ufvk: derived.ufvk,
    expectedVkFp: existing?.vkFp,
  });
  if (existing?.birthdayHeight) {
    return;
  }

  // Enable stays offline: the last tip a sync saw beats the clock estimate.
  const chainTip =
    derived.chainTip ??
    (await getLastLocalWalletChainTip({ backgroundApi, networkId }).catch(
      () => undefined,
    ));
  let birthdayHeight: number;
  let birthdaySource: IZcashAccountMeta['birthdaySource'];
  if (privacyModeState.birthdayHeight !== undefined) {
    birthdayHeight = clampZcashBirthdayHeight({
      birthdayHeight: privacyModeState.birthdayHeight,
      chainTip,
    });
    birthdaySource = 'manual-height';
  } else {
    const birthdayTimestamp = checkIsDefined(
      privacyModeState.birthdayTimestamp,
    );
    birthdayHeight = estimateZcashBirthdayHeight({
      birthdayTimestamp,
      chainTip,
      now: Date.now(),
    });
    birthdaySource =
      privacyModeState.birthdayMonthHint?.source === 'created-wallet'
        ? 'fresh-wallet'
        : 'restore-month';
  }
  await backgroundApi.simpleDb.privacyChainState.saveZcashAccountMeta({
    accountId: account.id,
    expectedPrivacyModeState: privacyModeState,
    meta: {
      vkFp,
      unifiedAddress: derived.unifiedAddress,
      derivedUnifiedAddress: derived.derivedUnifiedAddress,
      transparentAddress: derived.transparentAddress,
      addressSchemeVersion: ZCASH_ADDRESS_SCHEME_VERSION,
      seedFingerprintHex: derived.seedFingerprintHex,
      hdIndex,
      birthdayHeight,
      birthdaySource,
      birthdayTimestamp: privacyModeState.birthdayTimestamp,
      createdAt: Date.now(),
    },
  });
}

export async function refreshZcashAccountAddressCache({
  accountId,
  store,
  isHardware,
  deriveAddresses,
}: {
  accountId: string;
  store: Pick<
    SimpleDbEntityPrivacyChainState,
    'getZcashAccountMeta' | 'saveZcashAccountMeta'
  >;
  isHardware: boolean;
  deriveAddresses: (
    meta: IZcashAccountMeta,
  ) => Promise<IZcashDeriveAddressFromUfvkResult>;
}): Promise<IZcashAccountMeta | undefined> {
  const meta = await store.getZcashAccountMeta({ accountId });
  if (!meta || meta.addressSchemeVersion === ZCASH_ADDRESS_SCHEME_VERSION) {
    return meta;
  }
  if (
    meta.addressSchemeVersion !== undefined &&
    meta.addressSchemeVersion > ZCASH_ADDRESS_SCHEME_VERSION
  ) {
    throw new OneKeyLocalError('zcash: address cache requires a newer App');
  }

  const derived = await deriveAddresses(meta);
  if (
    !derived.unifiedAddress ||
    derived.transparentAddress !== meta.transparentAddress
  ) {
    throw new OneKeyLocalError(
      'zcash: derived addresses do not match the stored viewing identity',
    );
  }
  const refreshed: IZcashAccountMeta = {
    ...meta,
    unifiedAddress: isHardware ? meta.unifiedAddress : derived.unifiedAddress,
    derivedUnifiedAddress:
      isHardware && derived.unifiedAddress !== meta.unifiedAddress
        ? derived.unifiedAddress
        : undefined,
    addressSchemeVersion: ZCASH_ADDRESS_SCHEME_VERSION,
  };
  try {
    // A concurrent delete or repair must not be overwritten by this read.
    await store.saveZcashAccountMeta({
      accountId,
      meta: refreshed,
      expectedMeta: meta,
    });
  } catch (error) {
    const current = await store.getZcashAccountMeta({ accountId });
    if (
      current?.vkFp === meta.vkFp &&
      current.addressSchemeVersion === ZCASH_ADDRESS_SCHEME_VERSION &&
      current.unifiedAddress === refreshed.unifiedAddress &&
      current.transparentAddress === refreshed.transparentAddress &&
      current.derivedUnifiedAddress === refreshed.derivedUnifiedAddress
    ) {
      return current;
    }
    throw error;
  }
  return refreshed;
}
