import fs from 'fs';
import path from 'path';

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
}

describe('WalletBanner Store boundary', () => {
  it('keeps the renderer read-only and routes commands through typed intents', () => {
    const renderer = readSource('WalletBanner.tsx');

    expect(renderer).toContain("useHomeResource('banner')");
    expect(renderer).toContain('useHomeBannerIntents');
    expect(renderer).not.toContain('backgroundApiProxy');
    expect(renderer).not.toContain('usePromiseResult');
    expect(renderer).not.toContain('useWalletTopBannersAtom');
    expect(renderer).not.toContain('useAccountOverviewActions');
    expect(renderer).not.toContain('useHomeStoreSourcePublisher');
  });

  it('keeps all banner source calls in the unique root controller', () => {
    const controller = readSource(
      '../../model/react/HomeBannerStoreController.tsx',
    );
    const root = readSource('../../model/react/HomeStoreSourceControllers.tsx');

    expect(controller).toContain('beginHomeSourceRequest');
    expect(controller).toContain('fetchWalletBanner');
    expect(controller).toContain('checkBannerReferralEligibility');
    expect(controller).toContain('pendingShellCommands.find');
    expect(root).toContain('<HomeBannerStoreController />');
  });
});
