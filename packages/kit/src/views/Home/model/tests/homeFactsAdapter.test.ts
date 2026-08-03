import { WALLET_TYPE_HW } from '@onekeyhq/shared/src/consts/dbConsts';

import { buildHomeOwnerScopeKey } from '../core/homeIdentity';
import { adaptCurrentHomeFacts } from '../facts/currentHomeFactsAdapter';

const owner = {
  walletId: 'wallet-a',
  accountId: 'account-a',
  network: { kind: 'allNetworks' as const },
};

function authority(scopeKey = buildHomeOwnerScopeKey(owner)) {
  return {
    topology: 'split' as const,
    status: 'active' as const,
    ownerToken: { scopeKey, sessionId: 'session-a' },
    producerInstanceId: 'producer-a',
    revision: 2,
  };
}

describe('current Home facts adapter', () => {
  it('normalizes existing owner/runtime facts without adding source requests', () => {
    const facts = adaptCurrentHomeFacts({
      owner,
      authority: authority(),
      wallet: { ready: true, backuped: false, type: 'hd' },
      network: { hasAccount: true },
    });
    expect(facts).toMatchObject({
      owner,
      wallet: { backupStatus: 'required', accountType: 'hd' },
      runtime: { topology: 'split', connection: 'ready' },
      capabilityInputs: {
        ready: false,
        networkFamily: 'allNetworks',
        serverConfig: { history: false, market: false },
        productAvailability: { history: false, market: false },
      },
    });
    expect(facts?.sources).toEqual({
      portfolio: { kind: 'idle' },
      defi: { kind: 'idle' },
      perps: { kind: 'idle' },
      nft: { kind: 'idle' },
      history: { kind: 'idle' },
      market: { kind: 'idle' },
    });
  });

  it('refuses an authority snapshot for a different owner', () => {
    expect(
      adaptCurrentHomeFacts({
        owner,
        authority: authority('other-scope'),
        wallet: { ready: true, backuped: true, type: 'hd' },
        network: { hasAccount: true },
      }),
    ).toBeUndefined();
  });

  it('keeps independent bg readiness as a runtime fact', () => {
    const facts = adaptCurrentHomeFacts({
      owner,
      authority: { ...authority(), status: 'waitingForProducer' },
      wallet: { ready: true, backuped: true, type: 'hd' },
      network: { hasAccount: true },
    });
    expect(facts?.runtime.connection).toBe('waiting');
  });

  it('keeps unavailable wallet and capability facts unknown instead of guessing support', () => {
    const facts = adaptCurrentHomeFacts({
      owner,
      authority: authority(),
      wallet: { ready: true },
      network: { hasAccount: true },
    });
    expect(facts).toMatchObject({
      wallet: { accountType: 'unknown', backupStatus: 'unknown' },
      capabilityInputs: {
        ready: false,
        serverConfig: {
          perps: false,
          defi: false,
          nft: false,
          history: false,
          market: false,
        },
        productAvailability: {
          perps: false,
          defi: false,
          nft: false,
          history: false,
          market: false,
        },
      },
    });
  });

  it('maps the persisted hardware wallet type to the semantic account type', () => {
    const facts = adaptCurrentHomeFacts({
      owner,
      authority: authority(),
      wallet: { ready: true, type: WALLET_TYPE_HW },
      network: { hasAccount: true },
    });
    expect(facts?.wallet).toMatchObject({
      accountType: 'hardware',
      backupStatus: 'notApplicable',
    });
  });
});
