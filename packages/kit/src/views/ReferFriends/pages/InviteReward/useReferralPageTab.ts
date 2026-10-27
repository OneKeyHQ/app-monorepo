import { useEffect, useMemo } from 'react';

import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';

import { resolveReferralPageTab } from './referralPageTab';

import type { IReferralPageTab } from './referralPageTab';

// Read back through resolveReferralPageTab, so an unknown value falls back to
// the invite tab.
function readLastReferralPageTab(): string | undefined {
  try {
    return appStorage.syncStorage.getString(
      EAppSyncStorageKeys.onekey_referral_last_page_tab,
    );
  } catch {
    return undefined;
  }
}

function saveLastReferralPageTab(tab: IReferralPageTab) {
  try {
    void Promise.resolve(
      appStorage.syncStorage.set(
        EAppSyncStorageKeys.onekey_referral_last_page_tab,
        tab,
      ),
    ).catch(() => undefined);
  } catch {
    // The page still works without the remembered tab.
  }
}

// A tab in the route means the caller asked for it. Without one, the page
// reopens the tab the user last left, so someone who checks Perks lands
// there again without an extra tap.
export function useReferralPageTab(routeTab?: string | null): IReferralPageTab {
  // Re-read whenever the route's tab changes, since a mounted page can be
  // re-entered with its tab param cleared.
  const lastTab = useMemo(
    () => (routeTab ? undefined : readLastReferralPageTab()),
    [routeTab],
  );
  const activeTab = resolveReferralPageTab(routeTab ?? lastTab);
  useEffect(() => {
    saveLastReferralPageTab(activeTab);
  }, [activeTab]);
  return activeTab;
}
