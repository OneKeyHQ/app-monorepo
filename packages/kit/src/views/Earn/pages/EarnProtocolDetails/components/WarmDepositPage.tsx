import { useEffect, useMemo } from 'react';

import { useEarnDesktopWalletHoldings } from '../../../components/desktopHome/useEarnDesktopHomeData';
import { useEarnRouterOffers } from '../../EarnRouter/EarnRouterOffer';
import { useWarmDepositForm } from '../../EarnRouter/useWarmOffersDeposit';

/**
 * On a narrow screen the details page's Deposit button opens the deposit
 * page. Its data, its rows before an amount, the token's protocols on the
 * network and the wallet's tokens for Pay with are read while the details
 * show, so it opens complete
 */
export function WarmDepositPage({
  networkId,
  symbol,
  providerName,
  vault,
}: {
  networkId: string;
  symbol: string;
  providerName: string;
  vault?: string;
}) {
  const warm = useWarmDepositForm();
  const refreshNetworkIds = useMemo(() => [networkId], [networkId]);
  useEarnDesktopWalletHoldings({ isActive: true, refreshNetworkIds });
  useEarnRouterOffers({ symbol, networkId });
  useEffect(() => {
    warm({ networkId, symbol, providerName, vault });
  }, [networkId, providerName, symbol, vault, warm]);
  return null;
}
