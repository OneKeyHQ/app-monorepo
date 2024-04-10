import {
  ONEKY_API_URL,
  ONEKY_TEST_API_URL,
} from '@onekeyhq/shared/src/config/appConfig';
import type { IEndpoint, IEndpointEnv } from '@onekeyhq/shared/types/endpoint';

// Only OneKey endpoints are allowed here.
const endpointsMap: Record<IEndpointEnv, IEndpoint> = {
  test: {
    http: ONEKY_API_URL,
    websocket: '',
  },
  prod: {
    // TODO: change to prod endpoint
    http: ONEKY_TEST_API_URL,
    websocket: '',
  },
};

export { endpointsMap };
