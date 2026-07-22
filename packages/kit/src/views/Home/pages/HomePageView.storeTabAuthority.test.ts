import fs from 'fs';
import path from 'path';

describe('HomePageView Store tab authority', () => {
  it('uses Store navigation as the only selected tab id authority', () => {
    const source = fs.readFileSync(
      path.join(__dirname, 'HomePageView.tsx'),
      'utf8',
    );

    expect(source).toContain(
      'homeWalletCapabilityTabModel.selectedTabId as EHomeWalletTab',
    );
    expect(source).toContain('activeTabId: selectedTabId');
    expect(source).not.toContain('selectedTabIdRef');
    expect(source).not.toContain('useRegisterHomeBackgroundRecoveryRefresh');
    expect(source).not.toContain('EAppEventBusNames.RefreshTokenList');
    expect(source).not.toContain('refreshByProvidedAccounts');
    expect(source).not.toContain('setActiveTabId');
    expect(source).not.toMatch(
      /useState<EHomeWalletTab\s*\|\s*undefined>\s*\(/,
    );
  });

  it('keeps the local tab state limited to the pager name mirror', () => {
    const source = fs.readFileSync(
      path.join(__dirname, 'HomePageView.tsx'),
      'utf8',
    );

    expect(source).toContain(
      'const [pagerTabName, setPagerTabName] = useState(initialPagerTabName)',
    );
    expect(source).toContain('pendingPagerTabIdRef');
    expect(source).not.toContain('const [activeTabName');
  });
});
