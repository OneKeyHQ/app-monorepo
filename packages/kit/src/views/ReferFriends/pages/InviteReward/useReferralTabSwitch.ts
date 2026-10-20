import { useCallback } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { EReferralPageTab, type IReferralPageTab } from './referralPageTab';

// Switching between the invite and Perks tabs, shared by the signed-in page
// and the intro: logs where the switch came from, then updates the route.
export function useReferralTabSwitch(activeTab: IReferralPageTab) {
  const navigation = useAppNavigation();
  const switchTab = useCallback(
    (tab: IReferralPageTab, source: 'tabs' | 'cross_link') => {
      if (tab === activeTab) {
        return;
      }
      defaultLogger.referral.page.referralTabSwitched({
        from: activeTab,
        to: tab,
        source,
      });
      navigation.setParams({ tab });
    },
    [activeTab, navigation],
  );
  const setActiveTab = useCallback(
    (tab: IReferralPageTab) => switchTab(tab, 'tabs'),
    [switchTab],
  );
  const openPerks = useCallback(
    () => switchTab(EReferralPageTab.benefits, 'cross_link'),
    [switchTab],
  );
  const openInvite = useCallback(
    () => switchTab(EReferralPageTab.invite, 'cross_link'),
    [switchTab],
  );
  return { setActiveTab, openPerks, openInvite };
}
