const DEFAULT_ONLINE_ENDPOINT = 'http://192.168.6.138:9000';
const TEST_ENDPOINT = 'https://fiat.onekeytest.com';

const DEFAULT_SOCKET_ENDPOINT = 'ws://192.168.6.138:9000';
const TEST_SOCKET_ENDPOINT = 'wss://fiat.onekeytest.com';

let endpoint = DEFAULT_ONLINE_ENDPOINT;
let websocketEndpoint = DEFAULT_SOCKET_ENDPOINT;

export const switchTestEndpoint = (isTestEnable?: boolean) => {
  endpoint = isTestEnable ? TEST_ENDPOINT : DEFAULT_ONLINE_ENDPOINT;
  websocketEndpoint = isTestEnable
    ? TEST_SOCKET_ENDPOINT
    : DEFAULT_SOCKET_ENDPOINT;
};

export const getFiatEndpoint = () => endpoint;
export const getSocketEndpoint = () => websocketEndpoint;
