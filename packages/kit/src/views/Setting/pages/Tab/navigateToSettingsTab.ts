import { rootNavigationRef } from '@onekeyhq/components';
import type { ESettingsTabNames } from '@onekeyhq/shared/src/routes';
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes';

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
