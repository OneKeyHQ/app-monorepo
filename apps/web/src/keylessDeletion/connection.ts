import {
  endpointsMap,
  getEndpointsMapByDevSettings,
} from '@onekeyhq/shared/src/config/endpointsMap';
import type { ILocaleSymbol } from '@onekeyhq/shared/src/locale';
import { createFetchInterceptor } from '@onekeyhq/shared/src/request/createFetchInterceptor';

import { getKeylessSite } from './entry';
import {
  API_BASE,
  DELETION_ROUTES,
  RESULT_CAPABILITY_HEADER,
} from './protocol';

type IDevEndpointSettings = Parameters<typeof getEndpointsMapByDevSettings>[0];

const PROTOCOL_HEADERS = new Set([
  'accept',
  'content-type',
  'idempotency-key',
  RESULT_CAPABILITY_HEADER.toLowerCase(),
]);

export function createDeletionTransport(
  page: URL,
  settings: IDevEndpointSettings,
  {
    send,
    getLocalePreference = () => 'system',
  }: {
    send?: typeof globalThis.fetch;
    getLocalePreference?: () => ILocaleSymbol;
  } = {},
) {
  const site = getKeylessSite(page);
  if (!site) return undefined;

  const endpoints =
    site === 'local'
      ? getEndpointsMapByDevSettings(settings)
      : endpointsMap[site];
  const apiOrigin = new URL(endpoints.prime).origin;
  const permits = (url: URL) =>
    url.origin === apiOrigin &&
    !url.search &&
    !url.hash &&
    DELETION_ROUTES.some((route) => url.pathname === API_BASE + route);
  const sendWithAppInterceptor = createFetchInterceptor(send, {
    permits: (url) => permits(new URL(url)),
    getLocalePreference,
  });
  return {
    apiOrigin,
    transport: (request: Request) => {
      if (
        request.method !== 'POST' ||
        !permits(new URL(request.url)) ||
        [...request.headers.keys()].some((key) => !PROTOCOL_HEADERS.has(key))
      ) {
        throw new DOMException(
          'Invalid deletion API request.',
          'SecurityError',
        );
      }
      return sendWithAppInterceptor(request, {
        credentials: 'omit',
        mode: 'cors',
        redirect: 'error',
        referrerPolicy: 'no-referrer',
        cache: 'no-store',
      });
    },
  };
}
