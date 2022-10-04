// const DEFAULT_ONLINE_ENDPOINT = 'https://fiat.onekeycn.com';
const DEFAULT_ONLINE_ENDPOINT = 'http://192.168.5.128:9000';
// const DEFAULT_ONLINE_ENDPOINT = 'http://192.168.31.157:9000';
const TEST_ENDPOINT = 'https://fiat.onekeytest.com';

let endpoint = DEFAULT_ONLINE_ENDPOINT;

export const switchTestEndpoint = (isTestEnable?: boolean) => {
  endpoint = isTestEnable ? TEST_ENDPOINT : DEFAULT_ONLINE_ENDPOINT;
};

export const getFiatEndpoint = () => endpoint;
