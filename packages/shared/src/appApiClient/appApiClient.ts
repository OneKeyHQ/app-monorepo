import axios from 'axios';

import { OneKeyError } from '../errors';
import platformEnv from '../platformEnv';
import { createIpTableAdapter } from '../request/helpers/ipTableAdapter';
import { REQUEST_TIMEOUT } from '../request/requestConst';
import { createRuntimeNetworkAdapter } from '../travelMode/runtimeNetworkAdapter';
import { isSupportIpTablePlatform } from '../utils/ipTableUtils';

import type { IEndpointInfo } from '../../types/endpoint';
import type { AxiosInstance, AxiosResponse } from 'axios';

const getBasicClient = async (
  { endpoint, name, autoHandleError = true }: IEndpointInfo,
  useDevProxy = true,
) => {
  if (!endpoint || !name) {
    throw new OneKeyError('Invalid endpoint name.');
  }
  // Dev builds may target a local mock server (custom API endpoint setting).
  const isLocalDevEndpoint =
    platformEnv.isDev &&
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(endpoint);
  if (!endpoint.startsWith('https://') && !isLocalDevEndpoint) {
    throw new OneKeyError('Invalid endpoint, https only');
  }

  const timeout = REQUEST_TIMEOUT;

  // Create IP Table adapter
  // Note: We pass the base config to the adapter so it can create
  // a fallback axios instance with the same configuration
  const baseConfig =
    useDevProxy && platformEnv.isDev && process.env.ONEKEY_PROXY
      ? {
          baseURL: platformEnv.isExtension ? 'http://localhost:3180' : '/',
          timeout,
          headers: {
            'X-OneKey-Dev-Proxy': endpoint,
          },
        }
      : {
          baseURL: endpoint,
          timeout,
        };

  const ipTableAdapter = isSupportIpTablePlatform()
    ? createIpTableAdapter(baseConfig)
    : undefined;

  const transportAdapter = createRuntimeNetworkAdapter(
    ipTableAdapter ?? axios.getAdapter(axios.defaults.adapter),
  );

  const options = {
    ...baseConfig,
    autoHandleError,
    adapter: transportAdapter,
  };

  const client = axios.create(options);
  return client;
};

function createClientCache(useDevProxy = true) {
  const clients = new Map<
    IEndpointInfo['name'],
    {
      endpoint: string;
      autoHandleError: boolean | undefined;
      pending: Promise<AxiosInstance>;
    }
  >();
  return {
    get: (params: IEndpointInfo) => {
      const { name, endpoint, autoHandleError } = params;
      const current = clients.get(name);
      if (
        current?.endpoint === endpoint &&
        current.autoHandleError === autoHandleError
      )
        return current.pending;
      const pending = getBasicClient(params, useDevProxy).catch(
        (error: unknown) => {
          if (clients.get(name)?.pending === pending) clients.delete(name);
          throw error;
        },
      );
      clients.set(name, { endpoint, autoHandleError, pending });
      return pending;
    },
    clear: () => clients.clear(),
  };
}

const clients = createClientCache();
const officialClients = createClientCache(false);
const oneKeyIdAuthClients = createClientCache();
const rawDataClients = createClientCache();
const getClient = clients.get;
const getOneKeyIdAuthClient = oneKeyIdAuthClients.get;
const getRawDataClient = (params: IEndpointInfo) =>
  rawDataClients.get({ ...params, autoHandleError: false });

const clearClientCache = () => {
  clients.clear();
  officialClients.clear();
  rawDataClients.clear();
  oneKeyIdAuthClients.clear();
};

const appApiClient = {
  getBasicClient,
  getClient,
  getOfficialClient: officialClients.get,
  getRawDataClient,
  getOneKeyIdAuthClient,
  clearClientCache,
};
export { appApiClient };

export interface IAxiosResponse<T> extends AxiosResponse<T> {
  $requestId?: string;
}
