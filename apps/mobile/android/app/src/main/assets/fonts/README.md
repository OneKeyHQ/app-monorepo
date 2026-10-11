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
SDK-bundled fonts and adds `configureNativeListFonts`. After the SDK change is
published and the App upgrades, configure its four faces once in the UI/main
runtime startup, after host font provisioning and before the first NativeList.
The SDK only receives names; it does not register or distribute font files.
The existing App assets and registrations remain responsible for providing the
faces, and the App is responsible for obtaining the applicable font license.
This PR does not upgrade the SDK or call an API absent from the installed version.

Future native startup integration (after the release/version upgrade):

```ts
import { configureNativeListFonts } from '@onekeyfe/react-native-native-list';

configureNativeListFonts({
  regular: 'Roobert-Regular',
  medium: 'Roobert-Medium',
  semibold: 'Roobert-SemiBold',
  bold: 'Roobert-Bold',
});
```

On iOS, `UIAppFonts` supplies the PostScript faces; Android assets use the JS
family keys above and support synchronous first-frame resolution. Configure the
UI runtime that mounts lists; background and UI runtimes have independent stores
and readiness on native/extension targets. Do not configure on each list render.

On Web/desktop/extension UI startup, the existing CSS defines one `Roobert`
family at four weights. After importing that CSS, explicitly wait for the faces
needed by the first list, then use `Roobert` for all four mapping values:

```ts
await Promise.all([400, 500, 600, 700].map(
  (weight) => document.fonts.load(`${weight} 16px "Roobert"`),
));
configureNativeListFonts({
  regular: 'Roobert', medium: 'Roobert', semibold: 'Roobert', bold: 'Roobert',
});
```

`document.fonts.ready` alone does not request lazily used faces. The current Web
`useLoadCustomFonts` return value does not establish browser font readiness;
implement this startup gate together with the published SDK upgrade.

Before enabling this integration, publish the reviewed SDK version, upgrade the
App dependency and lockfile to that real version, rebuild native/generated
bindings, and add the UI bootstrap call and Web font gate. Verify first-frame
measurement, fixed rows, truncation and numeric alignment on each platform.
Unconfigured faces use system fonts; changing mappings updates mounted lists,
but loading different font bytes under an unchanged name is outside this API.
