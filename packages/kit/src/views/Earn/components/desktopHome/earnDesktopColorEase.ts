import { Platform } from 'react-native';

// A color eased on hover or as a step moves on. The web animation driver
// writes these names into CSS `transition` as they are, and CSS only knows
// the hyphenated one (the shared ANIMATE_ONLY_BACKGROUND_COLOR eases nothing
// there); native drivers take the style key
export const ANIMATE_ONLY_BG_COLOR = Platform.select({
  web: ['background-color'],
  default: ['backgroundColor'],
});
