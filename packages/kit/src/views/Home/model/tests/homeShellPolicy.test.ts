import { HOME_RUNTIME_PROTOCOL_VERSION } from '@onekeyhq/shared/src/types/homeRuntime';

import { createIdleHomeSourceFacts } from '../facts/homeFacts';
import { projectHomeShell } from '../policies/homeShellPolicy';
import {
  HomeSemanticStore,
  advanceHomeAuthoritativeShellSnapshot,
} from '../semantic/homeSemanticStore';

import type { IHomeFacts } from '../facts/homeFacts';
import type {
  IHomePortfolioPresentation,
  IHomeSemanticModel,
} from '../semantic/homeSemanticTypes';

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

function buildSemanticModel(
  shell: IHomeSemanticModel['shell'],
  owner = { scopeKey: 'owner-1', sessionId: 'session-1' },
): IHomeSemanticModel {
  return {
    owner,
    shell,
    navigation: { kind: 'hidden' },
    sections: {
      portfolio: { kind: 'hidden', reason: 'capabilityNotReady' },
      perps: { kind: 'hidden', reason: 'capabilityNotReady' },
      defi: { kind: 'hidden', reason: 'capabilityNotReady' },
      nft: { kind: 'hidden', reason: 'capabilityNotReady' },
      history: { kind: 'hidden', reason: 'capabilityNotReady' },
      market: { kind: 'hidden', reason: 'capabilityNotReady' },
    },
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

  it('retains the newest authoritative shell and rejects equal stale revisions', () => {
    const store = new HomeSemanticStore(
      buildSemanticModel({ kind: 'loading' }),
    );
    const zeroShell: IHomeSemanticModel['shell'] = {
      kind: 'portfolio',
      presentation,
    };
    store.publish(buildSemanticModel({ kind: 'loading' }), {
      owner: { scopeKey: 'owner-1', sessionId: 'session-1' },
      revision: 1,
      value: zeroShell,
    });
    expect(store.getSnapshot().shell.value).toEqual(zeroShell);

    store.publish(buildSemanticModel({ kind: 'missingNetworkAccount' }), {
      owner: { scopeKey: 'owner-1', sessionId: 'session-1' },
      revision: 1,
      value: { kind: 'backupRequired', commandId: 'backupWallet' },
    });
    expect(store.getSnapshot().shell.value).toEqual(zeroShell);

    store.publish(buildSemanticModel({ kind: 'missingNetworkAccount' }));
    expect(store.getSnapshot().shell.value).toEqual(zeroShell);
  });

  it('keeps authority revisions monotonic across coordinator remounts', () => {
    const owner = { scopeKey: 'owner-1', sessionId: 'session-1' };
    const current = {
      owner,
      revision: 7,
      value: { kind: 'loading' } as const,
    };
    expect(
      advanceHomeAuthoritativeShellSnapshot(current, {
        owner,
        revision: 1,
        value: { kind: 'missingNetworkAccount' },
      }),
    ).toEqual({
      owner,
      revision: 8,
      value: { kind: 'missingNetworkAccount' },
    });
    expect(
      advanceHomeAuthoritativeShellSnapshot(current, {
        owner: { scopeKey: 'owner-2', sessionId: 'session-2' },
        revision: 99,
        value: { kind: 'loading' },
      }).revision,
    ).toBe(1);
  });
});
