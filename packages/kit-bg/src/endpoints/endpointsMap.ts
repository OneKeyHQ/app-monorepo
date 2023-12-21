import type { IEndpoint, IEndpointEnv } from '@onekeyhq/shared/types/endpoint';

// Only OneKey endpoints are allowed here.
const endpointsMap: Record<IEndpointEnv, IEndpoint> = {
  test: {
    http: 'https://rest.onekeytest.com',
    websocket: '',
  },
  prod: {
    // TODO: change to prod endpoint
    http: 'https://rest.onekeycn.com',
    websocket: '',
  },
};

export { endpointsMap };
