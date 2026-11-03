import LazyLoad from '@onekeyhq/shared/src/lazyLoad';

// Keep lazy component identities outside the route configuration module so
// refreshing its non-component dependencies cannot remount active navigators.
export const ModalNavigator = LazyLoad(async () => {
  const { ModalNavigator: Component } = await import('./Modal/Navigator');
  return { default: Component };
});

export const IOSFullScreenNavigator = LazyLoad(async () => {
  const { IOSFullScreenNavigator: Component } =
    await import('./Modal/Navigator');
  return { default: Component };
});

export const FullScreenPushNavigator = LazyLoad(async () => {
  const { FullScreenPushNavigator: Component } =
    await import('./Modal/Navigator');
  return { default: Component };
});

export const OnboardingNavigator = LazyLoad(async () => {
  const { OnboardingNavigator: Component } = await import('./Modal/Navigator');
  return { default: Component };
});

export const WebViewNavigator = LazyLoad(async () => {
  const { WebViewNavigator: Component } = await import('./WebView/Navigator');
  return { default: Component };
});

export const TradingViewNativeFullscreenPage = LazyLoad(async () => {
  const { TradingViewNativeFullscreenPage: Component } =
    await import('../components/TradingView/TradingViewNative/TradingViewNativePresentation');
  return { default: Component };
});
