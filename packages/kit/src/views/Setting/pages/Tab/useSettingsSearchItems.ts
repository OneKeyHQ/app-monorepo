import { useMemo } from 'react';

import { useSettingsConfig } from './config';
import { flattenSettingsSearchItems } from './settingsSearchItems';
import { useSettingsLayout } from './useIsTabNavigator';

import type { IFlatSettingsSearchItem } from './settingsSearchItems';

export { flattenSettingsSearchItems } from './settingsSearchItems';
export type { IFlatSettingsSearchItem } from './settingsSearchItems';

/**
 * Settings items flattened for search, each carrying its category's display
 * grouping (resolved through `getSettingsDisplayTitle`/`Icon`, so grouping
 * follows the same naming rule as the sidebar and pane headers). Shared by
 * the settings pane search and universal search so the two pipelines cannot
 * drift. Callers that already hold a `useSettingsConfig` instance should use
 * the pure function to avoid mounting a second config hook.
 */
export function useFlatSettingsSearchItems(): IFlatSettingsSearchItem[] {
  const settingsConfig = useSettingsConfig();
  const { preferMobileNaming } = useSettingsLayout();
  return useMemo(
    () => flattenSettingsSearchItems(settingsConfig, preferMobileNaming),
    [preferMobileNaming, settingsConfig],
  );
}
