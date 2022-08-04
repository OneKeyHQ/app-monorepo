import store from '@onekeyhq/kit/src/store';

export const getFiatEndpoint = () => {
  const { enableTestFiatEndpoint: useTestFiatEndpoint } =
    store.getState()?.settings?.devMode;
  return useTestFiatEndpoint
    ? 'https://fiat.onekeytest.com'
    : 'https://fiat.onekeycn.com';
};
