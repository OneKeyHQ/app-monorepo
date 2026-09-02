import { HttpTransport } from '@nktkas/hyperliquid';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

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

// Resolves to undefined when Hyperliquid answers with something we cannot read,
// which callers must not confuse with a genuine switch to the legacy bridge:
// `requestLoggedHyperLiquidTransport` reports `{ status: 'err' }` bodies but
// still returns them, and a missing or unknown `withdrawalRoute` lands here too.
async function fetchWithdrawRoute(): Promise<IUsdcWithdrawRoute | undefined> {
  const response =
    await requestLoggedHyperLiquidTransport<IUsdcRoutingResponse>(
      new HttpTransport(),
      'info',
      { type: 'usdcRouting' },
      { action: 'usdcRouting' },
    );
  return parseRoute(response?.withdrawalRoute);
}

export async function getUsdcWithdrawRoute(): Promise<IUsdcWithdrawRoute> {
  const now = Date.now();
  if (cachedRoute && now - cachedRoute.fetchedAt < ROUTE_CACHE_TTL_MS) {
    return cachedRoute.route;
  }
  if (!inFlightRequest) {
    inFlightRequest = fetchWithdrawRoute()
      .then((route) => {
        if (!route) {
          // Neither cache nor remember an unreadable answer, or one malformed
          // response would pin the user to the fallback rail for the whole TTL.
          return lastResolvedRoute ?? FALLBACK_ROUTE;
        }
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

// A submission must be bound to the route that Hyperliquid is serving now.
// Falling back here could silently change both the rail and the charged fee.
export async function getLiveUsdcWithdrawRoute(): Promise<IUsdcWithdrawRoute> {
  const route = await fetchWithdrawRoute();
  if (!route) {
    throw new OneKeyLocalError('Unsupported Hyperliquid withdrawal route');
  }
  cachedRoute = { route, fetchedAt: Date.now() };
  lastResolvedRoute = route;
  return route;
}

export function clearUsdcWithdrawRouteCacheForTest() {
  cachedRoute = undefined;
  lastResolvedRoute = undefined;
  inFlightRequest = undefined;
}
