import { HOME_RUNTIME_PROTOCOL_VERSION } from '@onekeyhq/shared/src/types/homeRuntime';

import { createIdleHomeSourceFacts } from '../facts/homeFacts';
import { projectHomeShell } from '../policies/homeShellPolicy';

import type { IHomeFacts } from '../facts/homeFacts';
import type { IHomePortfolioPresentation } from '../semantic/homeSemanticTypes';

const presentation: IHomePortfolioPresentation = {
  kind: 'zero',
  header: { kind: 'zero', balance: { amount: '0', currency: 'usd' } },
  actions: { kind: 'zero', items: ['addMoney', 'receive', 'more'] },
  banner: { kind: 'none' },
  freshness: 'live',
  refresh: 'idle',
};

function buildFacts(wallet: Partial<IHomeFacts['wallet']> = {}): IHomeFacts {
  return {
    owner: {
      walletId: 'wallet-1',
      accountId: 'account-1',
      network: { kind: 'allNetworks' },
    },
    ownerToken: { scopeKey: 'owner-1', sessionId: 'session-1' },
    wallet: {
      accountType: 'hd',
      backupStatus: 'complete',
      hasNetworkAccount: true,
      ready: true,
      ...wallet,
    },
    environment: { theme: 'light' },
    runtime: {
      connection: 'ready',
      producerInstanceId: 'producer-1',
      protocolVersion: HOME_RUNTIME_PROTOCOL_VERSION,
      topology: 'single',
    },
    capabilityInputs: {
      accountType: 'hd',
      allNetworks: true,
      networkFamily: 'allNetworks',
      productAvailability: {
        defi: false,
        history: false,
        market: false,
        nft: false,
        perps: false,
      },
      ready: false,
      serverConfig: {
        defi: false,
        history: false,
        market: false,
        nft: false,
        perps: false,
      },
    },
    confirmed: {},
    sources: createIdleHomeSourceFacts(),
  };
}

describe('homeShellPolicy', () => {
  it('keeps backup and missing-account shells exclusive', () => {
    expect(
      projectHomeShell({
        facts: buildFacts({ backupStatus: 'required' }),
        portfolioPresentation: presentation,
      }),
    ).toEqual({ kind: 'backupRequired', commandId: 'backupWallet' });
    expect(
      projectHomeShell({
        facts: buildFacts({ hasNetworkAccount: false }),
        portfolioPresentation: presentation,
      }),
    ).toEqual({ kind: 'missingNetworkAccount' });
  });

  it('publishes the correlated portfolio shell only when wallet facts allow it', () => {
    expect(
      projectHomeShell({
        facts: buildFacts(),
        portfolioPresentation: presentation,
      }),
    ).toEqual({ kind: 'portfolio', presentation });
  });
});
