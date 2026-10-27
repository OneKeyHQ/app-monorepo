const fs = require('node:fs');
const path = require('node:path');

const androidFontsDirectory = path.resolve(
  __dirname,
  '../../android/app/src/main/assets/fonts',
);
const uiFontsDirectory = path.resolve(
  __dirname,
  '../../../../packages/components/src/hocs/Provider/fonts',
);

const brandManifestPath = path.join(uiFontsDirectory, 'brand/manifest.ts');

// Brand sans faces come from `yarn fonts:sync`; their family names follow the
// installed typeface (licensed brand font or the open-source fallback).
function readBrandFonts() {
  const manifest = fs.readFileSync(brandManifestPath, 'utf8');
  const slotFileNames = {
    regular: 'BrandSans-Regular.ttf',
    medium: 'BrandSans-Medium.ttf',
    semibold: 'BrandSans-SemiBold.ttf',
    bold: 'BrandSans-Bold.ttf',
  };
  return Object.entries(slotFileNames).map(([slot, fileName]) => {
    const match = manifest.match(new RegExp(`^\\s+${slot}: '([^']+)',$`, 'm'));
    return [match?.[1], `brand/${fileName}`];
  });
}

describe('Android fonts available before JavaScript registration', () => {
  // ReactFontManager resolves these exact family names from APK assets before
  // expo-font runs, including Market tabs rendered while FontProvider is bypassed.
  it.each([
    ...readBrandFonts(),
    ['GeistMono-Regular', 'GeistMono-Regular.ttf'],
    ['GeistMono-Medium', 'GeistMono-Medium.ttf'],
  ])('bundles %s with the same bytes used by the UI', (family, uiFileName) => {
    expect(family).toEqual(expect.any(String));
    const uiFont = fs.readFileSync(path.join(uiFontsDirectory, uiFileName));
    const androidFont = fs.readFileSync(
      path.join(androidFontsDirectory, `${family}.ttf`),
    );

    expect(uiFont.length).toBeGreaterThan(0);
    expect(androidFont.equals(uiFont)).toBe(true);
  });
});
