import type { IEndpoint, IEndpointEnv } from '@onekeyhq/shared/types/endpoint';

// Only OneKey endpoints are allowed here.
const endpointsMap: Record<IEndpointEnv, IEndpoint> = {
  test: {
    http: 'https://rest.onekeytest.com',
    // http: 'http://192.168.5.152:7001',
    // http: ' http://10.44.22.95:7001',

    websocket: '',
  },
  prod: {
    // TODO: change to prod endpoint
    http: 'https://rest.onekeytest.com',
    // http: 'http://192.168.5.152:7001',
    // http: ' http://10.44.22.95:7001',
    websocket: '',
  },
};

export { endpointsMap };
