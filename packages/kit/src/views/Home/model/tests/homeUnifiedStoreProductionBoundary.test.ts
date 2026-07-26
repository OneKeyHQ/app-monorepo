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
        /createHomeResultSink|HomeRequestScheduler|fetchAccountTokens|fetchAccountNFTs|fetchAccountDeFiPositions|fetchAccountHistory|fetchWalletBanner/,
      );
    },
  );

  it('mounts one Store-scoped runtime and no controller forest', () => {
    const root = readHomeFile('model/react/HomeStoreSourceControllers.tsx');
    expect(root).toContain('<HomeRuntimeRoot mode={mode}>');
    expect(root).not.toMatch(
      /HomeReadySourceControllers|HomeStoreCommandController|HomeDisplaySnapshotController|HomePortfolioStoreController/,
    );
  });

  it('keeps sources lifecycle-neutral and forces publication through the sink', () => {
    const source = readHomeFile('model/sources/homeSourceRuntime.ts');
    expect(source).not.toMatch(/from ['"]react['"]|useHome[A-Z]/);
    expect(source).toContain('createHomeResultSink({');
    expect(source).toContain('this.host.commitBudget.submit({');
    expect(source).toContain('this.host.dispatchAtomically(');
  });

  it('keeps the generic scheduler independent of Home sections', () => {
    const scheduler = readHomeFile('model/scheduler/homeRequestScheduler.ts');
    const leafPool = readHomeFile('model/scheduler/homeLeafRequestPool.ts');
    expect(`${scheduler}\n${leafPool}`).not.toMatch(
      /\b(?:portfolio|perps|defi|nft|history|market)\b/i,
    );
  });

  it('physically removes the old production runtime', () => {
    for (const relativePath of [
      'model/lifecycle/homeSessionCoordinator.ts',
      'model/react/HomeStoreControllerBridge.tsx',
      'model/react/HomeReadySourceControllers.tsx',
      'model/react/HomeStoreCommandController.tsx',
      'model/react/HomeDisplaySnapshotController.shared.tsx',
      'model/react/useHomeStoreSourcePublisher.ts',
      'model/react/useHomeStoreControllerActions.ts',
      'components/TokenListBlock/HomePortfolioStoreController.tsx',
      'pages/HomeBackgroundRecoveryRefreshProvider.tsx',
      'pages/usePerpsHomePortfolio.ts',
    ]) {
      expect(fs.existsSync(path.join(homeRoot, relativePath))).toBe(false);
    }
  });

  it('keeps live reducer and Native render decisions free of deep serialization', () => {
    for (const relativePath of [
      'model/store/homeStoreReducer.ts',
      'model/store/homeStoreInvariants.ts',
      'model/store/homeStoreJson.ts',
    ]) {
      expect(readHomeFile(relativePath)).not.toMatch(
        /stableStringify|JSON\.stringify|JSON\.parse|cloneDeep|\bisEqual\b/,
      );
    }
    const mobileRenderer = [
      'MobileNativeHomeRenderer.tsx',
      'MobileNativeHomeRendererBridged.tsx',
      'MobileNativeHomeBridgeRuntime.ts',
    ]
      .map((fileName) =>
        fs.readFileSync(
          path.resolve(
            homeRoot,
            `../../../../../apps/mobile/src/home/${fileName}`,
          ),
          'utf8',
        ),
      )
      .join('\n');
    expect(mobileRenderer).not.toMatch(
      /stableStringify|JSON\.stringify|JSON\.parse|cloneDeep|\bisEqual\b/,
    );
    expect(mobileRenderer).not.toContain('useHomeCommitIdentity');
    expect(mobileRenderer).toContain('MobileNativeHomePortfolioBridge');
    expect(mobileRenderer).toContain('MobileNativeHomeNFTBridge');
  });
});
