import {
  DEFAULT_BROWSER_HOME_MODULES,
  type IBrowserHomeModuleConfig,
  type IBrowserHomeModuleId,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IntlShape } from 'react-intl';

const DEFAULT_BROWSER_HOME_MODULE_IDS = new Set<IBrowserHomeModuleId>(
  DEFAULT_BROWSER_HOME_MODULES.map((module) => module.id),
);

type ILegacyBrowserHomeModuleConfig = {
  id: IBrowserHomeModuleId | 'recents';
  visible: boolean;
};

function normalizeBrowserHomeModuleId(
  moduleId: ILegacyBrowserHomeModuleConfig['id'],
) {
  if (moduleId === 'recents') {
    return 'openTabs';
  }
  if (DEFAULT_BROWSER_HOME_MODULE_IDS.has(moduleId)) {
    return moduleId;
  }
  return undefined;
}

export function normalizeBrowserHomeModules(
  modules?: ILegacyBrowserHomeModuleConfig[],
): IBrowserHomeModuleConfig[] {
  const usedIds = new Set<IBrowserHomeModuleId>();
  const normalized: IBrowserHomeModuleConfig[] = [];

  modules?.forEach((module) => {
    const normalizedId = normalizeBrowserHomeModuleId(module.id);
    if (!normalizedId || usedIds.has(normalizedId)) {
      return;
    }

    normalized.push({
      id: normalizedId,
      visible: module.visible !== false,
    });
    usedIds.add(normalizedId);
  });

  DEFAULT_BROWSER_HOME_MODULES.forEach((module) => {
    if (!usedIds.has(module.id)) {
      normalized.push({ ...module });
    }
  });

  return normalized;
}

export function getBrowserHomeModuleLabel(
  intl: IntlShape,
  moduleId: IBrowserHomeModuleId,
) {
  switch (moduleId) {
    case 'openTabs':
      return intl.formatMessage({ id: ETranslations.global_current });
    case 'bookmarks':
      return intl.formatMessage({ id: ETranslations.explore_bookmarks });
    case 'trending':
      return intl.formatMessage({ id: ETranslations.market_trending });
    case 'recentlyClosed':
      return intl.formatMessage({ id: ETranslations.browser_recently_closed });
    default:
      return '';
  }
}
