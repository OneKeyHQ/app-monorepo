import {
  adaptHomeShellToLegacy,
  resolveHomeBalancePresentation,
  resolveHomeLegacyBalanceState,
} from '../compatibility/homeLegacyShellAdapter';
import { adaptHomeShellToNativeHeader } from '../native/homeNativeDTOAdapter';
import { isHomeShellCommandAvailable } from '../native/homeNativeIntentGuard';

import type { IHomeShellSemanticModel } from '../semantic/homeSemanticTypes';

describe('home shell compatibility adapters', () => {
  it('maps the same zero shell to Legacy and Native zero families', () => {
    const shell: IHomeShellSemanticModel = {
      kind: 'portfolio',
      presentation: {
        kind: 'zero',
        header: { kind: 'zero', balance: { amount: '0', currency: 'usd' } },
        actions: { kind: 'zero', items: ['addMoney', 'receive', 'more'] },
        banner: { kind: 'none' },
        freshness: 'live',
        refresh: 'idle',
      },
    };

    expect(adaptHomeShellToLegacy(shell)).toMatchObject({
      actionFamily: 'zero',
      balanceState: 'zero',
      showPositiveBanner: false,
    });
    expect(adaptHomeShellToNativeHeader(shell)).toEqual({
      actionFamily: 'zero',
      amount: '0',
      balanceStatus: 'ready',
      currency: 'usd',
      showPositiveBanner: false,
    });
  });

  it('never exposes a partial total while retaining funded-safe actions', () => {
    const shell: IHomeShellSemanticModel = {
      kind: 'portfolio',
      presentation: {
        kind: 'fundedPendingTotal',
        header: { kind: 'loading' },
        actions: {
          kind: 'funded',
          items: ['send', 'receive', 'buySell', 'swap'],
        },
        banner: { kind: 'positive' },
      },
    };

    expect(adaptHomeShellToLegacy(shell)).toEqual({
      actionFamily: 'funded',
      balance: undefined,
      balanceState: 'positive',
      showPositiveBanner: true,
    });
    expect(adaptHomeShellToNativeHeader(shell)).toEqual({
      actionFamily: 'funded',
      balanceStatus: 'loading',
      showPositiveBanner: true,
    });
  });

  it('maps unavailable and special shells to loading without guessing zero', () => {
    expect(adaptHomeShellToLegacy({ kind: 'missingNetworkAccount' })).toEqual({
      actionFamily: 'loading',
      balanceState: 'unknown',
      showPositiveBanner: false,
    });
    expect(
      adaptHomeShellToNativeHeader({
        kind: 'portfolio',
        presentation: {
          kind: 'unavailable',
          header: { kind: 'unavailable', reason: 'sourceError' },
          actions: { kind: 'loading', items: [] },
          banner: { kind: 'none' },
        },
      }),
    ).toMatchObject({
      actionFamily: 'loading',
      balanceStatus: 'loading',
    });
  });

  it('rejects stale header and banner commands against the correlated shell', () => {
    const zeroShell: IHomeShellSemanticModel = {
      kind: 'portfolio',
      presentation: {
        kind: 'zero',
        header: { kind: 'zero', balance: { amount: '0', currency: 'usd' } },
        actions: { kind: 'zero', items: ['addMoney', 'receive', 'more'] },
        banner: { kind: 'none' },
      },
    };
    expect(isHomeShellCommandAvailable(zeroShell, 'home.header.receive')).toBe(
      true,
    );
    expect(isHomeShellCommandAvailable(zeroShell, 'home.header.balance')).toBe(
      true,
    );
    expect(isHomeShellCommandAvailable(zeroShell, 'home.header.send')).toBe(
      false,
    );
    expect(isHomeShellCommandAvailable(zeroShell, 'home.banner.open')).toBe(
      false,
    );

    const fundedPendingShell: IHomeShellSemanticModel = {
      kind: 'portfolio',
      presentation: {
        kind: 'fundedPendingTotal',
        header: { kind: 'loading' },
        actions: {
          kind: 'funded',
          items: ['send', 'receive', 'buySell', 'swap'],
        },
        banner: { kind: 'positive' },
      },
    };
    expect(
      isHomeShellCommandAvailable(fundedPendingShell, 'home.header.send'),
    ).toBe(true);
    expect(
      isHomeShellCommandAvailable(fundedPendingShell, 'home.header.balance'),
    ).toBe(false);
    expect(
      isHomeShellCommandAvailable(fundedPendingShell, 'home.banner.open'),
    ).toBe(true);
  });

  it('does not reuse Account A sticky actions while Account B waits for matching facts', () => {
    expect(
      resolveHomeLegacyBalanceState({
        legacyState: 'positive',
        shadowFactsPresent: true,
        shell: undefined,
      }),
    ).toBe('unknown');
    expect(
      resolveHomeLegacyBalanceState({
        legacyState: 'positive',
        shadowFactsPresent: false,
        shell: undefined,
      }),
    ).toBe('positive');
  });

  it('builds one correlated amount/action/banner presentation and rolls back only when semantic facts are absent', () => {
    const ownerToken = { scopeKey: 'owner-1', sessionId: 'session-1' };
    expect(
      resolveHomeBalancePresentation({
        legacyState: 'positive',
        ownerToken,
        shadowFactsPresent: true,
        shell: { kind: 'loading' },
      }),
    ).toMatchObject({
      balanceState: 'unknown',
      correlated: {
        kind: 'loading',
        balanceState: 'unknown',
        showPositiveBanner: false,
      },
    });

    const zero = resolveHomeBalancePresentation({
      legacyState: 'positive',
      ownerToken,
      shadowFactsPresent: true,
      shell: {
        kind: 'portfolio',
        presentation: {
          kind: 'zero',
          header: { kind: 'zero', balance: { amount: '0', currency: 'usd' } },
          actions: { kind: 'zero', items: ['addMoney', 'receive', 'more'] },
          banner: { kind: 'none' },
        },
      },
    });
    expect(zero).toMatchObject({
      balanceState: 'zero',
      correlated: {
        kind: 'ready',
        balance: { amount: '0', currency: 'usd' },
        balanceState: 'zero',
        showPositiveBanner: false,
      },
    });
    expect(zero.correlated?.revision).toEqual(expect.any(String));

    expect(
      resolveHomeBalancePresentation({
        legacyState: 'positive',
        shadowFactsPresent: false,
      }),
    ).toEqual({ balanceState: 'positive' });
  });
});
