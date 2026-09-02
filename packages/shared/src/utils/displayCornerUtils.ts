import platformEnv from '../platformEnv';

const SETTINGS_KEY = 'onekey_display_corner_radius';

/**
 * The display's physical corner radius in points, read from standard
 * UserDefaults via React Native's Settings API — no custom native module
 * involved. Screen-anchored surfaces subtract their edge inset from it to
 * sit concentric with the screen, the system's own corner language.
 *
 * Nothing in the app publishes the key today: the launch-time reader was
 * removed because the only source for the radius is a non-public UIScreen
 * property, and shipping that read risks App Store rejection. The reader
 * stays so a future public API (or a per-model table) can fill the key in
 * without touching the call sites, all of which already keep a tuned
 * fallback for the undefined case — as they must anyway on non-iOS
 * platforms and square-cornered displays.
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
