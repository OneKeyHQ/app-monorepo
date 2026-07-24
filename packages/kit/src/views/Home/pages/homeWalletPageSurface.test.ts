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
    walletRendererReady: true,
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

  it('keeps wallet content pending until the selected renderer is ready', () => {
    expect(resolve({ walletRendererReady: false })).toEqual(
      expect.objectContaining({ surface: 'pending' }),
    );
  });

  it('does not use backup status as an entry-surface authority', () => {
    for (const backuped of [false, true, undefined]) {
      const wallet = { ...matchingHdWallet, backuped };
      expect(
        resolve({ activeWallet: wallet, walletListWallet: wallet }),
      ).toEqual({
        authority: 'confirmed',
        surface: 'native',
        walletId: 'hd-1',
      });
    }
  });

  it('retains renderer selection as a non-business platform choice', () => {
    expect(resolve()).toEqual({
      authority: 'confirmed',
      surface: 'native',
      walletId: 'hd-1',
    });
    expect(resolve({ nativeHomeEnabled: false })).toEqual({
      authority: 'confirmed',
      surface: 'react',
      walletId: 'hd-1',
    });
  });

  it('mounts a complete cached owner without a wallet-list result', () => {
    expect(
      resolve({
        activeAccountId: 'account-1',
        walletContentReadiness: 'cached-wallet',
        walletListWallet: undefined,
      }),
    ).toEqual({
      accountId: 'account-1',
      authority: 'cached',
      surface: 'native',
      walletId: 'hd-1',
    });
  });

  it('mounts an active owner without a wallet-list result', () => {
    expect(
      resolve({
        activeAccountId: 'account-1',
        walletContentReadiness: 'active-wallet',
        walletListWallet: undefined,
      }),
    ).toEqual({
      accountId: 'account-1',
      authority: 'active',
      surface: 'native',
      walletId: 'hd-1',
    });
  });

  it('keeps the cached owner mounted until a replacement surface is ready', () => {
    const previous = resolve({
      activeAccountId: 'account-1',
      walletContentReadiness: 'cached-wallet',
      walletListWallet: undefined,
    });
    expect(
      resolve({
        activeAccountId: 'account-1',
        walletContentReadiness: 'pending',
        walletListWallet: undefined,
        previous,
      }),
    ).toBe(previous);
    expect(
      resolve({
        activeAccountId: 'account-2',
        walletContentReadiness: 'pending',
        walletListWallet: undefined,
        previous,
        retainPreviousOwnerWhilePending: true,
      }),
    ).toBe(previous);
    expect(
      resolve({
        activeAccountId: 'account-2',
        activeWallet: { ...matchingHdWallet, id: 'hd-2' },
        walletContentReadiness: 'wallet',
        walletListWallet: { ...matchingHdWallet, id: 'hd-2' },
        previous,
      }),
    ).toEqual({
      accountId: 'account-2',
      authority: 'confirmed',
      surface: 'native',
      walletId: 'hd-2',
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

  it('does not clear a committed surface while a different owner is pending', () => {
    const previous = resolve({ activeAccountId: 'account-1' });
    expect(
      resolve({
        activeAccountId: 'account-2',
        walletContentReadiness: 'pending',
        previous,
        retainPreviousOwnerWhilePending: true,
      }),
    ).toBe(previous);
  });

  it('falls back to the skeleton after a replacement owner cache miss', () => {
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
