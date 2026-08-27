export type IUseAppearanceTheme = (themeVariant: 'light' | 'dark') => void;

/**
 * Pins the system bars (status + navigation) to a variant while a
 * theme-locked foreground surface is up; `null` hands them back to the
 * app theme. Effective on Android — iOS paints its status text per page
 * (see BasicPage's PageStatusBar) and has no navigation bar to color —
 * and a no-op on web.
 */
export type ISetSystemBarsOverride = (variant: 'light' | 'dark' | null) => void;

/**
 * The app-theme window-background paint (NavigationContainer's), routed
 * through the appearance module so a foreground override and the app
 * theme never race over the same native call. Same signature as the
 * shared root-view background primitive it forwards to.
 */
export type IUpdateAppRootViewBackground = (
  color: string,
  themeVariant: 'light' | 'dark',
  themeSetting?: 'light' | 'dark' | 'system',
) => void;
