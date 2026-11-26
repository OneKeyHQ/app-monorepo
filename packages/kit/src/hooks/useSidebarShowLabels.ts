import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ISettingValueChangedParams } from '@onekeyhq/shared/src/logger/scopes/setting';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { logSettingValueChanged } from '../views/Setting/pages/Tab/settingsAnalytics';

export function useSidebarShowLabels() {
  const [{ sidebarShowLabels }] = useSettingsPersistAtom();
  return sidebarShowLabels !== false;
}

export function setSidebarShowLabels(
  showLabels: boolean,
  entry: NonNullable<ISettingValueChangedParams['entry']>,
) {
  logSettingValueChanged({
    itemId: 'sidebar-labels',
    from: String(!showLabels),
    to: String(showLabels),
    entry,
  });
  return backgroundApiProxy.serviceSetting.setSidebarShowLabels(showLabels);
}
