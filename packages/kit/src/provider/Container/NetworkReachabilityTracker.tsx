import { useEffect } from 'react';

import { getCurrentVisibilityState } from '@onekeyhq/components';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getEndpointsMapByDevSettings } from '@onekeyhq/shared/src/config/endpointsMap';
import { configure as configureNetInfo } from '@onekeyhq/shared/src/modules3rdParty/@react-native-community/netinfo';
import { getRequestHeaders } from '@onekeyhq/shared/src/request/Interceptor';

const checkNetInfo = async (devSettings: IDevSettingsPersistAtom) => {
  const endpoints = getEndpointsMapByDevSettings(devSettings);
  console.log(`${endpoints.wallet}/wallet/v1/health`);
  const headers = await getRequestHeaders();
  console.log('headers---', headers);
  configureNetInfo({
    reachabilityUrl: `${endpoints.wallet}/wallet/v1/health`,
    reachabilityMethod: 'GET',
    reachabilityHeaders: headers,
    reachabilityTest: async (response) => {
      console.log('---response.status === 200', response.status === 200);
      return response.status === 200;
    },
    reachabilityLongTimeout: 60 * 1000,
    reachabilityShortTimeout: 5 * 1000,
    reachabilityRequestTimeout: 10 * 1000,
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
