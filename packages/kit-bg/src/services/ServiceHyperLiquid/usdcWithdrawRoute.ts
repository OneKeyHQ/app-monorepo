import { HttpTransport } from '@nktkas/hyperliquid';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { requestLoggedHyperLiquidTransport } from './utils/logHyperLiquidApiFailure';

// Hyperliquid deprecated the legacy Arbitrum bridge for CCTP but kept a switch to
// revert, so follow `info/usdcRouting` instead of pinning a rail in the bundle.
export type IUsdcWithdrawRoute = 'bridge' | 'cctp';

// Absent from the pinned SDK's info client, so the request goes through the
// transport rather than bumping @nktkas/hyperliquid on a release branch.
interface IUsdcRoutingResponse {
  depositRoute?: string;
  withdrawalRoute?: string;
}

const ROUTE_CACHE_TTL_MS = 5 * 60 * 1000;

// A failed lookup teaches us nothing, so fall back to the rail that has always
// worked rather than one Hyperliquid may have turned off.
const FALLBACK_ROUTE: IUsdcWithdrawRoute = 'bridge';

let cachedRoute: { route: IUsdcWithdrawRoute; fetchedAt: number } | undefined;
// A rail seen live beats the blind fallback, so one failed lookup cannot
// downgrade the user to the 5x more expensive bridge.
let lastResolvedRoute: IUsdcWithdrawRoute | undefined;
let inFlightRequest: Promise<IUsdcWithdrawRoute> | undefined;

function parseRoute(value: unknown): IUsdcWithdrawRoute | undefined {
  return value === 'cctp' || value === 'bridge' ? value : undefined;
}

// Undefined for anything unreadable, which callers must not confuse with a real
// switch to the bridge: error-shaped bodies are logged but still returned.
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
          // Caching this would pin the user to the fallback for the whole TTL.
          return lastResolvedRoute ?? FALLBACK_ROUTE;
        }
        cachedRoute = { route, fetchedAt: Date.now() };
        lastResolvedRoute = route;
        return route;
      })
      .catch(() => {
        // Already reported upstream; a withdrawal still needs a usable rail.
        return lastResolvedRoute ?? FALLBACK_ROUTE;
      })
      .finally(() => {
        inFlightRequest = undefined;
      });
  }
  return inFlightRequest;
}

// Submission binds to the rail being served now; a fallback here would silently
// change both the rail and the charged fee.
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
