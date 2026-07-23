import fs from 'fs';
import path from 'path';

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
}

describe('Home NFT Store authority', () => {
  it('keeps the renderer free of source lifecycle and persistence work', () => {
    const source = readSource('NFTListContainer.tsx');
    const forbiddenDependencies = [
      'backgroundApiProxy',
      'useAllNetworkRequests',
      'usePromiseResult',
      'useHomeStoreSourcePublisher',
      'useRegisterHomeBackgroundRecoveryRefresh',
      'getAccountLocalNFTs',
      'fetchAccountNFTs',
      'appEventBus.on',
    ];

    forbiddenDependencies.forEach((dependency) => {
      expect(source).not.toContain(dependency);
    });
    expect(source).toContain("useHomeResource('nft')");
    expect(source).toContain("useHomeSectionPayload('nft')");
  });

  it('physically retires the Native-only NFT producer/adapter', () => {
    expect(
      fs.existsSync(path.join(__dirname, '../useNativeHomeNFTData.ts')),
    ).toBe(false);
  });

  it('puts polling, events, cache and explicit request ownership in the controller source', () => {
    const controller = readSource('../model/react/HomeNFTStoreController.tsx');
    const source = readSource('../model/react/useHomeNFTStoreSource.ts');

    expect(controller).toContain('useHomeNFTStoreSource');
    expect(controller).toContain('useRegisterHomeBackgroundRecoveryRefresh');
    expect(source).toContain('useAllNetworkRequests');
    expect(source).toContain('POLLING_INTERVAL_FOR_NFT');
    expect(source).toContain('getAccountLocalNFTs');
    expect(source).toContain('fetchAccountNFTs');
    expect(source).toContain('beginHomeSectionRequest');
    expect(source).toContain('completeHomeSectionRequest');
  });
});
