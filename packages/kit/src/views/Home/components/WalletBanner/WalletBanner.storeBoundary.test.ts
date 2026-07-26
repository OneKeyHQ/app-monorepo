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

  it('keeps banner I/O in the source and command runtime', () => {
    const source = readSource('../../model/sources/homeSourceRuntime.ts');
    const commands = readSource('../../model/react/useHomeCommandExecutor.ts');

    expect(source).toContain('private async loadBanner(');
    expect(source).toContain('fetchWalletBanner');
    expect(source).toContain('checkBannerReferralEligibility');
    expect(source).not.toMatch(/from ['"]react['"]/);
    expect(commands).toContain('HOME_BANNER_ACTION_IDS.dismiss');
    expect(commands).toContain('snoozeReferralBanner');
    expect(commands).not.toContain('pendingShellCommands');
  });
});
