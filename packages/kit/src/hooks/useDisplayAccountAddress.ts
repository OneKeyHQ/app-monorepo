import { useMemo } from 'react';

import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

export function useDisplayAccountAddress({
  networkId,
}: {
  networkId: string | undefined;
}) {
  const [{ enableBTCFreshAddress }] = useSettingsPersistAtom();
  const hideAccountAddress = useMemo(() => {
    if (networkUtils.isBTCNetwork(networkId ?? '')) {
      return enableBTCFreshAddress ?? false;
    }
    return false;
  }, [enableBTCFreshAddress, networkId]);

  const displayAccountAddress = useMemo(
    () => !hideAccountAddress,
    [hideAccountAddress],
  );

  return {
    displayAccountAddress,
    hideAccountAddress,
  };
}
