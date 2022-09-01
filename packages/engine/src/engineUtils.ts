import { toBigIntHex } from '@onekeyfe/blockchain-libs/dist/basic/bignumber-plus';
import { toLower } from 'lodash';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import store from '@onekeyhq/kit/src/store';
import { addDisplayPassphraseWallet } from '@onekeyhq/kit/src/store/reducers/runtime';

import { IMPL_EVM } from './constants';
import { WalletSchema } from './dbs/realms/schemas';
import {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
  WALLET_TYPE_WATCHING,
  Wallet,
} from './types/wallet';

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

export function isExternalWallet({ walletId }: { walletId: string }) {
  return !!(walletId && walletId === WALLET_TYPE_EXTERNAL);
}

export function isPassphraseWallet(wallet: Wallet | WalletSchema) {
  return !!wallet.passphraseState;
}

export const filterPassphraseWallet = (wallet: Wallet | WalletSchema) => {
  if (!isPassphraseWallet(wallet)) return true;

  return store
    .getState()
    .runtime.displayPassphraseWalletIdList.includes(wallet.id);
};

export function handleDisplayPassphraseWallet(walletId: string) {
  const { dispatch } = backgroundApiProxy;
  dispatch(addDisplayPassphraseWallet(walletId));
}

export { toBigIntHex };
