import { prepareHyperLiquidKlineSource } from '@onekeyhq/kit/src/components/TradingView/TradingViewV2/components/tradingViewV2/hooks/hyperLiquidKlineSource';
import { prefetchTradingViewV2FirstScreenData } from '@onekeyhq/kit/src/components/TradingView/TradingViewV2/components/tradingViewV2/hooks/useTradingViewV2';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  fetchMarketBasicConfigForPlatform,
  getCachedMarketBasicConfigForPlatform,
  getLastMarketBasicConfigForPlatform,
} from '../../hooks/useMarketBasicConfig/fetchMarketBasicConfigForPlatform';

import { normalizeMarketHistoryStartTimeSeconds } from './marketTradingViewBootstrap';
import {
  type IMarketTradingViewFirstScreenRequestPreference,
  hydrateMarketTradingViewPreferences,
  startMarketTradingViewSessionPreference,
} from './marketTradingViewResolutionPreference';
import { prefetchMarketTransactionsFirstPageWithCache } from './marketTransactionsFirstPageCache';

export type IMarketDetailLayoutPreloadTarget = 'desktop' | 'mobile';
type IMarketDetailV2Module = typeof import('../index');
type IMarketTradingViewModule =
  typeof import('../components/MarketTradingView/MarketTradingView');

let marketDetailV2ShellModule: IMarketDetailV2Module | undefined;
let marketDetailV2ShellPromise: Promise<IMarketDetailV2Module> | undefined;
let marketTradingViewModulePromise:
  | Promise<IMarketTradingViewModule>
  | undefined;

function shouldSkipMarketDetailPreload() {
  return platformEnv.isJest || process.env.NODE_ENV === 'test';
}

export function loadMarketDetailV2Shell() {
  if (marketDetailV2ShellModule) {
    return Promise.resolve(marketDetailV2ShellModule);
  }

  if (!marketDetailV2ShellPromise) {
    marketDetailV2ShellPromise = import(
      /* webpackChunkName: "market-detail-v2", webpackPrefetch: true */ '../index'
    )
      .then((module) => {
        marketDetailV2ShellModule = module;
        return module;
      })
      .catch((error: unknown) => {
        marketDetailV2ShellPromise = undefined;
        throw error;
      });
  }

  return marketDetailV2ShellPromise;
}

export function getPreloadedMarketDetailV2Shell() {
  return marketDetailV2ShellModule;
}

function preloadMarketDetailV2Shell() {
  if (shouldSkipMarketDetailPreload()) {
    return Promise.resolve();
  }

  return loadMarketDetailV2Shell()
    .then(() => undefined)
    .catch(() => undefined);
}

function resolveDefaultLayoutTarget(): IMarketDetailLayoutPreloadTarget {
  return platformEnv.isNative ? 'mobile' : 'desktop';
}

export function preloadMarketDetailV2Layout(
  target: IMarketDetailLayoutPreloadTarget = resolveDefaultLayoutTarget(),
) {
  if (shouldSkipMarketDetailPreload()) {
    return;
  }

  if (target === 'desktop') {
    void import(
      /* webpackChunkName: "market-detail-v2-desktop-layout", webpackPrefetch: true */ '../layouts/DesktopLayout'
    ).catch(() => undefined);
    return;
  }

  void import(
    /* webpackChunkName: "market-detail-v2-mobile-layout", webpackPrefetch: true */ '../layouts/MobileLayout'
  ).catch(() => undefined);
}

export function preloadMarketDetailV2TradingView() {
  if (shouldSkipMarketDetailPreload()) {
    return;
  }

  if (!marketTradingViewModulePromise) {
    marketTradingViewModulePromise = import(
      /* webpackChunkName: "market-detail-v2-tradingview", webpackPrefetch: true */ '../components/MarketTradingView/MarketTradingView'
    ).catch((error: unknown) => {
      marketTradingViewModulePromise = undefined;
      throw error;
    });
  }

  void marketTradingViewModulePromise.catch(() => undefined);
}

export function prepareMarketDetailV2KlineSource({
  tokenAddress,
  networkId,
}: {
  tokenAddress: string;
  networkId: string;
}) {
  const basicConfigResponse =
    getCachedMarketBasicConfigForPlatform() ??
    getLastMarketBasicConfigForPlatform();
  return basicConfigResponse
    ? prepareHyperLiquidKlineSource({
        basicConfig: basicConfigResponse.data,
        networkId,
        tokenAddress,
      })
    : undefined;
}

