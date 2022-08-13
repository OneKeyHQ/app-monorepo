import { appSelector } from '@onekeyhq/kit/src/store';

export const getFiatEndpoint = () => {
  const enableTestFiatEndpoint = appSelector(
    (s) => s?.settings?.devMode?.enableTestFiatEndpoint ?? false,
  );

  return enableTestFiatEndpoint
    ? 'https://fiat.onekeytest.com'
    : 'https://fiat.onekeycn.com';
};
