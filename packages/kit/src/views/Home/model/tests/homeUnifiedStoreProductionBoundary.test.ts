import fs from 'fs';
import path from 'path';

const homeRoot = path.join(__dirname, '../..');

function readHomeFile(relativePath: string) {
  return fs.readFileSync(path.join(homeRoot, relativePath), 'utf8');
}

describe('Home Unified Store production boundary', () => {
  const rendererFiles = [
    'components/TokenListBlock/TokenListBlock.tsx',
    'pages/PerpsContainer.tsx',
    'components/DeFiListBlock/DeFiListBlock.tsx',
    'pages/DeFiContainer.tsx',
    'pages/NFTListContainer.tsx',
    'pages/TxHistoryContainer.tsx',
    'components/PopularTrading/PopularTrading.tsx',
    'components/WalletBanner/WalletBanner.tsx',
  ];

  it.each(rendererFiles)(
    '%s cannot publish or own a Home source request lifecycle',
    (relativePath) => {
      const source = readHomeFile(relativePath);
      expect(source).not.toMatch(
        /useHomeStoreSourcePublisher|beginHome(?:Section|Source)Request|completeHome(?:Section|Source)Request|publishHomeSectionSource|useMarketPerpsTokenList|useHomeMarketCategoryTokens|useHomeTokenListSnapshot|useAddressesInfoAtom|backgroundApiProxy/,
      );
    },
  );

  it('mounts each wallet source controller once at the scene root', () => {
    const source = readHomeFile('model/react/HomeReadySourceControllers.tsx');
    for (const controllerName of [
      'HomePortfolioStoreController',
      'HomeAccountValuePersistenceController',
      'HomePerpsStoreController',
      'HomeDeFiStoreController',
      'HomeHistoryStoreController',
      'HomeNFTStoreController',
      'HomeMarketStoreController',
      'HomeBannerStoreController',
    ]) {
      expect(
        source.match(new RegExp(`<${controllerName}\\b`, 'g')),
      ).toHaveLength(1);
    }
    const root = readHomeFile('model/react/HomeStoreSourceControllers.tsx');
    expect(root.match(/<HomeStoreCommandController\b/g)).toHaveLength(1);
    expect(root).toMatch(
      /walletSourcesReady[\s\S]*<HomeReadySourceControllers/,
    );
  });

  it('physically retires the Native-only business host and source hooks', () => {
    for (const relativePath of [
      'NativeHomePage.native.tsx',
      'NativeHomePage.tsx',
      'NativeHomePage.types.ts',
      'useNativeHomeBannersData.ts',
      'useNativeHomeDeFiData.ts',
      'useNativeHomeHistoryData.ts',
      'useNativeHomeNFTData.ts',
      'useNativeHomePortfolioData.ts',
      'useNativeHomeSupplementalData.ts',
      'nativeHomeBalanceAuthority.ts',
      'useNativeHomeBalanceAmountPresentation.ts',
      'nativeHomeDataAdapters.ts',
    ]) {
      expect(fs.existsSync(path.join(homeRoot, relativePath))).toBe(false);
    }
  });

  it('has no legacy section publication API in the source gateway', () => {
    const source = readHomeFile('model/react/useHomeStoreSourcePublisher.ts');
    expect(source).not.toContain('publishHomeSectionSource');
    expect(source).not.toMatch(/\bpublish\s*\(/);
    expect(source).toContain('beginHomeSectionRequest');
    expect(source).toContain('completeHomeSectionRequest');
  });

  it('keeps capability publication and confirmed state in the Store controller', () => {
    expect(
      fs.existsSync(
        path.join(homeRoot, 'model/react/useHomeNavigationCoordinator.ts'),
      ),
    ).toBe(false);
    const capabilityController = readHomeFile(
      'model/react/HomeCapabilityStoreController.tsx',
    );
    const supportSource = readHomeFile('hooks/useHomeWalletTabSupport.ts');
    expect(capabilityController).toContain('publishHomeCapabilitySource');
    expect(supportSource).not.toMatch(
      /confirmedByScope|rememberConfirmedHomeWalletTabSupport|\bresolveHomeWalletTabSupport\b/,
    );
  });

  it('hydrates an owner-scoped snapshot without gating the launch renderer', () => {
    const root = readHomeFile('model/react/HomeStoreSourceControllers.tsx');
    const pageContainerSource = readHomeFile('pages/HomePageContainer.tsx');
    const sharedSource = readHomeFile(
      'model/react/HomeDisplaySnapshotController.shared.tsx',
    );
    const nativeSource = readHomeFile(
      'model/react/HomeDisplaySnapshotController.native.tsx',
    );
    expect(root).toContain(
      "import { HomeDisplaySnapshotController } from './HomeDisplaySnapshotController';",
    );
    expect(root).not.toMatch(
      /LazyLoad[\s\S]*import\('\.\/HomeDisplaySnapshotController'\)/,
    );
    expect(sharedSource).toContain('useLayoutEffect(() => {');
    expect(sharedSource).not.toContain('yieldToHomeRenderer');
    expect(sharedSource).toContain('const bannerLoad = loadSourceChunk({');
    expect(sharedSource).toContain('const selectedLoad = loadSourceChunk({');
    expect(sharedSource).toContain("sourceId: 'banner'");
    expect(sharedSource).toContain('sourceId: selectedSourceId');
    expect(sharedSource).toContain('sourceIds: [sourceId]');
    expect(sharedSource).toContain('publishLoadStatus(initialDisplayReady ?');
    expect(sharedSource).not.toContain(
      'const bannerRecordCount = await loadSourceChunk({\n' +
        '          candidateOwnerToken: ownerToken,\n' +
        '          context,\n' +
        "          sourceId: 'banner'",
    );
    expect(sharedSource).not.toContain(
      "new Set<IHomeStoreSourceId>(['banner', selectedSourceId])",
    );
    expect(nativeSource).toContain(
      'const displaySnapshot = loadPreparedHomeDisplaySnapshot({',
    );
    expect(nativeSource).not.toMatch(
      /await loadPreparedHomeDisplaySnapshot|void loadPreparedHomeDisplaySnapshot/,
    );
    expect(nativeSource).toContain('publishPreparedHomeDisplaySnapshot({');
    expect(pageContainerSource).not.toContain('walletRendererReady');
    expect(pageContainerSource).not.toContain(
      'nativeDisplaySnapshotLoadSettled',
    );
  });

  it('derives every Header balance contributor from the Home Store', () => {
    const source = readHomeFile('model/react/useHomeBalanceFacts.ts');
    for (const sourceId of ['portfolio', 'perps', 'defi']) {
      expect(source).toContain(`useHomeResource('${sourceId}')`);
      expect(source).toContain(`useHomeSectionPayload('${sourceId}')`);
    }
    expect(source).toContain('storeFacts.ownerToken.scopeKey');
    expect(source).not.toMatch(
      /useAccountWorthAtom|useAccountDeFiOverviewAtom|useOverviewDeFiDataStateAtom|useListStructureAtom/,
    );
  });
});
