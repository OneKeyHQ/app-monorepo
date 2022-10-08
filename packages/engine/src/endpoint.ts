const DEFAULT_ONLINE_ENDPOINT = 'https://fiat.onekeycn.com';
const TEST_ENDPOINT = 'https://fiat.onekeytest.com';

let endpoint = DEFAULT_ONLINE_ENDPOINT;

export const switchTestEndpoint = (isTestEnable?: boolean) => {
  endpoint = isTestEnable ? TEST_ENDPOINT : DEFAULT_ONLINE_ENDPOINT;
};

export const getFiatEndpoint = () => endpoint;
