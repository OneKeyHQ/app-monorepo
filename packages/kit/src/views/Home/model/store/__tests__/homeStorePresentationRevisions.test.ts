import { createInitialHomeStoreState } from '../homeStoreInitialState';
import { advanceShell } from '../homeStoreReducer';

const fundedShell = {
  kind: 'portfolio' as const,
  presentation: {
    kind: 'funded' as const,
    header: {
      kind: 'funded' as const,
      authority: 'live' as const,
      balance: { amount: '10', currency: 'usd' },
    },
    actions: {
      kind: 'funded' as const,
      items: ['send', 'receive'] as const,
    },
    banner: { kind: 'none' as const },
    priority: 1 as const,
    refresh: 'idle' as const,
  },
};

describe('Home Store presentation revisions', () => {
  it('advances only the action axis for an action-only change', () => {
    const current = advanceShell(
      createInitialHomeStoreState().shell,
      fundedShell,
    );
    const next = advanceShell(current, {
      ...fundedShell,
      presentation: {
        ...fundedShell.presentation,
        actions: {
          kind: 'funded',
          items: ['send', 'receive', 'swap'],
        },
      },
    });

    expect(next.actionsPresentationRevision).toBe(
      current.actionsPresentationRevision + 1,
    );
    expect(next.balancePresentationRevision).toBe(
      current.balancePresentationRevision,
    );
    expect(next.bannerPresentationRevision).toBe(
      current.bannerPresentationRevision,
    );
    expect(next.bodyPresentationRevision).toBe(
      current.bodyPresentationRevision,
    );
  });

  it('advances only the balance axis for an amount-only change', () => {
    const current = advanceShell(
      createInitialHomeStoreState().shell,
      fundedShell,
    );
    const next = advanceShell(current, {
      ...fundedShell,
      presentation: {
        ...fundedShell.presentation,
        header: {
          ...fundedShell.presentation.header,
          balance: { amount: '11', currency: 'usd' },
        },
      },
    });

    expect(next.balancePresentationRevision).toBe(
      current.balancePresentationRevision + 1,
    );
    expect(next.actionsPresentationRevision).toBe(
      current.actionsPresentationRevision,
    );
    expect(next.bannerPresentationRevision).toBe(
      current.bannerPresentationRevision,
    );
    expect(next.bodyPresentationRevision).toBe(
      current.bodyPresentationRevision,
    );
  });

  it('advances body and action axes when backup becomes required', () => {
    const current = advanceShell(
      createInitialHomeStoreState().shell,
      fundedShell,
    );
    const next = advanceShell(current, {
      kind: 'backupRequired',
      commandId: 'backupWallet',
    });

    expect(next.bodyPresentationRevision).toBe(
      current.bodyPresentationRevision + 1,
    );
    expect(next.actionsPresentationRevision).toBe(
      current.actionsPresentationRevision + 1,
    );
    expect(next.balancePresentationRevision).toBe(
      current.balancePresentationRevision + 1,
    );
  });

  it('advances only the balance axis when a backup-wallet amount arrives', () => {
    const current = advanceShell(createInitialHomeStoreState().shell, {
      kind: 'backupRequired',
      commandId: 'backupWallet',
    });
    const next = advanceShell(current, {
      kind: 'backupRequired',
      commandId: 'backupWallet',
      presentation: fundedShell.presentation,
    });

    expect(next.balancePresentationRevision).toBe(
      current.balancePresentationRevision + 1,
    );
    expect(next.actionsPresentationRevision).toBe(
      current.actionsPresentationRevision,
    );
    expect(next.bannerPresentationRevision).toBe(
      current.bannerPresentationRevision,
    );
    expect(next.bodyPresentationRevision).toBe(
      current.bodyPresentationRevision,
    );
  });
});
