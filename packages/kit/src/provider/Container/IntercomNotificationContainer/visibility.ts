import { ERootRoutes } from '@onekeyhq/shared/src/routes/root';

export type IIntercomNavigationState = {
  index?: number;
  routes: readonly {
    name: string;
  }[];
};

// Allow-list the main tabs so modals, onboarding and full-screen flows
// (signing, backups, key export) stay quiet without tracking each route.
export function shouldShowIntercomInAppMessages(
  state: IIntercomNavigationState | undefined,
): boolean {
  if (!state?.routes.length) {
    return false;
  }
  const focused = state.routes[state.index ?? state.routes.length - 1];
  return focused?.name === ERootRoutes.Main;
}
