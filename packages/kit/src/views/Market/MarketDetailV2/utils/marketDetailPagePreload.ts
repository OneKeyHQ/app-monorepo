import platformEnv from '@onekeyhq/shared/src/platformEnv';

export type IMarketDetailLayoutPreloadTarget = 'desktop' | 'mobile';
type IMarketDetailV2Module = typeof import('../index');

let marketDetailV2ShellModule: IMarketDetailV2Module | undefined;
let marketDetailV2ShellPromise: Promise<IMarketDetailV2Module> | undefined;

function shouldSkipMarketDetailPreload() {
  return platformEnv.isJest || process.env.NODE_ENV === 'test';
}

export function loadMarketDetailV2Shell() {
  if (marketDetailV2ShellModule) {
    return Promise.resolve(marketDetailV2ShellModule);
  }

  if (!marketDetailV2ShellPromise) {
    marketDetailV2ShellPromise = import(
      /* webpackChunkName: "market-detail-v2" */ '../index'
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
      /* webpackChunkName: "market-detail-v2-desktop-layout" */ '../layouts/DesktopLayout'
    ).catch(() => undefined);
    return;
  }

  void import(
    /* webpackChunkName: "market-detail-v2-mobile-layout" */ '../layouts/MobileLayout'
  ).catch(() => undefined);
}

export function preloadMarketDetailV2TradingView() {
  if (shouldSkipMarketDetailPreload()) {
    return;
  }

  void import(
    /* webpackChunkName: "market-detail-v2-tradingview" */ '../components/MarketTradingView/MarketTradingView'
  ).catch(() => undefined);
}

export function preloadMarketDetailV2SwapPanel(
  target: IMarketDetailLayoutPreloadTarget = resolveDefaultLayoutTarget(),
  isStockRoute = false,
) {
  if (shouldSkipMarketDetailPreload()) {
    return;
  }

  if (target === 'desktop' && !isStockRoute) {
    void import(
      /* webpackChunkName: "market-embedded-swap" */ '../../../Swap/pages/components/SwapMainLand'
    ).catch(() => undefined);
    return;
  }

  void import(
    /* webpackChunkName: "market-detail-v2-swap-panel" */ '../components/SwapPanel/SwapPanel'
  ).catch(() => undefined);
  if (target === 'mobile') {
    void import(
      /* webpackChunkName: "market-detail-v2-swap-panel-wrap" */ '../components/SwapPanel/SwapPanelWrap'
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
      /* webpackChunkName: "market-detail-v2-desktop-info-tabs" */ '../components/InformationTabs/layout/DesktopInformationTabs'
    ).catch(() => undefined);
  }
}

export function preloadMarketDetailV2BodyModules({
  layout = resolveDefaultLayoutTarget(),
  includeHeavyModules = false,
  isStockRoute = false,
}: {
  layout?: IMarketDetailLayoutPreloadTarget;
  includeHeavyModules?: boolean;
  isStockRoute?: boolean;
} = {}) {
  preloadMarketDetailV2Layout(layout);

  if (!includeHeavyModules) {
    return;
  }

  if (layout === 'mobile') {
    preloadMarketDetailV2TradingView();
  }
  preloadMarketDetailV2SwapPanel(layout, isStockRoute);
  preloadMarketDetailV2InfoPanel(layout);
}

export function preloadMarketDetailV2Page({
  includeBodyModules = false,
  includeHeavyModules = false,
  layout = resolveDefaultLayoutTarget(),
  isStockRoute = false,
}: {
  includeBodyModules?: boolean;
  includeHeavyModules?: boolean;
  layout?: IMarketDetailLayoutPreloadTarget;
  isStockRoute?: boolean;
} = {}) {
  const shellPreloadPromise = preloadMarketDetailV2Shell();

  if (includeBodyModules) {
    preloadMarketDetailV2BodyModules({
      layout,
      includeHeavyModules,
      isStockRoute,
    });
  }

  return shellPreloadPromise;
}
