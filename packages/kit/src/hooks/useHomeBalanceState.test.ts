import { resolveHomeBalanceState } from './useHomeBalanceState';

jest.mock('../states/jotai/contexts/accountOverview', () => ({}));
jest.mock('../states/jotai/contexts/accountSelector', () => ({}));
jest.mock('../states/jotai/contexts/tokenList', () => ({}));

describe('Home asset state', () => {
  it.each([
    ['uncached loading', false, undefined, false, undefined, 'unknown'],
    ['partial zero', false, '0', false, undefined, 'unknown'],
    ['unpriced holding', true, '0', false, undefined, 'positive'],
    ['partial funded result', false, '1', false, undefined, 'positive'],
    ['confirmed empty', false, '0', true, undefined, 'zero'],
    ['cached empty refresh', false, undefined, false, 'zero', 'zero'],
    ['cached funded partial zero', false, '0', false, 'positive', 'positive'],
    ['funded account emptied', false, '0', true, 'positive', 'zero'],
    ['empty account funded', true, '0', false, 'zero', 'positive'],
    ['failed valuation', false, '--', false, undefined, 'unknown'],
  ] as const)(
    '%s',
    (_name, hasHoldings, total, complete, cachedState, expected) => {
      expect(
        resolveHomeBalanceState({ hasHoldings, total, complete, cachedState }),
      ).toBe(expected);
    },
  );
});
