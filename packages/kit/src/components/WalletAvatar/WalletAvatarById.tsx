import { useEffect } from 'react';

import type { SizeTokens } from '@onekeyhq/components';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../hooks/usePromiseResult';

import { WalletAvatar } from './WalletAvatar';

export function useWalletAvatarRecord(walletId: string) {
  const { result, run } = usePromiseResult(
    async () => {
      if (!walletId) return undefined;
      return backgroundApiProxy.serviceAccount.getWalletSafe({ walletId });
    },
    [walletId],
    { initResult: undefined, revalidateOnFocus: true },
  );
  useEffect(() => {
    if (!walletId) return;
    appEventBus.on(EAppEventBusNames.WalletUpdate, run);
    return () => {
      appEventBus.off(EAppEventBusNames.WalletUpdate, run);
    };
  }, [walletId, run]);
  return result?.id === walletId ? result : undefined;
}

function WalletAvatarById({
  walletId,
  size,
}: {
  walletId: string;
  size?: SizeTokens;
}) {
  const wallet = useWalletAvatarRecord(walletId);

  if (!wallet) return null;

  return <WalletAvatar wallet={wallet} size={size} />;
}

export { WalletAvatarById };
