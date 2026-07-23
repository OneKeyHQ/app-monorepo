import { createInitialHomeStoreState } from '../homeStoreInitialState';
import { validateHomeStoreInvariants } from '../homeStoreInvariants';
import {
  applyHomeStorePatchToState,
  reduceHomeStore,
} from '../homeStoreReducer';

describe('Home Store invariants', () => {
  it('accepts an initial and owner-scoped state', () => {
    const initial = createInitialHomeStoreState();
    expect(validateHomeStoreInvariants(initial)).toEqual([]);
    const transition = reduceHomeStore(initial, {
      type: 'ownerChanged',
      owner: {
        walletId: 'wallet-a',
        accountId: 'account-a',
        network: { kind: 'allNetworks' },
      },
      ownerToken: { scopeKey: 'owner-a', sessionId: 'session-a' },
      topology: 'single',
    });
    expect(
      validateHomeStoreInvariants(
        applyHomeStorePatchToState(initial, transition.patch.mutations),
      ),
    ).toEqual([]);
  });

  it('detects a selected tab outside the advertised tab set', () => {
    const state = createInitialHomeStoreState();
    expect(
      validateHomeStoreInvariants({
        ...state,
        navigation: {
          ...state.navigation,
          value: {
            kind: 'ready',
            tabs: ['portfolio'],
            destinations: { portfolio: 'inline' },
            perpsDestination: 'unavailable',
            sections: {
              portfolio: true,
              perps: false,
              defi: false,
              nft: false,
              history: false,
              market: false,
            },
            selectedTabId: 'defi',
            freshness: 'live',
            refresh: 'idle',
          },
        },
      }),
    ).toContain('navigationSelectedTabMissing');
  });
});
