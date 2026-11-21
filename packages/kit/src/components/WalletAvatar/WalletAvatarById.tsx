import type { SizeTokens } from '@onekeyhq/components';

import { useWalletMetadataPresentation } from '../../hooks/useWalletMetadataPresentation';

import { WalletAvatar } from './WalletAvatar';

function WalletAvatarById({
  walletId,
  size,
}: {
  walletId: string;
  size?: SizeTokens;
}) {
  const wallet = useWalletMetadataPresentation(walletId);

  if (!wallet) return null;

  return <WalletAvatar wallet={wallet} size={size} />;
}

export { WalletAvatarById };
