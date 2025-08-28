import { useMemo } from 'react';

import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';

export function useMarketV2Enabled(): boolean {
  const [devSettings] = useDevSettingsPersistAtom();

  return useMemo(
    () =>
      devSettings.enabled && (devSettings.settings?.enableMarketV2 ?? false),
    [devSettings.enabled, devSettings.settings?.enableMarketV2],
  );
}
