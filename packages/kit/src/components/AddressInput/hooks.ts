import { useMemo } from 'react';

import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

export const useIsEnableTransferAllowList = () => {
  const [settings] = useSettingsPersistAtom();
  const isEnableTransferAllowList = useMemo(
    () => settings.transferAllowList ?? false,
    [settings.transferAllowList],
  );
  return isEnableTransferAllowList;
};
