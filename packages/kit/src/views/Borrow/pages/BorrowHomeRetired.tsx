import { useEffect } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';

import { EarnNavigation } from '../../Earn/earnUtils';

/**
 * On web the market's own page is retired (demo 11-10): loans start in the
 * Loans window, a position is managed on its card in My portfolio, and a
 * reserve's page is reached from the window. The page's address, from a
 * bookmark or an old link, lands on the DeFi home with its Loans tab open
 */
export default function BorrowHomeRetired() {
  const navigation = useAppNavigation();
  useEffect(() => {
    void EarnNavigation.popToEarnHome(navigation, { mode: 'borrow' });
  }, [navigation]);
  return null;
}
