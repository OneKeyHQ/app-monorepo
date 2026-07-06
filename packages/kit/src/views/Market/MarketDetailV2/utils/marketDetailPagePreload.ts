import platformEnv from '@onekeyhq/shared/src/platformEnv';

type IMarketDetailLayoutPreloadTarget = 'desktop' | 'mobile';

function shouldSkipMarketDetailPreload() {
  return platformEnv.isJest || process.env.NODE_ENV === 'test';
}

function preloadMarketDetailV2Shell() {
  if (shouldSkipMarketDetailPreload()) {
    return;
  }

  void import(/* webpackPrefetch: true */ '../index').catch(() => undefined);
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
    void import(/* webpackPrefetch: true */ '../layouts/DesktopLayout').catch(
      () => undefined,
    );
    return;
  }

  void import(/* webpackPrefetch: true */ '../layouts/MobileLayout').catch(
    () => undefined,
  );
}

export function preloadMarketDetailV2TradingView() {
  if (shouldSkipMarketDetailPreload()) {
    return;
  }

  void import(
    /* webpackPrefetch: true */ '../components/MarketTradingView/MarketTradingView'
  ).catch(() => undefined);
}

export function preloadMarketDetailV2SwapPanel(
  target: IMarketDetailLayoutPreloadTarget = resolveDefaultLayoutTarget(),
) {
  if (shouldSkipMarketDetailPreload()) {
    return;
  }

  void import(
    /* webpackPrefetch: true */ '../components/SwapPanel/SwapPanel'
  ).catch(() => undefined);
  if (target === 'mobile') {
    void import(
      /* webpackPrefetch: true */ '../components/SwapPanel/SwapPanelWrap'
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
      /* webpackPrefetch: true */ '../components/InformationTabs/layout/DesktopInformationTabs'
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
}: {
  includeBodyModules?: boolean;
  includeHeavyModules?: boolean;
} = {}) {
  preloadMarketDetailV2Shell();

  if (includeBodyModules) {
    preloadMarketDetailV2BodyModules({ includeHeavyModules });
  }
}
