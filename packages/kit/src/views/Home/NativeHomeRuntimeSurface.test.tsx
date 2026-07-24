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
    const mobileViewModelAdapterSource = readSource(
      path.resolve(
        __dirname,
        '../../../../../apps/mobile/src/home/mobileNativeHomeViewModelAdapter.ts',
      ),
    );
    const mobileRendererDevSwitchSource = readSource(
      path.resolve(
        __dirname,
        '../../../../../apps/mobile/src/home/mobileHomeRendererDevSwitch.ts',
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
    const homeUiLoggerSource = readSource(
      path.resolve(
        __dirname,
        '../../../../shared/src/logger/scopes/wallet/scenes/homeUi.ts',
      ),
    );

    expect(nativeSurfaceSource).toContain(
      'const NativeRenderer = useNativeHomeRenderer();',
    );
    expect(nativeSurfaceSource).toContain("from './pages/HomePageViewLoader';");
    expect(nativeReactLoaderSource).toMatch(
      /import\(\s*['"]\.\/HomePageView['"]\s*\)/,
    );
    expect(nativeReactLoaderSource).not.toContain('HomeLaunchSkeleton');
    expect(reactLoaderSource).toContain(
      "export { HomePageView } from './HomePageView';",
    );
    expect(providerSource).not.toContain('@onekeyhq/native-components');
    expect(mobileAppSource).toContain(
      '<NativeHomeRendererProvider renderer={MobileNativeHomeRenderer}>',
    );
    expect(mobileAppSource).toContain(
      "from './src/home/MobileNativeHomeRenderer';",
    );
    expect(mobileAppSource).toMatch(
      /import\(\s*['"]@onekeyhq\/kit\/src\/views\/Home\/pages\/HomePageView['"]\s*\)/,
    );
    expect(mobileAppSource).not.toContain('HomeLaunchSkeleton');
    expect(mobileAppSource).not.toMatch(
      /import\s+\{\s*HomePageView\s*\}\s+from/,
    );
    expect(mobileAppSource).toContain('class MobileNativeHomeRendererBoundary');
    expect(mobileAppSource).not.toMatch(
      /import\(\s*['"]\.\/src\/home\/MobileNativeHomeRenderer['"]\s*\)/,
    );
    expect(mobileRendererSource).toContain(
      "from '@onekeyhq/native-components';",
    );
    expect(mobileRendererSource).toContain(
      "from '@onekeyhq/kit/src/views/Home/pages/HomePageViewLoader';",
    );
    expect(mobileRendererSource).not.toContain(
      "from '@onekeyhq/kit/src/views/Home/pages/HomePageView';",
    );
    expect(mobileRendererSource).toContain('<HomeContainer');
    expect(mobileRendererSource).toContain("execution: 'controller'");
    expect(mobileRendererSource).toContain('headerActionRow:');
    expect(mobileRendererSource).toContain(
      "slotId: 'header.balance' as IHomeContainerSlotKey",
    );
    expect(mobileRendererSource).toMatch(
      /balance:\s*\{\s*interaction:\s*'tap',\s*authority:\s*balanceAuthority,\s*content:\s*\(\s*<HomeOverviewContainer\s+nativeSlot/,
    );
    expect(mobileRendererSource).toContain('<HomeTabSearchHeader />');
    expect(mobileRendererSource).toContain('<WalletActions');
    expect(mobileRendererSource).toContain(
      'function MobileNativeHomeActionRowSkeleton()',
    );
    expect(mobileRendererSource).toContain(
      "const shouldShowActionRowSkeleton = header.actionLayout === 'loading';",
    );
    expect(mobileRendererSource).toContain(
      'testID={HomeTestIDs.walletActionsSkeleton}',
    );
    expect(mobileViewModelAdapterSource).toContain(
      "MOBILE_NATIVE_HOME_BANNER_SKELETON_ID = 'home-banner-loading'",
    );
    expect(mobileRendererSource).toContain(
      'resolveMobileNativeHomeBannerPresentation({',
    );
    expect(iosNativeSource).toContain(
      'bannerSkeletonId = "home-banner-loading"',
    );
    expect(androidNativeSource).toContain(
      'HOME_CONTAINER_BANNER_SKELETON_ID = "home-banner-loading"',
    );
    expect(mobileRendererSource).toContain('<NotBackedUpEmpty />');
    expect(mobileRendererSource).toContain('contentStates:');
    expect(mobileRendererSource).toContain(
      "slotId: 'content.state.defi' as IHomeContainerSlotKey",
    );
    expect(mobileRendererSource).toMatch(
      /platformEnv\.isNativeAndroid\s*&&\s*defiSection\.value\.kind === 'empty'/,
    );
    expect(mobileRendererSource).toContain('<EmptyDeFi tableLayout />');
    expect(mobileRendererSource).toContain('contentHeaders:');
    expect(mobileRendererSource).toContain('contentFooters:');
    expect(mobileRendererSource).toContain('tabAccessories:');
    expect(mobileRendererSource).toContain(
      'interaction.sectionControls.portfolio',
    );
    expect(mobileRendererSource).toContain('value={displayedShowLpTokensOnly}');
    expect(mobileRendererSource).toContain('height: header.actionRowHeight');
    expect(mobileRendererSource).toContain(
      'slotRevisions: collectSlotRevisions(slots)',
    );
    expect(mobileRendererSource).toContain(
      'defaultLogger.wallet.homeUi.homeNativeContentDecision(decision)',
    );
    expect(homeUiLoggerSource).toMatch(
      /@LogToLocal\(\{ level: 'info' \}\)\s+public homeNativeContentDecision/,
    );
    expect(mobileViewModelAdapterSource).toContain("renderer: 'history'");
    expect(mobileViewModelAdapterSource).toContain("renderer: 'market'");
    expect(mobileViewModelAdapterSource).toContain("renderer: 'earn'");
    expect(mobileViewModelAdapterSource).not.toMatch(
      /use[A-Z]\w+\(|backgroundApiProxy|usePromiseResult/,
    );
    expect(mobileRendererDevSwitchSource).toContain(
      'var __ONEKEY_HOME_RENDERER__',
    );
    expect(mobileRendererDevSwitchSource).toContain('useSyncExternalStore');
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
