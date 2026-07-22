import fs from 'fs';
import path from 'path';

import { isNativeHomeEnabled } from './nativeHomeFeatureFlag.native';

function readSource(fileName: string) {
  return fs.readFileSync(
    path.isAbsolute(fileName) ? fileName : path.join(__dirname, fileName),
    'utf8',
  );
}

function listProductionSourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return listProductionSourceFiles(absolutePath);
    }
    if (
      !/\.tsx?$/.test(entry.name) ||
      /\.(?:test|spec)\.tsx?$/.test(entry.name)
    ) {
      return [];
    }
    return [absolutePath];
  });
}

describe('Native Home runtime surface', () => {
  it('injects the app-owned Native renderer through the kit provider boundary', () => {
    const nativeSurfaceSource = readSource('NativeHomePageView.native.tsx');
    const providerSource = readSource('NativeHomeRendererProvider.tsx');
    const nativeReactLoaderSource = readSource(
      'pages/HomePageViewLoader.native.tsx',
    );
    const reactLoaderSource = readSource('pages/HomePageViewLoader.tsx');
    const mobileAppSource = readSource(
      path.resolve(__dirname, '../../../../../apps/mobile/App.tsx'),
    );
    const mobileRendererSource = readSource(
      path.resolve(
        __dirname,
        '../../../../../apps/mobile/src/home/MobileNativeHomeRenderer.tsx',
      ),
    );
    const iosNativeSource = readSource(
      path.resolve(
        __dirname,
        '../../../../native-components/ios/HomeContainerView.swift',
      ),
    );
    const androidNativeSource = readSource(
      path.resolve(
        __dirname,
        '../../../../native-components/android/src/main/java/com/margelo/nitro/onekeynativecomponents/HomeContainerView.kt',
      ),
    );

    expect(nativeSurfaceSource).toContain(
      'const NativeRenderer = useNativeHomeRenderer();',
    );
    expect(nativeSurfaceSource).toContain("from './pages/HomePageViewLoader';");
    expect(nativeReactLoaderSource).toMatch(
      /import\(\s*['"]\.\/HomePageView['"]\s*\)/,
    );
    expect(reactLoaderSource).toContain(
      "export { HomePageView } from './HomePageView';",
    );
    expect(providerSource).not.toContain('@onekeyhq/native-components');
    expect(mobileAppSource).toContain(
      '<NativeHomeRendererProvider renderer={MobileNativeHomeRenderer}>',
    );
    expect(mobileAppSource).toMatch(
      /import\(\s*['"]\.\/src\/home\/MobileNativeHomeRenderer['"]\s*\)/,
    );
    expect(mobileAppSource).not.toMatch(
      /import\s+\{\s*MobileNativeHomeRenderer\s*\}\s+from/,
    );
    expect(mobileRendererSource).toContain(
      "from '@onekeyhq/native-components';",
    );
    expect(mobileRendererSource).toContain('<HomeContainer');
    expect(mobileRendererSource).toContain("execution: 'controller'");
    expect(mobileRendererSource).toContain('headerActionRow:');
    expect(mobileRendererSource).toContain('<HomeTabSearchHeader />');
    expect(mobileRendererSource).toContain('<WalletActions');
    expect(mobileRendererSource).toContain('<NotBackedUpEmpty />');
    expect(mobileRendererSource).toContain('contentStates:');
    expect(mobileRendererSource).toContain('height: header.actionRowHeight');
    expect(mobileRendererSource).toContain(
      '[backupStateAuthority.slotId]: backupStateAuthority.slotRevision',
    );
    expect(iosNativeSource).toContain(
      'let hasMountedSlot = mountedSlotKeys.contains("header.action-row")',
    );
    expect(androidNativeSource).toContain(
      'val hasMountedSlot = mountedSlotKeys.contains("header.action-row")',
    );
    expect(mobileRendererSource).not.toMatch(
      /backgroundApiProxy|maybeOpenPrivateSendHistoryDetail|serviceHistory/,
    );
  });

  it('has no production Home module importing legacy NativeHomePage', () => {
    const legacyImportPattern =
      /(?:from\s+|import\(\s*)['"][^'"]*\/NativeHomePage['"]/;
    const legacyImporters = listProductionSourceFiles(__dirname)
      .filter((filePath) => legacyImportPattern.test(readSource(filePath)))
      .map((filePath) => path.relative(__dirname, filePath));

    expect(legacyImporters).toEqual([]);
  });

  it('physically retires the old Native business host and source adapters', () => {
    const retiredFiles = [
      'NativeHomePage.native.tsx',
      'NativeHomePage.tsx',
      'NativeHomePage.types.ts',
      'useNativeHomeBannersData.ts',
      'useNativeHomeDeFiData.ts',
      'useNativeHomeHistoryData.ts',
      'useNativeHomeLpTokenData.ts',
      'useNativeHomeNFTData.ts',
      'useNativeHomePortfolioData.ts',
      'useNativeHomeSupplementalData.ts',
    ];

    retiredFiles.forEach((fileName) => {
      expect(fs.existsSync(path.join(__dirname, fileName))).toBe(false);
    });
  });

  it('keeps the developer flag contract without consulting HomeContainer', () => {
    expect(isNativeHomeEnabled()).toBe(true);
    expect(isNativeHomeEnabled(true)).toBe(true);
    expect(isNativeHomeEnabled(false)).toBe(false);
  });
});
