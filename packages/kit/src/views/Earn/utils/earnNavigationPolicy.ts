import { ETabEarnRoutes } from '@onekeyhq/shared/src/routes';

const preservedChildRoutes: Partial<
  Record<ETabEarnRoutes, ReadonlySet<ETabEarnRoutes>>
> = {
  [ETabEarnRoutes.EarnProtocols]: new Set([ETabEarnRoutes.EarnProtocolDetails]),
  [ETabEarnRoutes.EarnPositions]: new Set([ETabEarnRoutes.EarnProtocolDetails]),
  [ETabEarnRoutes.BorrowHome]: new Set([ETabEarnRoutes.BorrowReserveDetails]),
};

export function shouldResetEarnRouteStackBeforePush({
  routeCount,
  currentRoute,
  targetRoute,
}: {
  routeCount: number;
  currentRoute?: string;
  targetRoute: ETabEarnRoutes;
}) {
  if (routeCount <= 1 || !currentRoute || currentRoute === targetRoute) {
    return false;
  }

  const allowedChildRoutes =
    preservedChildRoutes[currentRoute as ETabEarnRoutes];
  return !allowedChildRoutes?.has(targetRoute);
}
