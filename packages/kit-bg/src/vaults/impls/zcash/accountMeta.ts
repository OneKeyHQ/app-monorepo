import { ZCASH_ADDRESS_SCHEME_VERSION } from '@onekeyhq/core/src/chains/zcash/sdkZcash/constants';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

import {
  clampZcashBirthdayHeight,
  estimateZcashBirthdayHeight,
} from './birthday';

import type { IBackgroundApi } from '../../../apis/IBackgroundApi';
import type { IDBAccount } from '../../../dbs/local/types';
import type { IZcashAccountMeta } from '../../../dbs/simple/entity/SimpleDbEntityZcash';

export type IZcashDerivedViewingMeta = {
  ufvk: string;
  unifiedAddress: string;
  // Only the hardware keyring sets this: the app-derived counterpart of a
  // device-displayed address. See IZcashAccountMeta.derivedUnifiedAddress.
  derivedUnifiedAddress?: string;
  transparentAddress: string;
  seedFingerprintHex: string;
};

// Shared by the software and hardware keyrings: the signer only differs in
// where the viewing material comes from (seed vs device). Birthday resolution
// and the persisted record are identical.
export async function resolveAndSaveZcashAccountMeta({
  backgroundApi,
  account,
  derive,
}: {
  backgroundApi: IBackgroundApi;
  account: IDBAccount;
  derive: (params: {
    hdIndex: number;
  }) => Promise<IZcashDerivedViewingMeta & { chainTip: number | null }>;
}): Promise<void> {
  const hdIndex = checkIsDefined(account.pathIndex);
  const [existing, privacyModeState] = await Promise.all([
    backgroundApi.simpleDb.zcash.getAccountMeta({ accountId: account.id }),
    backgroundApi.simpleDb.zcash.getPrivacyModeState({
      accountId: account.id,
    }),
  ]);
  if (existing?.birthdayHeight) {
    return;
  }
  if (
    privacyModeState.birthdayHeight === undefined &&
    privacyModeState.birthdayTimestamp === undefined
  ) {
    throw new OneKeyLocalError(
      'zcash: privacy birthday is required before deriving viewing metadata',
    );
  }

  const derived = await derive({ hdIndex });

  let birthdayHeight: number;
  let birthdaySource: IZcashAccountMeta['birthdaySource'];
  if (privacyModeState.birthdayHeight !== undefined) {
    birthdayHeight = clampZcashBirthdayHeight({
      birthdayHeight: privacyModeState.birthdayHeight,
      chainTip: derived.chainTip ?? undefined,
    });
    birthdaySource = 'manual-height';
  } else {
    const birthdayTimestamp = checkIsDefined(
      privacyModeState.birthdayTimestamp,
    );
    // A null tip (offline, or a carrier that cannot reach lightwalletd)
    // falls back to the clock-based estimate instead of blocking enable.
    birthdayHeight = estimateZcashBirthdayHeight({
      birthdayTimestamp,
      chainTip: derived.chainTip,
      now: Date.now(),
    });
    birthdaySource =
      privacyModeState.birthdayMonthHint?.source === 'created-wallet'
        ? 'fresh-wallet'
        : 'restore-month';
  }
  await backgroundApi.simpleDb.zcash.saveAccountMeta({
    accountId: account.id,
    meta: {
      ufvk: derived.ufvk,
      unifiedAddress: derived.unifiedAddress,
      derivedUnifiedAddress: derived.derivedUnifiedAddress,
      transparentAddress: derived.transparentAddress,
      seedFingerprintHex: derived.seedFingerprintHex,
      hdIndex,
      birthdayHeight,
      birthdaySource,
      birthdayTimestamp: privacyModeState.birthdayTimestamp,
      addressSchemeVersion: ZCASH_ADDRESS_SCHEME_VERSION,
      createdAt: Date.now(),
    },
  });
}
