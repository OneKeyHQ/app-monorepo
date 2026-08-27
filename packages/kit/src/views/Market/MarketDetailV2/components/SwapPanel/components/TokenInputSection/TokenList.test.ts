import {
  resolveTokenDetailsLoading,
  shouldShowValueSortedTokenListSkeleton,
} from './TokenList';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/components', () => ({
  Skeleton: () => null,
  YStack: () => null,
}));
jest.mock('@onekeyhq/kit/src/components/ListItem', () => ({
  ListItem: () => null,
}));
jest.mock('@onekeyhq/kit/src/components/TokenListItem', () => ({
  TokenListItem: () => null,
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: jest.fn(),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: jest.fn(),
}));
jest.mock('./SwitchToTradePrompt', () => ({
  SwitchToTradePrompt: () => null,
}));

describe('TokenList loading gate', () => {
  const settledParams = {
    activeAccountReady: true,
    networkAccountId: 'account-1',
    networkAccountLoading: false,
    shouldFetchTokenDetails: true,
    tokenDetailsAccountId: 'account-1',
    tokenDetailsRequestLoading: false,
  };

  it('keeps the skeleton visible until the active account is ready', () => {
    expect(
      resolveTokenDetailsLoading({
        ...settledParams,
        activeAccountReady: false,
        networkAccountId: undefined,
        tokenDetailsAccountId: undefined,
      }),
    ).toBe(true);
  });

  it('keeps the skeleton visible while token details belong to another account', () => {
    expect(
      resolveTokenDetailsLoading({
        ...settledParams,
        tokenDetailsAccountId: 'account-2',
      }),
    ).toBe(true);
  });

  it('shows settled value-sorted rows only after account and requests align', () => {
    expect(resolveTokenDetailsLoading(settledParams)).toBe(false);
  });

  it('does not gate fixed-order token lists', () => {
    expect(
      shouldShowValueSortedTokenListSkeleton({
        isTokenDetailsLoading: true,
        sortTokensByValue: false,
      }),
    ).toBe(false);
  });
});
