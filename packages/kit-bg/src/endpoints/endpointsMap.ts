import type { IEndpoint, IEndpointEnv } from '@onekeyhq/shared/types/endpoint';

// Only OneKey endpoints are allowed here.
const endpointsMap: Record<IEndpointEnv, IEndpoint> = {
  test: {
    http: 'http://18.138.227.191:9008',
    websocket: '',
  },
  prod: {
    // TODO: change to prod endpoint
    http: 'http://18.138.227.191:9008',
    websocket: '',
  },
};

export { endpointsMap };
