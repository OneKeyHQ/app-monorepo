import { toBigIntHex } from '@onekeyfe/blockchain-libs/dist/basic/bignumber-plus';
import { toLower } from 'lodash';

import { IMPL_EVM } from './constants';
import {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
  WALLET_TYPE_WATCHING,
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

export { toBigIntHex };
