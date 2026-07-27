import fs from 'fs';
import path from 'path';

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
}

describe('Home runtime ownership', () => {
  it('mounts the wallet Store through the single runtime root', () => {
    const page = readSource('HomePageContainer.tsx');
    const root = readSource('../model/react/HomeStoreSourceControllers.tsx');

    expect(page).toContain('<HomeStoreSourceControllers enableWalletSources>');
    expect(page).not.toContain('HomeBackgroundRecoveryRefreshProvider');
    expect(root).toContain('<HomeRuntimeRoot mode={mode}>');
    expect(root).not.toContain('HomeReadySourceControllers');
  });

  it('keeps the Native Home surface identity independent from the owner', () => {
    const page = readSource('HomePageContainer.tsx');

    expect(page).toContain('<NativeHomePageView');
    expect(page).not.toMatch(/key=\{`native-\$\{sceneName\}-/);
  });

  it('creates URL Account runtimes with URL mode and no wallet source execution', () => {
    const page = readSource('urlAccount/UrlAccountPage.tsx');
    const root = readSource('../model/react/HomeStoreSourceControllers.tsx');
    const lease = readSource('../model/runtime/homeRuntimeLease.ts');

    expect(page.match(/<HomeStoreSourceControllers \/>/g)).toHaveLength(2);
    expect(root).toMatch(
      /const mode = enableWalletSources \? ['"]wallet['"] : ['"]urlAccount['"];/,
    );
    expect(lease).toContain('sourceExecution: false');
  });
});
