import {
  endpointsMap,
  getEndpointsMapByDevSettings,
} from '@onekeyhq/shared/src/config/endpointsMap';

import { getKeylessSite } from './entry';
import { API_BASE, DELETION_ROUTES } from './protocol';

type IDevEndpointSettings = Parameters<typeof getEndpointsMapByDevSettings>[0];

export function createDeletionTransport(
  page: URL,
  settings: IDevEndpointSettings,
  send = globalThis.fetch,
) {
  const site = getKeylessSite(page);
  if (!site) return undefined;

  const endpoints =
    site === 'local'
      ? getEndpointsMapByDevSettings(settings)
      : endpointsMap[site];
  const apiOrigin = new URL(endpoints.prime).origin;
  return {
    apiOrigin,
    transport: (request: Request) => {
      const url = new URL(request.url);
      if (
        url.origin !== apiOrigin ||
        url.search ||
        url.hash ||
        request.method !== 'POST' ||
        !DELETION_ROUTES.some((route) => url.pathname === API_BASE + route)
      ) {
        throw new DOMException(
          'Invalid deletion API request.',
          'SecurityError',
        );
      }
      return send(request, {
        credentials: 'omit',
        mode: 'cors',
        redirect: 'error',
        referrerPolicy: 'no-referrer',
        cache: 'no-store',
      });
    },
  };
}
