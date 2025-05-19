import { useEffect, useMemo } from 'react';

import { configureNetInfo, refreshNetInfo } from '@onekeyhq/components';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ONEKEY_HEALTH_CHECK_URL } from '@onekeyhq/shared/src/config/appConfig';
import { getEndpointsMapByDevSettings } from '@onekeyhq/shared/src/config/endpointsMap';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

const REACHABILITY_LONG_TIMEOUT = 60 * 1000;
const REACHABILITY_SHORT_TIMEOUT = 5 * 1000;
const REACHABILITY_REQUEST_TIMEOUT = 10 * 1000;

const checkNetInfo = async (endpoint: string) => {
  configureNetInfo({
    reachabilityUrl: `${endpoint}${ONEKEY_HEALTH_CHECK_URL}`,
    reachabilityLongTimeout: REACHABILITY_LONG_TIMEOUT,
    reachabilityShortTimeout: REACHABILITY_SHORT_TIMEOUT,
    reachabilityRequestTimeout: REACHABILITY_REQUEST_TIMEOUT,
  });
};

const useNetInfo = () => {
  const [devSettings] = useDevSettingsPersistAtom();
  const walletEndpoints = useMemo(
    () => getEndpointsMapByDevSettings(devSettings).wallet,
    [devSettings],
  );
  useEffect(() => {
    void checkNetInfo(walletEndpoints);
    const callback = () => {
      refreshNetInfo();
    };
    appEventBus.on(EAppEventBusNames.RefreshNetInfo, callback);
    return () => {
      appEventBus.off(EAppEventBusNames.RefreshNetInfo, callback);
    };
  }, [walletEndpoints]);
};

export function NetworkReachabilityTracker() {
  useNetInfo();
  return null;
}
