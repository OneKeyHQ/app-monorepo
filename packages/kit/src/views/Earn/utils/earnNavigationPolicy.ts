import { ETabEarnRoutes } from '@onekeyhq/shared/src/routes';

const preservedChildRoutes: Partial<
  Record<ETabEarnRoutes, ReadonlySet<ETabEarnRoutes>>
> = {
  [ETabEarnRoutes.EarnProtocols]: new Set([ETabEarnRoutes.EarnProtocolDetails]),
  // A lending supply opens its details (demo 10-28); back returns to My
  // portfolio
  [ETabEarnRoutes.EarnPositions]: new Set([
    ETabEarnRoutes.EarnProtocolDetails,
    ETabEarnRoutes.EarnLendingDetails,
  ]),
  // The phone app's Borrow page (retired on web, demo 11-10)
  [ETabEarnRoutes.BorrowHome]: new Set([ETabEarnRoutes.BorrowReserveDetails]),
  // The Loans page's loans open their cards in My portfolio (demo 11-03)
  [ETabEarnRoutes.EarnLoans]: new Set([ETabEarnRoutes.EarnPositions]),
  // Tokens home → token's protocol list / protocol detail (OK-58505)
  [ETabEarnRoutes.EarnTokens]: new Set([
    ETabEarnRoutes.EarnProtocols,
    ETabEarnRoutes.EarnProtocolDetails,
  ]),
  // Fixed-rate list → protocol list / protocol detail (OK-58879)
  [ETabEarnRoutes.EarnFixedRateTokens]: new Set([
    ETabEarnRoutes.EarnProtocols,
    ETabEarnRoutes.EarnProtocolDetails,
  ]),
  // Protocols home → protocol's token list / protocol detail (OK-58505)
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
