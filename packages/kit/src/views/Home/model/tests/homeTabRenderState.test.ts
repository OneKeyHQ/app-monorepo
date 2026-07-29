import {
  createHomeTabRenderState,
  isHomeTabRendered,
  markHomeTabRendered,
  reconcileHomeTabRenderOwner,
} from '../navigation/homeTabRenderState';

describe('homeTabRenderState', () => {
  it('renders only Spot before any tab interaction', () => {
    const state = createHomeTabRenderState('account-a');

    expect(isHomeTabRendered(state, 'account-a', 'portfolio')).toBe(true);
    expect(isHomeTabRendered(state, 'account-a', 'perps')).toBe(false);
    expect(isHomeTabRendered(state, 'account-a', 'defi')).toBe(false);
    expect(isHomeTabRendered(state, 'account-a', 'nft')).toBe(false);
    expect(isHomeTabRendered(state, 'account-a', 'history')).toBe(false);
  });

  it('keeps a tab rendered after its first visit', () => {
    const initial = createHomeTabRenderState('account-a');
    const visited = markHomeTabRendered(initial, 'account-a', 'defi');

    expect(isHomeTabRendered(visited, 'account-a', 'defi')).toBe(true);
    expect(markHomeTabRendered(visited, 'account-a', 'defi')).toBe(visited);
  });

  it('resets visited tabs when the account owner changes', () => {
    const visited = markHomeTabRendered(
      createHomeTabRenderState('account-a'),
      'account-a',
      'history',
    );
    const nextOwner = reconcileHomeTabRenderOwner(visited, 'account-b');

    expect(isHomeTabRendered(nextOwner, 'account-b', 'portfolio')).toBe(true);
    expect(isHomeTabRendered(nextOwner, 'account-b', 'history')).toBe(false);
    expect(isHomeTabRendered(visited, 'account-b', 'history')).toBe(false);
  });
});
