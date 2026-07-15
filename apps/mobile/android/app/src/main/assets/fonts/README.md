# Native-embedded app fonts (Android)

These TTFs are copies of `packages/components/src/hocs/Provider/fonts/` and MUST
stay in sync with the font families referenced by JS (tamagui.config.ts `face`
mapping and `useLoadCustomFonts`).

Why they exist: React Native resolves a `fontFamily` from `assets/fonts/<family>.ttf`
synchronously (ReactFontManager). Without these files, fonts are only available
after expo-font's async runtime registration. Production builds
(ENABLE_NATIVE_BACKGROUND_THREAD=true) bypass the FontProvider loading gate on
the main UI runtime, so first-frame text was measured with the fallback typeface
(Roboto) and later drawn with Roobert — RN's TextMeasureCache keeps the stale
width for the whole session, clipping/ellipsizing cold-start texts (e.g. home
account name and balance). iOS has the same guarantee via `UIAppFonts` in
Info.plist.

File names must match the JS family strings exactly (e.g. `Roobert-Medium.ttf`
for family "Roobert-Medium"); no `_bold` suffix variants are needed because
Tamagui's face resolution strips `fontWeight` before it reaches RN.
