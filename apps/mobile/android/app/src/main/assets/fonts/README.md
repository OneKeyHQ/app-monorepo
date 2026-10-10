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

Run `node development/lint/font.js` from the repository root to check every
`useLoadCustomFonts` entry. Its Android asset must be named `<JS key>.ttf` and
match the referenced Provider font file byte-for-byte. The Provider filename
may differ from the JS key; Android resolves the family key, not that source
filename. This check verifies asset consistency, not font licensing or rendered
layout.

[app-modules #145](https://github.com/OneKeyHQ/app-modules/pull/145) removes
SDK-bundled fonts while retaining host-provided Roobert lookup. After that SDK
change is published and the App upgrades, these existing App assets and font
registrations supply the faces. Keep them in the App, which is responsible for obtaining the applicable
font license. This PR does not upgrade the SDK or change its installed version.
