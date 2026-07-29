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
    const homeStoreControllerBridgeSource = readSource(
      'model/react/HomeStoreControllerBridge.tsx',
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
    const nativeSpecSource = readSource(
      path.resolve(
        __dirname,
        '../../../../native-components/src/HomeContainer.nitro.ts',
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
    expect(nativeSurfaceSource).not.toContain(
      "from './pages/HomePageViewLoader';",
    );
    expect(nativeSurfaceSource).toContain(
      "throw new OneKeyLocalError('Native Home renderer is not registered');",
    );
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
    expect(mobileAppSource).not.toContain(
      'class MobileNativeHomeRendererBoundary',
    );
    expect(mobileAppSource).not.toMatch(
      /import\(\s*['"]\.\/src\/home\/MobileNativeHomeRenderer['"]\s*\)/,
    );
    expect(mobileRendererSource).toContain(
      "from '@onekeyhq/native-components';",
    );
    expect(mobileRendererSource).not.toContain(
      "from '@onekeyhq/kit/src/views/Home/pages/HomePageViewLoader';",
    );
    expect(mobileRendererSource).not.toContain(
      "from '@onekeyhq/kit/src/views/Home/pages/HomePageView';",
    );
    expect(mobileRendererSource).toContain('<HomeContainer');
    expect(mobileRendererSource).toContain('state={nativeState}');
    expect(mobileRendererSource).toContain('onIntent={handleIntent}');
    expect(mobileRendererSource).not.toContain('onVisibleTabChange=');
    expect(mobileRendererSource).toContain(
      'acceptTabSelection(parsed.intent.tabId);',
    );
    expect(mobileRendererSource).not.toContain('nativeUnavailable');
    expect(mobileRendererSource).not.toContain('fallback=');
    expect(mobileRendererSource).not.toContain('nativeSurfaceRevealed');
    expect(nativeSpecSource).toContain(
      'onIntent?: (intentJson: string) => void;',
    );
    expect(nativeSpecSource).not.toMatch(
      /on(?:Action|Refresh|VisibleTabChange)\?:/,
    );
    expect(mobileRendererSource).toMatch(
      /useEffect\(\(\) => \(\) => disposeNativeSession\(\), \[disposeNativeSession\]\);/,
    );
    expect(mobileRendererSource).not.toMatch(
      /useLayoutEffect\(\(\) => \(\) => disposeNativeSession\(\), \[disposeNativeSession\]\);/,
    );
    expect(homeStoreControllerBridgeSource).not.toContain('useLayoutEffect');
    expect(homeStoreControllerBridgeSource).toContain(
      'const releaseControllerLease = acquireHomeStoreControllerLease({',
    );
    expect(mobileRendererSource).toContain("execution: 'controller'");
    expect(mobileRendererSource).toContain(
      'const HOME_REFRESH_FEEDBACK_DURATION_MS = 1200;',
    );
    expect(mobileRendererSource).toContain(
      '}, HOME_REFRESH_FEEDBACK_DURATION_MS);',
    );
    expect(mobileRendererSource).not.toContain('seenRefreshing');
    expect(mobileRendererSource).not.toContain('15_000');
    expect(mobileRendererSource).toContain('headerActionRow:');
    expect(mobileRendererSource).not.toContain('slotRevision:');
    expect(mobileRendererSource).toMatch(
      /balance:\s*\{\s*interaction:\s*'tap',\s*content:\s*\(\s*<HomeOverviewContainer\s+nativeSlot/,
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
    expect(mobileRendererSource).toContain(
      'resolveMobileNativeHomeBodySections({',
    );
    expect(mobileRendererSource).toContain('contentStates:');
    expect(mobileRendererSource).toMatch(
      /defiSection\.value\.kind === 'empty'[\s\S]*defiSection\.value\.kind === 'error'/,
    );
    expect(mobileRendererSource).not.toContain(
      'platformEnv.isNativeAndroid && defiSection.value.kind',
    );
    expect(mobileRendererSource).toContain('<EmptyDeFi tableLayout />');
    expect(mobileRendererSource).toContain('contentHeaders:');
    expect(mobileRendererSource).toContain('contentFooters:');
    expect(mobileRendererSource).toContain('tabAccessories:');
    expect(mobileRendererSource).toContain(
      'interaction.sectionControls.portfolio',
    );
    expect(mobileRendererSource).toContain(
      'resolveHomePortfolioLpTokenSwitch({',
    );
    expect(mobileRendererSource).toContain(
      'resolveMobileNativeHomePortfolioFilterPresentation({',
    );
    expect(mobileRendererSource).toContain(
      'value={portfolioFilterPresentation.value}',
    );
    expect(mobileRendererSource).toContain(
      'portfolioOwnerLoading || lpTokenSwitch.loading',
    );
    expect(mobileRendererSource).toContain(
      'lastCommittedPortfolioSectionsRef.current',
    );
    expect(mobileRendererSource).toContain(
      'lastCommittedTabTopologyRef.current',
    );
    expect(mobileRendererSource).toContain(
      'resolveMobileNativeHomePortfolioSections({',
    );
    expect(mobileRendererSource).toContain(
      'portfolioAssetsLoading: lpTokenSwitch.loading',
    );
    expect(mobileRendererSource).toContain('height: header.actionRowHeight');
    expect(mobileRendererSource).not.toContain('collectSlotRevisions');
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

  it('keeps React slot presentation stable while native owner authority switches', () => {
    const nativeBridgeSource = readSource(
      path.resolve(
        __dirname,
        '../../../../native-components/src/HomeContainer.native.tsx',
      ),
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
    const iosSurfaceSource = readSource(
      path.resolve(
        __dirname,
        '../../../../native-components/ios/HomeContainerSurfaceComponentView.mm',
      ),
    );
    const androidNativeSource = readSource(
      path.resolve(
        __dirname,
        '../../../../native-components/android/src/main/java/com/margelo/nitro/onekeynativecomponents/HomeContainerView.kt',
      ),
    );
    const androidSurfaceSource = readSource(
      path.resolve(
        __dirname,
        '../../../../native-components/android/src/main/java/com/margelo/nitro/onekeynativecomponents/HomeContainerSurfaceView.kt',
      ),
    );
    const androidSlotSource = readSource(
      path.resolve(
        __dirname,
        '../../../../native-components/android/src/main/java/com/margelo/nitro/onekeynativecomponents/HomeContainerSlotView.kt',
      ),
    );

    expect(nativeBridgeSource).toContain('const presentedBundle = slotBundle;');
    expect(nativeBridgeSource).not.toContain('const authoritativeBundle');
    expect(iosSurfaceSource).toContain(
      '- (NSArray<NSString *> *)presentedSlotKeys',
    );
    expect(iosSurfaceSource).toContain(
      'slot.accessibilityElementsHidden = !ownsSlot;',
    );
    expect(iosSurfaceSource).not.toContain(
      'slot.slotKey.length > 0 && ownsSlot',
    );
    expect(androidSurfaceSource).toContain('val presentedSlotKeys = slots');
    expect(androidSurfaceSource).toContain('slot.ownerAuthorized =');
    expect(androidNativeSource).toMatch(
      /updateSharedChromeLayout\(\)\s*onSlotLayoutChange\?\.invoke\(\)/,
    );
    expect(androidNativeSource).toContain(
      'adapter.pages().forEach(HomePageView::resetViewportForOwnerChange)',
    );
    expect(androidNativeSource).not.toMatch(
      /private fun resetViewportForOwnerChange\(\) \{[^}]*pager\.adapter = null/s,
    );
    expect(androidSlotSource).toContain(
      'if (ownerAuthorized) super.dispatchTouchEvent(event) else true',
    );

    expect(mobileRendererSource).not.toContain('function formatShellBalance');
    expect(mobileRendererSource).toMatch(/accountName:\s*'',\s*balance:\s*'',/);
    expect(iosNativeSource).toContain('private let balanceAnchor = UIView()');
    expect(iosNativeSource).toMatch(
      /layoutIfNeeded\(\)\s*slotLayoutDidChange\?\(\)/,
    );
    expect(iosNativeSource).toContain(
      'pages.forEach { $0.prepareViewportForOwnerChange() }',
    );
    expect(iosNativeSource).not.toContain(
      'pages.forEach { $0.removeFromSuperview() }',
    );
    expect(iosNativeSource).toContain(
      'allowsAnimatedDifferences: !ownerChanged',
    );
    expect(iosNativeSource).toContain(
      'let requiresRebuild = homeContainerTabsRequireRebuild(',
    );
    expect(iosNativeSource).not.toContain('balanceButton');
    expect(iosNativeSource).not.toContain('balanceSkeletonView');
    expect(androidNativeSource).toContain(
      'private val balanceContainer = HomeContainerSlotHostView(context)',
    );
    expect(androidNativeSource).not.toContain('balanceButton');
    expect(androidNativeSource).not.toContain('balanceSkeletonView');
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
