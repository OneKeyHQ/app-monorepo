// safe import
import { toLower } from 'lodash';

import type { WalletSchema } from '@onekeyhq/engine/src/dbs/realms/schemas';
import {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/engine/src/types/wallet';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';
import { addDisplayPassphraseWallet } from '@onekeyhq/kit/src/store/reducers/runtime';
import { toBigIntHex } from '@onekeyhq/shared/src/utils/numberUtils';

import { IMPL_EVM } from './engineConsts';

export function fixAddressCase({
  impl,
  address,
}: {
  impl: string;
  address: string;
}) {
  if (IMPL_EVM === impl) {
    return toLower(address);
  }
  return address;
}

export function isWatchingAccount({ accountId }: { accountId: string }) {
  return !!(accountId && accountId.startsWith(`${WALLET_TYPE_WATCHING}-`));
}

export function isExternalAccount({ accountId }: { accountId: string }) {
  return !!(accountId && accountId.startsWith(`${WALLET_TYPE_EXTERNAL}-`));
}

// walletIsHD
export function isHdWallet({ walletId }: { walletId: string }) {
  return !!(walletId && walletId.startsWith(`${WALLET_TYPE_HD}-`));
}

// walletIsHW
export function isHardwareWallet({ walletId }: { walletId: string }) {
  return !!(walletId && walletId.startsWith(`${WALLET_TYPE_HW}-`));
}

// walletIsImported
export function isImportedWallet({ walletId }: { walletId: string }) {
  return !!(walletId && walletId.startsWith(`${WALLET_TYPE_IMPORTED}`));
}

export function isExternalWallet({ walletId }: { walletId: string }) {
  return !!(walletId && walletId === WALLET_TYPE_EXTERNAL);
}

export function isPassphraseWallet(wallet: Wallet | WalletSchema) {
  return !!wallet.passphraseState;
}

export const filterPassphraseWallet = (
  wallet: Wallet | WalletSchema,
  includeAllPassphraseWallet?: boolean,
  displayPassphraseWalletIds?: string[],
): boolean => {
  if (!isPassphraseWallet(wallet)) return true;
  if (includeAllPassphraseWallet) return true;

  return displayPassphraseWalletIds?.includes(wallet.id) ?? false;
};

export function handleDisplayPassphraseWallet(walletId: string) {
  if (!global.$backgroundApiProxy) {
    throw new Error(
      '[engine] and [shared] is not allowed calling [kit-bg]. Please pass a callback to dbApi.addHWWallet()',
    );
  }
  const { dispatch } = global.$backgroundApiProxy;
  dispatch(addDisplayPassphraseWallet(walletId));
}

export { toBigIntHex };
