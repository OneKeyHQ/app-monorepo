import { createInitialHomeStoreState } from '../homeStoreInitialState';
import {
  applyHomeStorePatchToState,
  reduceHomeStore,
} from '../homeStoreReducer';

import type { IHomeStoreEvent, IHomeStoreState } from '../homeStoreTypes';

const owner = {
  walletId: 'wallet-a',
  accountId: 'account-a',
  network: { kind: 'singleNetwork' as const, networkId: 'network-a' },
};
const ownerToken = { scopeKey: 'owner-a', sessionId: 'session-a' };

function dispatch(
  state: IHomeStoreState,
  event: IHomeStoreEvent,
): IHomeStoreState {
  return applyHomeStorePatchToState(
    state,
    reduceHomeStore(state, event).patch.mutations,
  );
}

function createOwnedState(): IHomeStoreState {
  return dispatch(createInitialHomeStoreState(), {
    type: 'ownerChanged',
    owner,
    ownerToken,
    topology: 'split',
  });
}

function enqueueHistoryCommand(
  state: IHomeStoreState,
  intentId: string,
): IHomeStoreState {
  return dispatch(state, {
    type: 'intentReceived',
    intent: {
      type: 'sectionActionInvoked',
      actionId: 'home.history.loadMore',
      authority: {
        kind: 'sectionCommands',
        revision: state.sections.history.sectionCommandRevision,
        sectionId: 'history',
      },
      execution: 'controller',
      intentId,
      itemId: intentId,
      owner,
      sectionId: 'history',
      sessionId: ownerToken.sessionId,
    },
  });
}

describe('Home Store controller command queue', () => {
  it('queues controller-owned section commands once and keeps the queue bounded', () => {
    let state = createOwnedState();
    for (let index = 0; index < 35; index += 1) {
      state = enqueueHistoryCommand(state, `history-${index}`);
    }

    expect(state.interaction.pendingSectionCommands).toHaveLength(32);
    expect(state.interaction.pendingSectionCommands[0]?.intentId).toBe(
      'history-3',
    );

    const duplicate = enqueueHistoryCommand(state, 'history-34');
    expect(duplicate).toBe(state);
  });

  it('coalesces equivalent load-more commands while one is pending', () => {
    let state = enqueueHistoryCommand(createOwnedState(), 'load-more-a');
    state = dispatch(state, {
      type: 'intentReceived',
      intent: {
        ...state.interaction.pendingSectionCommands[0]!,
        intentId: 'load-more-b',
      },
    });

    expect(state.interaction.pendingSectionCommands).toHaveLength(1);
    expect(state.interaction.acceptedIntentIds).toContain('load-more-b');
  });

  it('atomically clears commands when the owner changes', () => {
    const state = enqueueHistoryCommand(createOwnedState(), 'history-a');
    const next = dispatch(state, {
      type: 'ownerChanged',
      owner: { ...owner, accountId: 'account-b' },
      ownerToken: { scopeKey: 'owner-b', sessionId: 'session-b' },
      topology: 'split',
    });

    expect(next.interaction.pendingSectionCommands).toEqual([]);
    expect(next.interaction.acceptedIntentIds).toEqual([]);
  });

  it('handles a command only for the active owner and session', () => {
    const state = enqueueHistoryCommand(createOwnedState(), 'history-a');
    const wrongOwner = dispatch(state, {
      type: 'commandHandled',
      intentId: 'history-a',
      ownerToken: { ...ownerToken, scopeKey: 'owner-b' },
    });
    expect(wrongOwner.interaction).toBe(state.interaction);
    expect(wrongOwner.diagnostics.lastRejectReason).toBe('ownerMismatch');

    const wrongSession = dispatch(state, {
      type: 'commandHandled',
      intentId: 'history-a',
      ownerToken: { ...ownerToken, sessionId: 'session-b' },
    });
    expect(wrongSession.interaction).toBe(state.interaction);
    expect(wrongSession.diagnostics.lastRejectReason).toBe('sessionMismatch');

    const handled = dispatch(state, {
      type: 'commandHandled',
      intentId: 'history-a',
      ownerToken,
    });
    expect(handled.interaction.pendingSectionCommands).toEqual([]);
    expect(handled.resources).toBe(state.resources);
    expect(handled.sections).toBe(state.sections);
    expect(handled.shell).toBe(state.shell);
    expect(handled.navigation).toBe(state.navigation);

    expect(
      dispatch(handled, {
        type: 'commandHandled',
        intentId: 'history-a',
        ownerToken,
      }),
    ).toBe(handled);
  });
});
