import { createContext, useContext } from 'react';

import { useRoute } from '@react-navigation/core';

import type {
  EAccountManagerStacksRoutes,
  IAccountManagerStacksParamList,
} from '@onekeyhq/shared/src/routes';

import type { RouteProp } from '@react-navigation/core';

type IAccountSelectorRoute = RouteProp<
  IAccountManagerStacksParamList,
  EAccountManagerStacksRoutes.AccountSelectorStack
>;

// Embedded selectors supply their own configuration instead of inheriting
// the route parameters of the page hosting the popover.
export const AccountSelectorRouteContext = createContext<
  IAccountSelectorRoute | undefined
>(undefined);

export function useAccountSelectorRoute() {
  const embeddedRoute = useContext(AccountSelectorRouteContext);
  const route =
    useRoute<
      RouteProp<
        IAccountManagerStacksParamList,
        EAccountManagerStacksRoutes.AccountSelectorStack
      >
    >();
  return embeddedRoute ?? route;
}
