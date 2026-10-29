import { EModalBulkSendRoutes } from '@onekeyhq/shared/src/routes/bulkSend';
import { EModalRoutes } from '@onekeyhq/shared/src/routes/modal';
import { EModalSendRoutes } from '@onekeyhq/shared/src/routes/send';

export type IIntercomNavigationState = {
  type?: string;
  index?: number;
  routes: readonly {
    name: string;
    state?: IIntercomNavigationState;
  }[];
};

const sensitiveRoutes = new Set<string>([
  EModalRoutes.SignatureConfirmModal,
  EModalRoutes.SignAndVerifyModal,
  EModalSendRoutes.SendConfirm,
  EModalSendRoutes.SendConfirmFromDApp,
  EModalSendRoutes.SendConfirmFromSwap,
  EModalBulkSendRoutes.BulkSendReview,
  EModalBulkSendRoutes.BulkSendProcess,
]);

function hasSensitiveRoute(state: IIntercomNavigationState): boolean {
  const isTabOrDrawer = state.type === 'tab' || state.type === 'drawer';
  const index = state.index ?? (isTabOrDrawer ? 0 : state.routes.length - 1);
  // Keep covered confirmation flows quiet, without inspecting inactive tabs.
  const routes = isTabOrDrawer
    ? [state.routes[index]]
    : state.routes.slice(0, index + 1);
  return routes.some(
    (route) =>
      route &&
      (sensitiveRoutes.has(route.name) ||
        (route.state && hasSensitiveRoute(route.state))),
  );
}

export function shouldShowIntercomInAppMessages(
  isLocked: boolean,
  state: IIntercomNavigationState | undefined,
): boolean {
  return !isLocked && !!state?.routes.length && !hasSensitiveRoute(state);
}
