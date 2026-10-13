import { useCallback } from 'react';

import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

export type IBinanceDepositSender = {
  // The network this account and address were resolved on.
  networkId: string;
  accountId: string;
  address: string;
  walletId?: string;
  indexedAccountId?: string;
};

function toSender({
  networkAccount,
  networkId,
  walletId,
}: {
  networkAccount: INetworkAccount | undefined;
  networkId: string;
  walletId: string | undefined;
}): IBinanceDepositSender | undefined {
  if (!networkAccount?.id || !networkAccount.address) {
    return undefined;
  }
  return {
    networkId,
    accountId: networkAccount.id,
    address: networkAccount.address,
    walletId,
    indexedAccountId: networkAccount.indexedAccountId,
  };
}

// The account of the wallet selected on Home, resolved on the deposit
// network (which may differ from the network Home is showing).
export function useBinanceDepositSender({ networkId }: { networkId?: string }) {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const walletId = activeAccount.wallet?.id;
  const activeAccountId = activeAccount.account?.id;
  const indexedAccountId = activeAccount.indexedAccount?.id;
  const accountName = activeAccount.accountName;
  // A watch-only account cannot sign the deposit transfer.
  const isWatchingAccount = accountUtils.isWatchingWallet({ walletId });

  const {
    result: resolvedSender,
    isLoading,
    run: reloadSender,
  } = usePromiseResult(
    async (): Promise<IBinanceDepositSender | undefined> => {
      if (!networkId || isWatchingAccount) {
        return undefined;
      }
      if (!indexedAccountId && !activeAccountId) {
        return undefined;
      }
      try {
        const deriveType =
          await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
            networkId,
          });
        const networkAccount =
          await backgroundApiProxy.serviceAccount.getNetworkAccount({
            accountId: indexedAccountId ? undefined : activeAccountId,
            indexedAccountId,
            deriveType,
            networkId,
          });
        return toSender({ networkAccount, networkId, walletId });
      } catch {
        // No address on this network yet, or an account of another chain
        // family.
        return undefined;
      }
    },
    [activeAccountId, indexedAccountId, isWatchingAccount, networkId, walletId],
    { watchLoading: true },
  );
  // The previous result stays in place while a new one loads; an address
  // resolved for another network must never be offered for this one.
  const sender =
    resolvedSender && resolvedSender.networkId === networkId
      ? resolvedSender
      : undefined;

  // Same flow the rest of the app uses to add a missing network address; it
  // raises its own dialogs and returns nothing when no address was created.
  const createSenderAddress = useCallback(async (): Promise<
    IBinanceDepositSender | undefined
  > => {
    if (!networkId || !walletId || (!indexedAccountId && !activeAccountId)) {
      return undefined;
    }
    try {
      const networkAccount =
        await backgroundApiProxy.serviceAccount.createAddressIfNotExists(
          {
            walletId,
            networkId,
            accountId: activeAccountId,
            indexedAccountId,
          },
          { allowWatchAccount: false },
        );
      await reloadSender();
      return toSender({ networkAccount, networkId, walletId });
    } catch {
      return undefined;
    }
  }, [activeAccountId, indexedAccountId, networkId, reloadSender, walletId]);

  return {
    sender,
    isLoading: Boolean(isLoading),
    isWatchingAccount,
    accountName,
    createSenderAddress,
  };
}
