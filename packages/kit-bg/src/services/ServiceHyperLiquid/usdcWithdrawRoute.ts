import { HttpTransport } from '@nktkas/hyperliquid';

import { requestLoggedHyperLiquidTransport } from './utils/logHyperLiquidApiFailure';

// Hyperliquid moved USDC to Circle CCTP and marked the legacy Arbitrum bridge
// deprecated, but kept serving the active rail from `info/usdcRouting` so it can
// be switched back. Follow that switch instead of pinning a rail in the bundle.
export type IUsdcWithdrawRoute = 'bridge' | 'cctp';

// `usdcRouting` is absent from the pinned @nktkas/hyperliquid info client, so the
// request goes through the transport directly rather than bumping the SDK on a
// release branch.
interface IUsdcRoutingResponse {
  depositRoute?: string;
  withdrawalRoute?: string;
}

const ROUTE_CACHE_TTL_MS = 5 * 60 * 1000;

// An unreachable or unparsable response tells us nothing new, so fall back to the
// rail that has been working in production all along. It costs the legacy $1 fee
// instead of risking a rail Hyperliquid may have turned off.
const FALLBACK_ROUTE: IUsdcWithdrawRoute = 'bridge';

let cachedRoute: { route: IUsdcWithdrawRoute; fetchedAt: number } | undefined;
// A rail Hyperliquid confirmed earlier beats the blind fallback: once cctp has
// been observed live, a later lookup failure must not silently downgrade the
// user to a rail that is on its way out.
let lastResolvedRoute: IUsdcWithdrawRoute | undefined;
let inFlightRequest: Promise<IUsdcWithdrawRoute> | undefined;

function parseRoute(value: unknown): IUsdcWithdrawRoute | undefined {
  return value === 'cctp' || value === 'bridge' ? value : undefined;
}

async function fetchWithdrawRoute(): Promise<IUsdcWithdrawRoute> {
  const response =
    await requestLoggedHyperLiquidTransport<IUsdcRoutingResponse>(
      new HttpTransport(),
      'info',
      { type: 'usdcRouting' },
      { action: 'usdcRouting' },
    );
  return parseRoute(response?.withdrawalRoute) ?? FALLBACK_ROUTE;
}

export async function getUsdcWithdrawRoute(): Promise<IUsdcWithdrawRoute> {
  const now = Date.now();
  if (cachedRoute && now - cachedRoute.fetchedAt < ROUTE_CACHE_TTL_MS) {
    return cachedRoute.route;
  }
  if (!inFlightRequest) {
    inFlightRequest = fetchWithdrawRoute()
      .then((route) => {
        cachedRoute = { route, fetchedAt: Date.now() };
        lastResolvedRoute = route;
        return route;
      })
      .catch(() => {
        // requestLoggedHyperLiquidTransport already reported the failure; a
        // withdrawal must still resolve to a usable rail.
        return lastResolvedRoute ?? FALLBACK_ROUTE;
      })
      .finally(() => {
        inFlightRequest = undefined;
      });
  }
  return inFlightRequest;
}

export function clearUsdcWithdrawRouteCacheForTest() {
  cachedRoute = undefined;
  lastResolvedRoute = undefined;
  inFlightRequest = undefined;
}
