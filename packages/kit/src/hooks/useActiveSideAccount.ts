import { useMemo } from 'react';

import { getWalletIdFromAccountId } from '@onekeyhq/engine/src/managers/account';
import { getNetworkImpl } from '@onekeyhq/engine/src/managers/network';

import { useAccount } from './useAccount';
import { useNetwork } from './useNetwork';
import { useWallet } from './useWallet';

export function useActiveSideAccount({
  accountId,
  networkId,
}: {
  accountId: string;
  networkId: string;
}) {
  // TODO empty account allowed?
  if (!accountId) {
    throw new Error('useActiveSideAccount ERROR: `accountId` is empty');
  }
  if (!networkId) {
    throw new Error('useActiveSideAccount ERROR: `networkId` is empty');
  }
  const walletId = useMemo(
    () => getWalletIdFromAccountId(accountId) || '',
    [accountId],
  );
  const networkImpl = useMemo(
    () => getNetworkImpl(networkId) || '',
    [networkId],
  );
  const { network } = useNetwork({ networkId });
  const { account } = useAccount({
    accountId,
    networkId,
  });
  const { wallet } = useWallet({ walletId });
  const accountAddress = useMemo(
    () => account?.address || '',
    [account?.address],
  );
  return {
    accountId,
    networkId,
    walletId,
    network,
    account,
    wallet,
    networkImpl,
    accountAddress,
  };
}
