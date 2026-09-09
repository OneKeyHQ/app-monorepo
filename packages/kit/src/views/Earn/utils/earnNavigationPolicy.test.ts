import { ETabEarnRoutes } from '@onekeyhq/shared/src/routes';

import { shouldResetEarnRouteStackBeforePush } from './earnNavigationPolicy';

describe('earnNavigationPolicy', () => {
  it('keeps the stack when pushing the first child page', () => {
    expect(
      shouldResetEarnRouteStackBeforePush({
        routeCount: 1,
        currentRoute: 'TabDiscovery',
        targetRoute: ETabEarnRoutes.EarnProtocols,
      }),
    ).toBe(false);
  });

  it.each([
    [ETabEarnRoutes.EarnProtocols, ETabEarnRoutes.EarnProtocolDetails],
    [ETabEarnRoutes.EarnPositions, ETabEarnRoutes.EarnProtocolDetails],
    [ETabEarnRoutes.BorrowHome, ETabEarnRoutes.BorrowReserveDetails],
  ])('preserves the valid %s -> %s parent-child chain', (current, target) => {
    expect(
      shouldResetEarnRouteStackBeforePush({
        routeCount: 2,
        currentRoute: current,
        targetRoute: target,
      }),
    ).toBe(false);
  });

  it('replaces the current page instead of growing sibling routes', () => {
    expect(
      shouldResetEarnRouteStackBeforePush({
        routeCount: 2,
        currentRoute: ETabEarnRoutes.EarnPositions,
        targetRoute: ETabEarnRoutes.EarnProtocols,
      }),
    ).toBe(true);
  });

  it('resets a detail chain before navigating to another top-level child', () => {
    expect(
      shouldResetEarnRouteStackBeforePush({
        routeCount: 3,
        currentRoute: ETabEarnRoutes.EarnProtocolDetails,
        targetRoute: ETabEarnRoutes.EarnPositions,
      }),
    ).toBe(true);
  });

  it('replaces an existing instance of the same route without resetting', () => {
    expect(
      shouldResetEarnRouteStackBeforePush({
        routeCount: 3,
        currentRoute: ETabEarnRoutes.EarnProtocolDetails,
        targetRoute: ETabEarnRoutes.EarnProtocolDetails,
      }),
    ).toBe(false);
  });
});
