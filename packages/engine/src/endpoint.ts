import { appSelector } from '@onekeyhq/kit/src/store';

export const getFiatEndpoint = () => {
  const { enableTestFiatEndpoint } = appSelector((s) => s.settings.devMode);

  return enableTestFiatEndpoint
    ? 'https://fiat.onekeytest.com'
    : 'https://fiat.onekeycn.com';
};
