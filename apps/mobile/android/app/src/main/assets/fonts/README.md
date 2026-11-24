# Native-embedded app fonts (Android)

These TTFs mirror the font families referenced by JS (`tamagui.config.ts` `face`
mapping and `BRAND_FONT_NATIVE_FAMILY`):

- `GeistMono-*.ttf` are committed copies of
  `packages/components/src/hocs/Provider/fonts/`.
- Brand sans faces (`<PostScript name>.ttf`) are generated and gitignored.
  `yarn fonts:sync` (runs on postinstall) copies the licensed brand font when a
  private source is available, otherwise open-source Inter. See
  `docs/private-font-split-design.md`.

Why they exist: React Native resolves a `fontFamily` from `assets/fonts/<family>.ttf`
synchronously (ReactFontManager). Native registration is the only font loading
path on Android and iOS (`UIAppFonts` in Info.plist) — loading fonts again at
runtime via `expo-font` would duplicate every TTF in the app bundle and risk
first-frame width measurement mismatches in RN's TextMeasureCache.

File names must match the JS family strings exactly (e.g. `Inter-Medium.ttf`
for family "Inter-Medium"); no `_bold` suffix variants are needed because
Tamagui's face resolution strips `fontWeight` before it reaches RN.

Run `node development/lint/font.js` from the repository root to check every
native font slot. Its Android asset must be named `<JS key>.ttf` and
match the referenced Provider font file byte-for-byte. The Provider filename
may differ from the JS key; Android resolves the family key, not that source
filename. This check verifies asset consistency, not font licensing or rendered
layout.

[app-modules #145](https://github.com/OneKeyHQ/app-modules/pull/145) removes
SDK-bundled fonts. The App owns font provisioning and the applicable license.

NativeList startup is wired through `packages/kit/src/provider/useNativeListFonts`:

- Native configures the four PostScript/Android family names once when the UI
  provider module loads. iOS `UIAppFonts` and Android `assets/fonts` make these
  faces available synchronously before the first list mounts and for React Native
  text rendering.
- Web/desktop/extension UI imports the existing `web-fonts.css`, requests all
  four brand sans weights (400/500/600/700), then configures the SDK and mounts the
  provider children. Missing faces, rejection, or a 3-second timeout fall back
  to system fonts so authentication UI remains accessible.
- On native/extension targets, this configuration belongs to the UI/main JS
  runtime. Background runtimes have independent heaps and readiness; configuring
  them does not configure UI lists. Desktop/Web main and background share one
  JS runtime. Native font resources are process-owned; each list receives its
  own serialized mapping from the UI runtime.

A dependency upgrade requires a fresh native build/generated bindings. Tests of
loading order and asset consistency do not establish real-device first-frame
measurement, truncation, or numeric alignment; those require platform acceptance.
