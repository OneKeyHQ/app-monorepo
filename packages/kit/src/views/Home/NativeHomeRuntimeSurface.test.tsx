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
    const mobileRendererSource = [
      'MobileNativeHomeRenderer.tsx',
      'MobileNativeHomeRendererBridged.tsx',
      'MobileNativeHomeBridgeRuntime.ts',
    ]
      .map((fileName) =>
        readSource(
          path.resolve(
            __dirname,
            `../../../../../apps/mobile/src/home/${fileName}`,
          ),
        ),
      )
      .join('\n');
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
    expect(mobileRendererSource).toContain('initialSnapshot={initialSnapshot}');
    expect(mobileRendererSource).not.toContain('nativeUnavailable');
    expect(mobileRendererSource).not.toContain('fallback=');
    expect(mobileRendererSource).not.toContain('nativeSurfaceRevealed');
    expect(mobileRendererSource).not.toMatch(
      /execution:\s*['"](?:caller|controller)['"]/,
    );
    expect(mobileRendererSource).not.toContain('stableStringify');
    expect(mobileRendererSource).toContain(
      'const HOME_REFRESH_FEEDBACK_DURATION_MS = 1200;',
    );
    expect(mobileRendererSource).toContain(
      '}, HOME_REFRESH_FEEDBACK_DURATION_MS);',
    );
    expect(mobileRendererSource).not.toContain('seenRefreshing');
    expect(mobileRendererSource).not.toContain('15_000');
    expect(mobileRendererSource).toContain('headerActionRow:');
    expect(mobileRendererSource).toMatch(
      /runtime\.authority\(\s*'header\.balance',/,
    );
    expect(mobileRendererSource).toContain(
      'shell.balancePresentationRevision,',
    );
    expect(mobileRendererSource).toContain(
      'shell.actionsPresentationRevision,',
    );
    expect(mobileRendererSource).toContain('shell.bodyPresentationRevision,');
    expect(mobileRendererSource).toMatch(
      /balance:\s*\{\s*interaction:\s*'tap',\s*authority:\s*runtime\.authority\([\s\S]*?content:\s*\(\s*<HomeBalanceSlotView/,
    );
    expect(mobileRendererSource).not.toContain('<HomeOverviewContainer');
    expect(mobileRendererSource).toContain('<MemoHomeTabSearchHeader />');
    expect(mobileRendererSource).toContain('<WalletActions');
    expect(mobileRendererSource).toContain(
      'function MobileNativeHomeActionRowSkeleton()',
    );
    expect(mobileRendererSource).toContain(
      "header.actionLayout === 'loading' ||",
    );
    expect(mobileRendererSource).toContain('deferHeavyWorkUntilUIIdle');
    expect(mobileRendererSource).toContain(
      'MobileNativeHomeActionRowActivation.release',
    );
    expect(mobileRendererSource).toContain(
      'useAccountSelectorActiveAccountReloadRequestsAtom',
    );
    expect(mobileRendererSource).toContain(
      'const MobileNativeHomeWalletActions = memo(',
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
      /runtime\.authority\(\s*'content\.state\.defi',/,
    );
    expect(mobileRendererSource).toMatch(
      /section\.value\.kind === 'empty'[\s\S]*section\.value\.kind === 'error'/,
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
    expect(mobileRendererSource).toContain('value={displayedLp}');
    expect(mobileRendererSource).toContain('height: header.actionRowHeight');
    expect(mobileRendererSource).toContain(
      'slotContractRevision: HOME_CONTAINER_SLOT_CONTRACT_REVISION,',
    );
    expect(mobileRendererSource).toContain('slots: merged,');
    expect(mobileRendererSource).toContain(
      'const MobileNativeHomePortfolioBridge = memo(',
    );
    expect(mobileRendererSource).toContain(
      'const MobileNativeHomeNFTBridge = memo(',
    );
    expect(mobileRendererSource).toContain(
      'const MOBILE_NATIVE_HOME_INITIAL_ACTIVATED_TAB_IDS',
    );
    expect(mobileRendererSource).toContain("activatedTabIds.has('perps') ?");
    expect(mobileRendererSource).toContain("activatedTabIds.has('history') ?");
    expect(mobileRendererSource).toContain(
      'onVisibleTabChange={handleVisibleTabChange}',
    );
    expect(mobileRendererSource).toContain(
      'buildMobileNativeHomeLoadingSections(tabId)',
    );
    expect(iosNativeSource).toContain('onVisibleTabChange?(nextTabId)');
    expect(androidNativeSource).toContain(
      'onVisibleTabChange?.invoke(targetTab.id)',
    );
    expect(mobileRendererSource).toMatch(
      /<MobileNativeHomeHistoryBridge[\s\S]*?runtime=\{runtime\}[\s\S]*?\/>/,
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
