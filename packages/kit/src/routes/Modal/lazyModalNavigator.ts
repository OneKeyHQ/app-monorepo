import LazyLoad from '@onekeyhq/shared/src/lazyLoad';

// The root's modal navigator, loaded with the first modal. In a module of its
// own so a screen that knows a modal is coming can load it ahead (the desktop
// Earn guide): that first modal then renders at once instead of suspending,
// which holds it back a few hundred ms more
export const ModalNavigator = LazyLoad(async () => {
  const { ModalNavigator: Component } = await import('./Navigator');
  return { default: Component };
});

export const preloadModalNavigator = () => ModalNavigator.preload();
