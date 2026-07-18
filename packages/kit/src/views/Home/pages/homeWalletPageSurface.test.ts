import {
  type IHomeWalletPageSurfaceState,
  resolveHomeWalletPageSurface,
} from './homeWalletPageSurface';

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
    [
      'undefined HD backup verdict',
      {
        activeWallet: { ...matchingHdWallet, backuped: undefined },
        walletListWallet: { ...matchingHdWallet, backuped: undefined },
      },
    ],
    [
      'HD backup verdict mismatch',
      { walletListWallet: { ...matchingHdWallet, backuped: true } },
    ],
  ])('keeps %s pending on a cold surface', (_label, overrides) => {
    expect(resolve(overrides)).toEqual(
      expect.objectContaining({ surface: 'pending' }),
    );
  });

  it('routes no-wallet readiness only to the existing no-wallet owner', () => {
    expect(
      resolve({
        walletContentReadiness: 'no-wallet',
        activeWallet: undefined,
        walletListWallet: undefined,
      }),
    ).toEqual({ surface: 'no-wallet' });
  });

  it('routes a matching unbacked HD wallet to the lightweight RN page', () => {
    expect(resolve()).toEqual({
      surface: 'not-backed-up-rn',
      walletId: 'hd-1',
    });
  });

  it('routes a matching backed-up HD wallet through the normal feature choice', () => {
    const backedUpWallet = { ...matchingHdWallet, backuped: true };
    expect(
      resolve({
        activeWallet: backedUpWallet,
        walletListWallet: backedUpWallet,
      }),
    ).toEqual({ surface: 'native', walletId: 'hd-1' });
    expect(
      resolve({
        activeWallet: backedUpWallet,
        walletListWallet: backedUpWallet,
        nativeHomeEnabled: false,
      }),
    ).toEqual({ surface: 'legacy', walletId: 'hd-1' });
  });

  it.each(['imported', 'watching', 'hw', 'qr', 'external'])(
    'never treats a %s wallet as the unbacked HD safety page',
    (type) => {
      const wallet = { ...matchingHdWallet, type, backuped: false };
      expect(
        resolve({ activeWallet: wallet, walletListWallet: wallet }),
      ).toEqual({ surface: 'native', walletId: 'hd-1' });
    },
  );

  it('keeps the same RN wallet sticky through refetch and commits Native once', () => {
    const states: IHomeWalletPageSurfaceState[] = [];
    const append = (
      overrides: Partial<Parameters<typeof resolveHomeWalletPageSurface>[0]>,
    ) => {
      states.push(resolve({ ...overrides, previous: states.at(-1) }));
    };
    const backedUpWallet = { ...matchingHdWallet, backuped: true };

    append({});
    append({ walletContentReadiness: 'pending' });
    append({ activeWallet: backedUpWallet });
    append({
      activeWallet: backedUpWallet,
      walletListWallet: backedUpWallet,
    });
    append({
      activeWallet: backedUpWallet,
      walletListWallet: backedUpWallet,
    });

    expect(states.map((state) => state.surface)).toEqual([
      'not-backed-up-rn',
      'not-backed-up-rn',
      'not-backed-up-rn',
      'native',
      'native',
    ]);
    expect(
      states
        .slice(1)
        .filter((state, index) => state.surface !== states[index].surface),
    ).toHaveLength(1);
  });

  it('clears a sticky RN surface immediately when the active wallet changes', () => {
    expect(
      resolve({
        walletContentReadiness: 'pending',
        activeWallet: { ...matchingHdWallet, id: 'hd-2' },
        walletListWallet: undefined,
        previous: {
          surface: 'not-backed-up-rn',
          walletId: 'hd-1',
        },
      }),
    ).toEqual({ surface: 'pending', walletId: 'hd-2' });
  });

  it('keeps a funded HD wallet on the RN safety page until backup is authoritative', () => {
    const unbackedWithFunds = {
      launchDecision: 'main' as const,
      walletContentReadiness: 'wallet' as const,
      activeWallet: matchingHdWallet,
      walletListWallet: matchingHdWallet,
      nativeHomeEnabled: true,
      balance: '1000',
      tokenCount: 8,
    };
    const unbackedSurface = resolveHomeWalletPageSurface(unbackedWithFunds);
    expect(unbackedSurface).toEqual({
      surface: 'not-backed-up-rn',
      walletId: 'hd-1',
    });

    const backedUpWallet = { ...matchingHdWallet, backuped: true };
    expect(
      resolveHomeWalletPageSurface({
        ...unbackedWithFunds,
        activeWallet: backedUpWallet,
        walletListWallet: backedUpWallet,
        previous: unbackedSurface,
      }),
    ).toEqual({ surface: 'native', walletId: 'hd-1' });
  });
});
