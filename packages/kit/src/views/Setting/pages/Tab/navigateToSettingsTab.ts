import { rootNavigationRef } from '@onekeyhq/components';
import type { ESettingsTabNames } from '@onekeyhq/shared/src/routes';
import {
  EModalRoutes,
  EModalSettingRoutes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';

function isSettingsModalActive() {
  const rootState = rootNavigationRef.current?.getRootState();
  const activeRootRoute = rootState?.routes?.[rootState.index ?? 0];
  if (activeRootRoute?.name !== ERootRoutes.Modal) {
    return false;
  }

  const activeModalRoute = activeRootRoute.state?.routes?.[
    activeRootRoute.state.index ?? 0
  ] as { name?: string } | undefined;
  const routeParams = activeRootRoute.params as { screen?: string } | undefined;
  const activeModalName = activeModalRoute?.name ?? routeParams?.screen;
  return activeModalName === EModalRoutes.SettingModal;
}

/**
 * Select a settings tab inside the already-open settings modal. Only valid on
 * tab-navigator layouts while the settings modal is mounted (same mechanism as
 * the Search-tab navigation in useSearch).
 */
export function navigateToSettingsTabInModal(tabName: ESettingsTabNames) {
  rootNavigationRef.current?.navigate(EModalSettingRoutes.SettingListModal, {
    screen: tabName,
  });
}

/**
 * Reuse an already-open Settings modal instead of asking pushModal to open the
 * same outer route again. pushModal intentionally deduplicates by modal/screen
 * and cannot use the deeper tab parameter to switch this nested navigator.
 */
export function tryNavigateToSettingsTabInModal(tabName: ESettingsTabNames) {
  if (!isSettingsModalActive()) {
    return false;
  }
  navigateToSettingsTabInModal(tabName);
  return true;
}
