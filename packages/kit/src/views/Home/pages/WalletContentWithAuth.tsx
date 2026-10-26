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
  // Background reads never request Lightning service authorization implicitly.
  if (
    networkUtils.isLightningNetworkByNetworkId(networkId) &&
    (accountUtils.isHwAccount({ accountId }) ||
      accountUtils.isHdAccount({ accountId }))
  ) {
    return (
      <LNHardwareWalletAuth
        key={`${networkId}:${accountId}`}
        networkId={networkId}
        accountId={accountId}
      >
        {children}
      </LNHardwareWalletAuth>
    );
  }

  return children;
}

export default WalletContentWithAuth;
