export type IUseAppearanceTheme = (themeVariant: 'light' | 'dark') => void;

export type ISystemBarsOverride = {
  variant: 'light' | 'dark';
  // Bar/window color; defaults to the variant's app background.
  color?: string;
};

/**
 * Pins the system bars (status + navigation) to a variant (and optionally a
 * color) while a theme-locked foreground surface is up; `null` releases that
 * owner's pin, handing the bars back to another owner's pin or the app theme.
 * Effective on Android — iOS paints its status text per page (see
 * BasicPage's PageStatusBar) and has no navigation bar to color — and a
 * no-op on web.
 */
export type ISetSystemBarsOverride = (
  ownerId: string,
  override: ISystemBarsOverride | null,
) => void;

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

/**
 * The variant that native UI presented over the app (e.g. the image
 * cropper) should use: a foreground surface's pin when one is up,
 * otherwise the app theme. `undefined` before the app theme resolves,
 * and always off native.
 */
export type IGetAppThemeVariant = () => 'light' | 'dark' | undefined;
