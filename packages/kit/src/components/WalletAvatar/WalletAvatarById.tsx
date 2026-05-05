import type { SizeTokens } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../hooks/usePromiseResult';

import { WalletAvatar } from './WalletAvatar';

function WalletAvatarById({
  walletId,
  size,
}: {
  walletId: string;
  size?: SizeTokens;
}) {
  const { result: wallet } = usePromiseResult(
    async () => {
      if (!walletId) return undefined;
      return backgroundApiProxy.serviceAccount.getWallet({ walletId });
    },
    [walletId],
    { initResult: undefined },
  );

  if (!wallet) return null;

  return <WalletAvatar wallet={wallet} size={size} />;
}

export { WalletAvatarById };
