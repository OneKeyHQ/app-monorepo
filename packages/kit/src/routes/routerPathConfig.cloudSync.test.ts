/** @jest-environment jsdom */
import { EModalRoutes, ERootRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import type { IScreenPathConfig } from '@onekeyhq/shared/src/utils/routeUtils';

import { getStateFromPath } from './config/getStateFromPath.ext';
import { modalRouterPathConfig } from './routerPathConfig';

import type { IRoutePathConfig } from './routerPathConfig';

function toScreens(routes: IRoutePathConfig[]): IScreenPathConfig {
  return Object.fromEntries(
    routes.map(({ name, rewrite, exact, children }) => [
      name,
      {
        path: rewrite || name,
        exact: !!exact,
        ...(children ? { screens: toScreens(children) } : {}),
      },
    ]),
  );
}

test('opens cloud sync when a popup hands off to a cold expand tab', () => {
  const previousHash = globalThis.location.hash;
  globalThis.location.hash = '/modal/PrimeModal/PrimeCloudSync';
  try {
    const config = {
      screens: {
        [ERootRoutes.Modal]: {
          path: ERootRoutes.Modal,
          screens: toScreens(modalRouterPathConfig),
        },
        NotFound: '*',
      },
    };
    const state = getStateFromPath('', config);

    expect(state?.routes[0].name).toBe(ERootRoutes.Modal);
    expect(state?.routes[0].state?.routes[0].name).toBe(
      EModalRoutes.PrimeModal,
    );
    expect(state?.routes[0].state?.routes[0].state?.routes[0].name).toBe(
      EPrimePages.PrimeCloudSync,
    );
  } finally {
    globalThis.location.hash = previousHash;
  }
});
