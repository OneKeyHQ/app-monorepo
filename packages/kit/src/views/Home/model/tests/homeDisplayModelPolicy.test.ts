import { projectHomeDisplayModel } from '../policies/homeDisplayModelPolicy';

import type { IHomeShellSemanticModel } from '../semantic/homeSemanticTypes';

const ownerToken = { scopeKey: 'wallet:account:all', sessionId: 'session-1' };

function project(shell: IHomeShellSemanticModel) {
  return projectHomeDisplayModel({
    fallbackCurrency: 'usd',
    ownerToken,
    shell,
  });
}

describe('homeDisplayModelPolicy', () => {
  it('projects backup as a prompt without coupling it to balance or sections', () => {
    const display = project({
      kind: 'backupRequired',
      commandId: 'backupWallet',
    });

    expect(display).toMatchObject({
      actions: { kind: 'hidden' },
      balance: { kind: 'loading' },
      banner: { kind: 'hidden' },
      body: { kind: 'backupPrompt' },
      fundingVerdict: 'unknown',
      navigation: { kind: 'portfolioOnly' },
    });
  });

  it('keeps a provisional amount separate from an unknown funding verdict', () => {
    const display = project({
      kind: 'portfolio',
      presentation: {
        kind: 'loading',
        header: { kind: 'loading' },
        actions: { kind: 'loading', items: [] },
        banner: { kind: 'none' },
      },
    });

    expect(display.balance).toMatchObject({
      kind: 'ready',
      authority: 'provisional',
      balance: { amount: '0', currency: 'usd' },
    });
    expect(display.fundingVerdict).toBe('unknown');
    expect(display.actions).toEqual({ kind: 'loading' });
  });

  it('shows funded actions from positive evidence before the total settles', () => {
    const display = project({
      kind: 'portfolio',
      presentation: {
        kind: 'fundedPendingTotal',
        header: {
          kind: 'loading',
          balance: { amount: '1.25', currency: 'usd' },
        },
        actions: { kind: 'funded', items: ['send', 'receive'] },
        banner: { kind: 'positive' },
      },
    });

    expect(display.balance).toMatchObject({
      authority: 'partial',
      balance: { amount: '1.25', currency: 'usd' },
      kind: 'ready',
    });
    expect(display.fundingVerdict).toBe('funded');
    expect(display.actions).toEqual({
      kind: 'funded',
      items: ['send', 'receive'],
    });
    expect(display.banner).toEqual({ kind: 'eligible' });
  });

  it('projects confirmed zero independently for amount, actions, and banner', () => {
    const display = project({
      kind: 'portfolio',
      presentation: {
        kind: 'zero',
        header: {
          kind: 'zero',
          balance: { amount: '0', currency: 'usd' },
        },
        actions: { kind: 'zero', items: ['addMoney', 'receive', 'more'] },
        banner: { kind: 'none' },
        priority: 1,
        refresh: 'idle',
      },
    });

    expect(display.balance).toMatchObject({
      authority: 'live',
      kind: 'ready',
    });
    expect(display.fundingVerdict).toBe('zero');
    expect(display.actions.kind).toBe('zero');
    expect(display.banner).toEqual({ kind: 'hidden' });
  });

  it('does not revise an exact amount when only actions change', () => {
    const base = {
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
      },
    };
    const changed = {
      ...base,
      presentation: {
        ...base.presentation,
        actions: {
          kind: 'funded' as const,
          items: ['send', 'receive', 'swap'] as const,
        },
      },
    };

    expect(project(base).balance.revision).toBe(
      project(changed).balance.revision,
    );
    expect(project(base).actions).not.toEqual(project(changed).actions);
  });
});
