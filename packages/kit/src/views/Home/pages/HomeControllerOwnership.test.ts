import fs from 'fs';
import path from 'path';

const sourceControllerNames = [
  'HomeBalanceStoreController',
  'HomeBannerStoreController',
  'HomeCapabilityStoreController',
  'HomeDeFiStoreController',
  'HomeHistoryStoreController',
  'HomeMarketStoreController',
  'HomeNFTStoreController',
  'HomePerpsStoreController',
  'HomePortfolioStoreController',
  'HomeStoreControllerBridge',
  'HomeDisplaySnapshotController',
];

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
}

describe('Home root controller ownership', () => {
  it('keeps the Header read-only', () => {
    const source = readSource('HomeHeaderContainer.tsx');
    sourceControllerNames.forEach((controllerName) => {
      expect(source).not.toContain(controllerName);
    });
  });

  it('mounts only the root controller group from Wallet Home', () => {
    const source = readSource('HomePageContainer.tsx');
    expect(source).toContain(
      '<HomeStoreSourceControllers enableWalletSources>',
    );
    expect(source).toMatch(
      /<HomeBackgroundRecoveryRefreshProvider>[\s\S]*<HomeStoreSourceControllers enableWalletSources>/,
    );
    expect(source).toContain('config={HOME_STORE_CONTEXT_CONFIG}');
    expect(source).toContain('store={homeStore}');
    expect(source).not.toMatch(/config=\{\{\s*sceneId:/);
    sourceControllerNames.forEach((controllerName) => {
      expect(source).not.toContain(controllerName);
    });
  });

  it('mounts only the root controller group per URL Account Provider', () => {
    const source = readSource('urlAccount/UrlAccountPage.tsx');
    expect(source.match(/<HomeStoreSourceControllers \/>/g)).toHaveLength(2);
    expect(
      source.match(/config=\{URL_ACCOUNT_HOME_STORE_CONTEXT_CONFIG\}/g),
    ).toHaveLength(2);
    expect(source.match(/store=\{homeStore\}/g)).toHaveLength(2);
    expect(source).not.toMatch(/config=\{\{\s*sceneId:/);
    sourceControllerNames.forEach((controllerName) => {
      expect(source).not.toContain(controllerName);
    });
  });
});
