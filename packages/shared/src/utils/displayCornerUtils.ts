import platformEnv from '../platformEnv';

const SETTINGS_KEY = 'onekey_display_corner_radius';

/**
 * The display's physical corner radius in points, published by the iOS
 * AppDelegate at launch (bridged through standard UserDefaults, read here
 * via React Native's Settings API — no custom native module involved).
 * Screen-anchored surfaces subtract their edge inset from it to sit
 * concentric with the screen, the system's own corner language.
 *
 * Undefined everywhere the value is not published: non-iOS platforms,
 * square-cornered displays, and any future OS that drops the underlying
 * property — callers keep a tuned fallback for those.
 */
export function getDisplayCornerRadius(): number | undefined {
  if (!platformEnv.isNativeIOS) {
    return undefined;
  }
  // Lazy on purpose: react-native-web has no Settings export, so the
  // access stays behind the platform gate.
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const { Settings } = require('react-native') as {
    Settings?: { get: (key: string) => unknown };
  };
  const value = Settings?.get(SETTINGS_KEY);
  return typeof value === 'number' && value > 0 ? value : undefined;
}
