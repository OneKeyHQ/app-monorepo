import { ETabEarnRoutes } from '@onekeyhq/shared/src/routes';

const preservedChildRoutes: Partial<
  Record<ETabEarnRoutes, ReadonlySet<ETabEarnRoutes>>
> = {
  [ETabEarnRoutes.EarnProtocols]: new Set([ETabEarnRoutes.EarnProtocolDetails]),
  [ETabEarnRoutes.EarnPositions]: new Set([ETabEarnRoutes.EarnProtocolDetails]),
  [ETabEarnRoutes.BorrowHome]: new Set([ETabEarnRoutes.BorrowReserveDetails]),
  // Tokens 首页 → Token 的协议列表 / 协议详情 (OK-58505)
  [ETabEarnRoutes.EarnTokens]: new Set([
    ETabEarnRoutes.EarnProtocols,
    ETabEarnRoutes.EarnProtocolDetails,
  ]),
  // Protocols 首页 → 协议的代币列表 / 协议详情 (OK-58505)
  [ETabEarnRoutes.EarnAllProtocols]: new Set([
    ETabEarnRoutes.EarnProtocolTokens,
    ETabEarnRoutes.EarnProtocolDetails,
  ]),
  [ETabEarnRoutes.EarnProtocolTokens]: new Set([
    ETabEarnRoutes.EarnProtocolDetails,
  ]),
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
