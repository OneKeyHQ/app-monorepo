import { useEffect, useMemo } from 'react';

import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';

import { resolveReferralPageTab } from './referralPageTab';

import type { IReferralPageTab } from './referralPageTab';

// Desktop reads and writes sync storage over blocking IPC, so the stored tab
// is read once per JS runtime and cached here.
let cachedLastTab: string | undefined;
let hasReadLastTab = false;

// Read back through resolveReferralPageTab, so an unknown value falls back to
// the invite tab.
function readLastReferralPageTab(): string | undefined {
  if (!hasReadLastTab) {
    hasReadLastTab = true;
    try {
      cachedLastTab = appStorage.syncStorage.getString(
        EAppSyncStorageKeys.onekey_referral_last_page_tab,
      );
    } catch {
      cachedLastTab = undefined;
    }
  }
  return cachedLastTab;
}

async function saveLastReferralPageTab(tab: IReferralPageTab) {
  if (readLastReferralPageTab() === tab) {
    return;
  }
  cachedLastTab = tab;
  try {
    await appStorage.syncStorage.set(
      EAppSyncStorageKeys.onekey_referral_last_page_tab,
      tab,
    );
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
    void saveLastReferralPageTab(activeTab);
  }, [activeTab]);
  return activeTab;
}

// Test-only: forget the cached tab so each test reads storage afresh.
export function resetReferralPageTabCacheForTest() {
  cachedLastTab = undefined;
  hasReadLastTab = false;
}
