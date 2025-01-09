import type { PropsWithChildren } from 'react';

import LNHardwareWalletAuth from '@onekeyhq/kit/src/views/LightningNetwork/components/LNHardwareWalletAuth';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

function WalletContentWithAuth({
  networkId,
  accountId,
  children,
}: PropsWithChildren<{
  networkId: string;
  accountId: string;
}>) {
  // Process only hardware accounts for the Lightning Network
  if (
    networkUtils.isLightningNetworkByNetworkId(networkId) &&
    accountUtils.isHwAccount({ accountId })
  ) {
    return (
      <LNHardwareWalletAuth networkId={networkId} accountId={accountId}>
        {children}
      </LNHardwareWalletAuth>
    );
  }

  return children;
}

export default WalletContentWithAuth;
