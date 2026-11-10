// The brand faces are already registered by the native runtime, so loading them
// again through expo-font ships a second copy of every ttf inside the app:
// - iOS: registered via UIAppFonts in ios/OneKeyWallet/Info.plist and resolved
//   by PostScript name (the BRAND_FONT_NATIVE_FAMILY values).
// - Android: written by development/scripts/fonts-sync.js into
//   android/app/src/main/assets/fonts/ and resolved by ReactFontManager from
//   assets/fonts/<family>.ttf.
// Web/desktop/extension already use useLoadCustomFonts.web.ts + web-fonts.css.
// Keep the [loaded, error] shape because FontProvider gates the first render on it.
export default function useLoadCustomFonts(): [boolean, Error | null] {
  return [true, null];
}
