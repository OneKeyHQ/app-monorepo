// cspell: words jsxs unifold Unifold
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const sdkCommonJsPath = require.resolve('@unifold/connect-react-native');
const sdkDistDirectory = dirname(sdkCommonJsPath);

const sdkBundles = [
  [
    'CommonJS',
    readFileSync(sdkCommonJsPath, 'utf8'),
    'jsxRuntime.jsxs',
    "reactNativeScreens=require('react-native-screens')",
    'reactNative.Platform.OS==="ios"?jsxRuntime.jsxs(reactNativeScreens.FullWindowOverlay',
  ],
  [
    'ES module',
    readFileSync(join(sdkDistDirectory, 'index.mjs'), 'utf8'),
    'jsxs',
    "import {FullWindowOverlay}from'react-native-screens'",
    'Platform.OS==="ios"?jsxs(FullWindowOverlay',
  ],
] as const;

describe('Unifold native sheet patch', () => {
  it.each(sdkBundles)(
    'animates inline sheets and uses FullWindowOverlay for iOS child sheets in the %s bundle',
    (_, source, _jsxs, screensImport, iosOverlayBranch) => {
      expect(source).toContain(
        'useAnimatedStyle(()=>({transform:[{translateY:Z.value}]}))',
      );
      expect(source).toContain('style:[Ei.sheet,de,{height:B');
      expect(source).toContain(screensImport);
      expect(source).toContain(iosOverlayBranch);
      expect(source).toContain('return w?');
    },
  );

  it.each(sdkBundles)(
    'renders only the root Deposit sheet inline in the %s bundle',
    (_, source, jsxs) => {
      expect(source).toContain(
        `return ${jsxs}(rr,{useModal:false,visible:e,onClose:_==="main"`,
      );
    },
  );
});
