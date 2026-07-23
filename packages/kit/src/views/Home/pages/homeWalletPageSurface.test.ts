import { resolveHomeWalletPageSurface } from './homeWalletPageSurface';

const matchingHdWallet = {
  id: 'hd-1',
  type: 'hd',
  backuped: false,
};

function resolve(
  overrides: Partial<Parameters<typeof resolveHomeWalletPageSurface>[0]> = {},
) {
  return resolveHomeWalletPageSurface({
    launchDecision: 'main',
    walletContentReadiness: 'wallet',
    activeWallet: matchingHdWallet,
    walletListWallet: matchingHdWallet,
    nativeHomeEnabled: true,
    ...overrides,
  });
}

describe('resolveHomeWalletPageSurface', () => {
  it.each([
    ['unknown launch', { launchDecision: 'unknown' as const }],
    ['onboarding launch', { launchDecision: 'onboarding' as const }],
    ['wallet readiness', { walletContentReadiness: 'pending' as const }],
    ['missing active wallet', { activeWallet: undefined }],
    ['missing wallet-list wallet', { walletListWallet: undefined }],
    [
      'wallet generation mismatch',
      { walletListWallet: { ...matchingHdWallet, id: 'hd-2' } },
    ],
    [
      'wallet type mismatch',
      { walletListWallet: { ...matchingHdWallet, type: 'hw' } },
    ],
  ])('keeps %s pending on a cold surface', (_label, overrides) => {
    expect(resolve(overrides)).toEqual(
      expect.objectContaining({ surface: 'pending' }),
    );
  });

  it('routes no-wallet readiness only to the no-wallet owner', () => {
    expect(
      resolve({
        walletContentReadiness: 'no-wallet',
        activeWallet: undefined,
        walletListWallet: undefined,
      }),
    ).toEqual({ surface: 'no-wallet' });
  });

  it('does not use backup status as an entry-surface authority', () => {
    for (const backuped of [false, true, undefined]) {
      const wallet = { ...matchingHdWallet, backuped };
      expect(
        resolve({ activeWallet: wallet, walletListWallet: wallet }),
      ).toEqual({ surface: 'native', walletId: 'hd-1' });
    }
  });

  it('retains renderer selection as a non-business platform choice', () => {
    expect(resolve()).toEqual({ surface: 'native', walletId: 'hd-1' });
    expect(resolve({ nativeHomeEnabled: false })).toEqual({
      surface: 'react',
      walletId: 'hd-1',
    });
  });

  it('keeps a same-owner surface through warm readiness recovery', () => {
    const previous = resolve({ activeAccountId: 'account-1' });
    expect(
      resolve({
        activeAccountId: 'account-1',
        walletContentReadiness: 'pending',
        previous,
      }),
    ).toBe(previous);
  });

  it('does not retain a surface for a different account owner', () => {
    const previous = resolve({ activeAccountId: 'account-1' });
    expect(
      resolve({
        activeAccountId: 'account-2',
        walletContentReadiness: 'pending',
        previous,
      }),
    ).toEqual({
      accountId: 'account-2',
      surface: 'pending',
      walletId: 'hd-1',
    });
  });
});
