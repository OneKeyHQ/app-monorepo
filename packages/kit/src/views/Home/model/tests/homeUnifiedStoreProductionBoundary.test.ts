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

  it('hydrates Header, Banner, and the visible section without a shared paint barrier', () => {
    const root = readHomeFile('model/react/HomeStoreSourceControllers.tsx');
    const source = readHomeFile(
      'model/react/HomeDisplaySnapshotController.tsx',
    );
    expect(root).toContain(
      "import { HomeDisplaySnapshotController } from './HomeDisplaySnapshotController';",
    );
    expect(root).not.toMatch(
      /LazyLoad[\s\S]*import\('\.\/HomeDisplaySnapshotController'\)/,
    );
    expect(source).toContain('useLayoutEffect(() => {');
    expect(source).toContain('await yieldToHomeRenderer()');
    expect(source).toContain('const bannerLoad = loadSourceChunk({');
    expect(source).toContain('const selectedLoad = loadSourceChunk({');
    expect(source).toContain("sourceId: 'banner'");
    expect(source).toContain('sourceId: selectedSourceId');
    expect(source).toContain('sourceIds: [sourceId]');
    expect(source).not.toContain(
      'const bannerRecordCount = await loadSourceChunk({\n' +
        '          candidateOwnerToken: ownerToken,\n' +
        '          context,\n' +
        "          sourceId: 'banner'",
    );
    expect(source).not.toContain(
      "new Set<IHomeStoreSourceId>(['banner', selectedSourceId])",
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
