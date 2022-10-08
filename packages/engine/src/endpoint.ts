import { appSelector } from '@onekeyhq/kit/src/store';

const DEFAULT_ONLINE_ENDPOINT = 'https://fiat.onekeycn.com';
const DEFAULT_SOCKET_ENDPOINT = 'wss://fiat.onekeycn.com';

const TEST_ENDPOINT = 'https://fiat.onekeytest.com';
const TEST_SOCKET_ENDPOINT = 'wss://fiat.onekeytest.com';

const isTestEnable = () => {
  try {
    const enableTestFiatEndpoint =
      appSelector(
        (s) => s?.settings?.devMode?.enableTestFiatEndpoint ?? false,
      ) ?? false;

    return enableTestFiatEndpoint;
  } catch (error) {
    // pass
  }
  return false;
};

export const getFiatEndpoint = () =>
  isTestEnable() ? TEST_ENDPOINT : DEFAULT_ONLINE_ENDPOINT;
export const getSocketEndpoint = () =>
  isTestEnable() ? TEST_SOCKET_ENDPOINT : DEFAULT_SOCKET_ENDPOINT;
