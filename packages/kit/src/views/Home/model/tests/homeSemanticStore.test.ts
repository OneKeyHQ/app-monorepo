import { HomeSemanticStore } from '../semantic/homeSemanticStore';

import type { IHomeSemanticModel } from '../semantic/homeSemanticTypes';

function model(sessionId = 'session-a'): IHomeSemanticModel {
  return {
    owner: { scopeKey: 'scope-a', sessionId },
    shell: { kind: 'loading' },
    navigation: { kind: 'hidden' },
    sections: {
      portfolio: { kind: 'loading', placeholder: 'portfolio' },
      perps: { kind: 'hidden', reason: 'notApplicable' },
      defi: { kind: 'hidden', reason: 'notApplicable' },
      nft: { kind: 'hidden', reason: 'notApplicable' },
      history: { kind: 'hidden', reason: 'notApplicable' },
      market: { kind: 'hidden', reason: 'notApplicable' },
    },
  };
}

describe('HomeSemanticStore', () => {
  it('keeps stable versioned slice references for a semantic no-op', () => {
    const store = new HomeSemanticStore(model());
    const first = store.getSnapshot();
    const second = store.publish(model());
    expect(second).toBe(first);
    expect(second.shell).toBe(first.shell);
    expect(second.sections.history).toBe(first.sections.history);
  });

  it('publishes one section atomically without invalidating unrelated slices', () => {
    const store = new HomeSemanticStore(model());
    const first = store.getSnapshot();
    const nextModel = model();
    nextModel.sections = {
      ...nextModel.sections,
      portfolio: { kind: 'empty', emptyState: 'portfolio' },
    };
    const second = store.publish(nextModel);
    expect(second.revision).toBe(2);
    expect(second.sections.portfolio.revision).toBe(2);
    expect(second.sections.history).toBe(first.sections.history);
    expect(second.shell).toBe(first.shell);
    expect(second.navigation).toBe(first.navigation);
  });

  it('resets every slice as one owner transaction for A -> B -> A', () => {
    const store = new HomeSemanticStore(model('session-a1'));
    const b = model('session-b');
    b.owner = { scopeKey: 'scope-b', sessionId: 'session-b' };
    const second = store.publish(b);
    const third = store.publish(model('session-a2'));
    expect(second.revision).toBe(2);
    expect(third.revision).toBe(3);
    expect(third.owner.sessionId).toBe('session-a2');
    expect(third.shell.revision).toBe(3);
    expect(third.sections.market.revision).toBe(3);
  });
});