export async function prefetchMarketDetailV2FirstScreenKLineData({
  tokenAddress,
  networkId,
  historyStartTime,
  requestPreference,
}: {
  tokenAddress: string;
  networkId: string;
  historyStartTime?: number;
  requestPreference?: IMarketTradingViewFirstScreenRequestPreference;
}) {
  const preferenceHydrationPromise = requestPreference
    ? Promise.resolve()
    : hydrateMarketTradingViewPreferences();
  const cachedBasicConfigResponse =
    getCachedMarketBasicConfigForPlatform() ??
    getLastMarketBasicConfigForPlatform();
  const basicConfigResponse =
    cachedBasicConfigResponse ??
    (await fetchMarketBasicConfigForPlatform().catch(() => undefined));
  await preferenceHydrationPromise;
  if (!basicConfigResponse) {
    return undefined;
  }
  const kLineSource = prepareHyperLiquidKlineSource({
    basicConfig: basicConfigResponse.data,
    networkId,
    tokenAddress,
  });
  const namespace = kLineSource?.isHyperLiquidSource
    ? 'market-hyperliquid'
    : 'market';
  const sessionRequestPreference = startMarketTradingViewSessionPreference({
    tokenAddress,
    networkId,
    namespace,
  });
  const firstScreenRequestPreference =
    requestPreference ?? sessionRequestPreference;

  return prefetchTradingViewV2FirstScreenData({
    tokenAddress,
    networkId,
    kLineProvider: kLineSource?.isHyperLiquidSource ? 'hyperliquid' : 'onekey',
    kLineProviderSymbol: kLineSource?.symbol,
    interval: firstScreenRequestPreference.resolution,
    historyStartTime: normalizeMarketHistoryStartTimeSeconds(historyStartTime),
    ...(firstScreenRequestPreference.historySeconds !== undefined
      ? {
          preferredHistorySeconds: firstScreenRequestPreference.historySeconds,
        }
      : {}),
    ...(firstScreenRequestPreference.futureSeconds !== undefined
      ? {
          preferredFutureSeconds: firstScreenRequestPreference.futureSeconds,
        }
      : {}),
    ...(firstScreenRequestPreference.countBack !== undefined
      ? { preferredCountBack: firstScreenRequestPreference.countBack }
      : {}),
  });
}

export async function prefetchMarketDetailV2FirstScreenKLine({
  tokenAddress,
  networkId,
  historyStartTime,
}: {
  tokenAddress: string;
  networkId: string;
  historyStartTime?: number;
}) {
  if (shouldSkipMarketDetailPreload()) {
    return;
  }

  preloadMarketDetailV2TradingView();
  await prefetchMarketDetailV2FirstScreenKLineData({
    tokenAddress,
    networkId,
    historyStartTime,
  });
}

export async function prefetchMarketDetailV2FirstScreenTransactions({
  tokenAddress,
  networkId,
}: {
  tokenAddress: string;
  networkId: string;
}) {
  if (shouldSkipMarketDetailPreload()) {
    return;
  }

  await prefetchMarketTransactionsFirstPageWithCache({
    tokenAddress,
    networkId,
  });
}

export function preloadMarketDetailV2SwapPanel(
  target: IMarketDetailLayoutPreloadTarget = resolveDefaultLayoutTarget(),
) {
  if (shouldSkipMarketDetailPreload()) {
    return;
  }

  void import(
    /* webpackChunkName: "market-detail-v2-swap-panel", webpackPrefetch: true */ '../components/SwapPanel/SwapPanel'
  ).catch(() => undefined);
  if (target === 'mobile') {
    void import(
      /* webpackChunkName: "market-detail-v2-swap-panel-wrap", webpackPrefetch: true */ '../components/SwapPanel/SwapPanelWrap'
    ).catch(() => undefined);
  }
}

export function preloadMarketDetailV2InfoPanel(
  target: IMarketDetailLayoutPreloadTarget = resolveDefaultLayoutTarget(),
) {
  if (shouldSkipMarketDetailPreload()) {
    return;
  }

  if (target === 'desktop') {
    void import(
      /* webpackChunkName: "market-detail-v2-desktop-info-tabs", webpackPrefetch: true */ '../components/InformationTabs/layout/DesktopInformationTabs'
    ).catch(() => undefined);
  }
}

export function preloadMarketDetailV2BodyModules({
  layout = resolveDefaultLayoutTarget(),
  includeHeavyModules = false,
}: {
  layout?: IMarketDetailLayoutPreloadTarget;
  includeHeavyModules?: boolean;
} = {}) {
  preloadMarketDetailV2Layout(layout);

  if (!includeHeavyModules) {
    return;
  }

  preloadMarketDetailV2TradingView();
  preloadMarketDetailV2SwapPanel(layout);
  preloadMarketDetailV2InfoPanel(layout);
}

export function preloadMarketDetailV2Page({
  includeBodyModules = false,
  includeHeavyModules = false,
  layout = resolveDefaultLayoutTarget(),
}: {
  includeBodyModules?: boolean;
  includeHeavyModules?: boolean;
  layout?: IMarketDetailLayoutPreloadTarget;
} = {}) {
  void hydrateMarketTradingViewPreferences();
  const shellPreloadPromise = preloadMarketDetailV2Shell();

  if (includeBodyModules) {
    preloadMarketDetailV2BodyModules({ layout, includeHeavyModules });
  }

  return shellPreloadPromise;
}
