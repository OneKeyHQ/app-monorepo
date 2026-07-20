import {
  initialHomeTabIntentState,
  reduceHomeTabIntent,
} from '../navigation/homeTabIntentReducer';

const owner = { scopeKey: 'owner-1', sessionId: 'session-1' };

describe('homeTabIntentReducer', () => {
  it('preserves a valid selection and falls to the explicit first tab', () => {
    let state = reduceHomeTabIntent(initialHomeTabIntentState, {
      kind: 'reconcile',
      ownerToken: owner,
      tabs: ['portfolio', 'nft'],
    });
    state = reduceHomeTabIntent(state, {
      kind: 'select',
      ownerToken: owner,
      tabId: 'nft',
      tabs: ['portfolio', 'nft'],
    });
    expect(state.selectedTabId).toBe('nft');
    state = reduceHomeTabIntent(state, {
      kind: 'reconcile',
      ownerToken: owner,
      tabs: ['portfolio'],
    });
    expect(state.selectedTabId).toBe('portfolio');
    state = reduceHomeTabIntent(state, {
      kind: 'reconcile',
      ownerToken: owner,
      tabs: ['portfolio', 'nft'],
    });
    expect(state.selectedTabId).toBe('portfolio');
  });

  it('rejects unavailable selection and resets on owner change', () => {
    const state = reduceHomeTabIntent(initialHomeTabIntentState, {
      kind: 'select',
      ownerToken: owner,
      tabId: 'nft',
      tabs: ['portfolio'],
    });
    expect(state).toBe(initialHomeTabIntentState);
    expect(
      reduceHomeTabIntent(
        { ownerToken: owner, selectedTabId: 'nft' },
        {
          kind: 'reconcile',
          ownerToken: { scopeKey: 'owner-2', sessionId: 'session-2' },
          tabs: ['portfolio', 'nft'],
        },
      ).selectedTabId,
    ).toBe('portfolio');
  });
});
