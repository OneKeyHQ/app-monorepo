import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  FIRST_BTC_TAPROOT_ADDRESS_PATH,
  FIRST_EVM_ADDRESS_PATH,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { getVendorProfile } from '@onekeyhq/shared/src/hardware/config/vendorProfile';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import type { IReferralCodeWalletInfo } from './types';

// ready: the wallet can be checked with the server.
// unsupported: this wallet can never take a referral code.
// unavailable: the wallet or its first account could not be read yet.
export type IReferralCodeWalletLookup =
  | { status: 'ready'; walletInfo: IReferralCodeWalletInfo }
  | { status: 'unsupported' }
  | { status: 'unavailable' };

function isReferralWalletId(walletId: string) {
  return (
    accountUtils.isHdWallet({ walletId }) ||
    accountUtils.isHwWallet({ walletId })
  );
}

// Hidden wallets and third-party hardware (Ledger, Trezor, Keystone)
// cannot take a code, matching the bind dialog. A missing vendor
// stays OneKey.
function cannotTakeReferralCode(wallet: IDBWallet) {
  return (
    accountUtils.isHwHiddenWallet({ wallet }) ||
    getVendorProfile(wallet.associatedDeviceInfo?.vendor).isThirdParty
  );
}

async function readReadyReferralWallet(
  walletId: string,
): Promise<IReferralCodeWalletLookup> {
  const wallet = await backgroundApiProxy.serviceAccount.getWallet({
    walletId,
  });
  if (cannotTakeReferralCode(wallet)) {
    return { status: 'unsupported' };
  }

  const isBtcOnlyWallet =
    await backgroundApiProxy.serviceHardware.isBtcOnlyWallet({ walletId });
  const networkId = isBtcOnlyWallet
    ? getNetworkIdsMap().btc
    : getNetworkIdsMap().eth;
  const accountPath = isBtcOnlyWallet
    ? FIRST_BTC_TAPROOT_ADDRESS_PATH
    : FIRST_EVM_ADDRESS_PATH;
  const accountId = `${walletId}--${accountPath}`;
  const account = await backgroundApiProxy.serviceAccount.getAccount({
    accountId,
    networkId,
  });
  if (!account) {
    return { status: 'unavailable' };
  }
  return {
    status: 'ready',
    walletInfo: {
      wallet,
      walletId,
      networkId,
      accountId,
      address: account.address,
      pubkey: account.pub,
      isBtcOnlyWallet,
    },
  };
}

// Callers that only need an address keep receiving null for both
// unsupported wallets and lookups that are not ready yet.
export async function lookupReferralCodeWallet(
  queryWalletId: string | undefined,
): Promise<IReferralCodeWalletLookup> {
  if (!queryWalletId) {
    return { status: 'unavailable' };
  }
  // QR, watch-only, imported and external wallets can never take a code.
  if (!isReferralWalletId(queryWalletId)) {
    return { status: 'unsupported' };
  }

  try {
    return await readReadyReferralWallet(queryWalletId);
  } catch {
    return { status: 'unavailable' };
  }
}

export function useGetReferralCodeWalletInfo() {
  return useCallback(async (queryWalletId: string | undefined) => {
    const lookup = await lookupReferralCodeWallet(queryWalletId);
    return lookup.status === 'ready' ? lookup.walletInfo : null;
  }, []);
}
