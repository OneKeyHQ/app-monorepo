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

describe('Android fonts available before JavaScript registration', () => {
  // ReactFontManager resolves these exact family names from APK assets before
  // expo-font runs, including Market tabs rendered while FontProvider is bypassed.
  it.each([
    'Roobert-Regular',
    'Roobert-Medium',
    'Roobert-SemiBold',
    'Roobert-Bold',
    'GeistMono-Regular',
    'GeistMono-Medium',
  ])('bundles %s with the same bytes used by the UI', (family) => {
    const fileName = `${family}.ttf`;
    const uiFont = fs.readFileSync(path.join(uiFontsDirectory, fileName));
    const androidFont = fs.readFileSync(
      path.join(androidFontsDirectory, fileName),
    );

    expect(uiFont.length).toBeGreaterThan(0);
    expect(androidFont.equals(uiFont)).toBe(true);
  });
});
