import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  ISettingCategoryOpenedSource,
  ISettingsAnalyticsLayout,
  ISettingsEntrySurface,
} from '@onekeyhq/shared/src/logger/scopes/setting';
import { ESettingsTabNames } from '@onekeyhq/shared/src/routes';

import type { ISubSettingConfig } from './config';

export const SETTINGS_SEARCH_LOG_IDLE_MS = 800;

export function getSettingsItemAnalyticsId(
  item: Pick<ISubSettingConfig, 'id' | 'settingRoute'>,
): string | null {
  return item.id ?? item.settingRoute ?? null;
}

export function getSettingsAnalyticsLayout({
  isTabNavigator,
  isMobileLayout,
}: {
  isTabNavigator: boolean;
  isMobileLayout: boolean;
}): ISettingsAnalyticsLayout {
  if (isMobileLayout) {
    return 'mobile';
  }
  if (isTabNavigator) {
    return 'sidebar';
  }
  return 'flat';
}

function shouldSkipSettingsAnalyticsCategory(
  category: ESettingsTabNames,
): boolean {
  return (
    category === ESettingsTabNames.Dev || category === ESettingsTabNames.Search
  );
}

export function logSettingCategoryOpened({
  category,
  source,
}: {
  category: ESettingsTabNames;
  source: ISettingCategoryOpenedSource;
}) {
  if (shouldSkipSettingsAnalyticsCategory(category)) {
    return;
  }
  defaultLogger.setting.page.settingCategoryOpened({ category, source });
}

export function logSettingItemClicked({
  item,
  category,
  source,
  searchQueryLength,
  searchResultIndex,
}: {
  item: Pick<ISubSettingConfig, 'id' | 'settingRoute'>;
  category: ESettingsTabNames;
  source: ISettingsEntrySurface;
  searchQueryLength?: number;
  searchResultIndex?: number;
}) {
  if (shouldSkipSettingsAnalyticsCategory(category)) {
    return;
  }
  const itemId = getSettingsItemAnalyticsId(item);
  if (!itemId) {
    return;
  }
  defaultLogger.setting.page.settingItemClicked({
    itemId,
    category,
    source,
    searchQueryLength,
    searchResultIndex,
  });
}

export function logSettingValueChanged({
  itemId,
  from,
  to,
}: {
  itemId: string;
  from: string;
  to: string;
}) {
  if (from === to) {
    return;
  }
  defaultLogger.setting.page.settingValueChanged({ itemId, from, to });
}

/**
 * In-place Select/Switch rows do not fire `settingItemClicked` while browsing
 * (opening a picker is not a leaf click). Search results are the exception:
 * tapping the row is a result click even when the control stays in-place.
 */
export function maybeLogSettingsSearchResultClick({
  source,
  logItemClick,
}: {
  source?: ISettingsEntrySurface;
  logItemClick?: () => void;
}) {
  if (source === 'search') {
    logItemClick?.();
  }
}
