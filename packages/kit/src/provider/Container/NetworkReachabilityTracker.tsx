import { useEffect } from 'react';

import { getCurrentVisibilityState } from '@onekeyhq/components';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getEndpointsMapByDevSettings } from '@onekeyhq/shared/src/config/endpointsMap';
import { configure as configureNetInfo } from '@onekeyhq/shared/src/modules3rdParty/@react-native-community/netinfo';

const REACHABILITY_LONG_TIMEOUT = 60 * 1000;
const REACHABILITY_SHORT_TIMEOUT = 5 * 1000;
const REACHABILITY_REQUEST_TIMEOUT = 10 * 1000;

const checkNetInfo = async (devSettings: IDevSettingsPersistAtom) => {
  const endpoints = getEndpointsMapByDevSettings(devSettings);
  configureNetInfo({
    reachabilityUrl: `${endpoints.wallet}/wallet/v1/health`,
    reachabilityMethod: 'GET',
    reachabilityTest: async (response) => response.status === 200,
    reachabilityLongTimeout: REACHABILITY_LONG_TIMEOUT,
    reachabilityShortTimeout: REACHABILITY_SHORT_TIMEOUT,
    reachabilityRequestTimeout: REACHABILITY_REQUEST_TIMEOUT,
    reachabilityShouldRun: () => getCurrentVisibilityState(),
    // met iOS requirements to get SSID. Will leak memory if set to true without meeting requirements.
    shouldFetchWiFiSSID: false,
    useNativeReachability: false,
  });
};

const useNetInfo = () => {
  const [devSettings] = useDevSettingsPersistAtom();
  useEffect(() => {
    void checkNetInfo(devSettings);
  }, [devSettings]);
};

export function NetworkReachabilityTracker() {
  useNetInfo();
  return null;
}
