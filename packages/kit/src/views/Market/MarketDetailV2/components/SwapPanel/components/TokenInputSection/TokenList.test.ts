/** @jest-environment jsdom */

import { createElement } from 'react';
import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

import { TokenList } from './TokenList';

const mockUseActiveAccount = jest.fn();
const mockUsePromiseResult = jest.fn();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/components', () => ({
  Skeleton: () => createElement('div', { 'data-testid': 'skeleton' }),
  YStack: ({ children }: { children?: ReactNode }) =>
    createElement('div', null, children),
}));
jest.mock('@onekeyhq/kit/src/components/ListItem', () => ({
  ListItem: ({ children }: { children?: ReactNode }) =>
    createElement('div', null, children),
}));
jest.mock('@onekeyhq/kit/src/components/TokenListItem', () => ({
  TokenListItem: () => createElement('div', { 'data-testid': 'token-row' }),
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (...args: unknown[]): unknown => {
    const result: unknown = mockUsePromiseResult(...args);
    return result;
  },
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: (): unknown => {
    const result: unknown = mockUseActiveAccount();
    return result;
  },
}));
jest.mock('./SwitchToTradePrompt', () => ({
  SwitchToTradePrompt: () => null,
}));

describe('TokenList loading gate', () => {
  const token = {
    contractAddress: '0xtoken',
    decimals: 18,
    networkId: 'evm--1',
    speedSwapDefaultAmount: [],
    symbol: 'TOKEN',
  };

  function renderTokenList({
    activeAccountReady,
    networkAccountId,
    sortTokensByValue = true,
    tokenDetailsAccountId,
  }: {
    activeAccountReady: boolean;
    networkAccountId?: string;
    sortTokensByValue?: boolean;
    tokenDetailsAccountId?: string;
  }) {
    mockUseActiveAccount.mockReturnValue({
      activeAccount: { ready: activeAccountReady },
    });
    mockUsePromiseResult
      .mockReturnValueOnce({
        isLoading: false,
        result: networkAccountId ? { id: networkAccountId } : null,
      })
      .mockReturnValueOnce({
        isLoading: false,
        result: {
          accountId: tokenDetailsAccountId,
          tokens: [token],
        },
      });

    render(
      createElement(TokenList, {
        onTradePress: jest.fn(),
        sortTokensByValue,
        tokens: [token],
      }),
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps the skeleton visible until the active account is ready', () => {
    renderTokenList({ activeAccountReady: false });

    expect(screen.getAllByTestId('skeleton')).not.toHaveLength(0);
    expect(screen.queryByTestId('token-row')).toBeNull();
  });

  it('keeps the skeleton visible while token details belong to another account', () => {
    renderTokenList({
      activeAccountReady: true,
      networkAccountId: 'account-1',
      tokenDetailsAccountId: 'account-2',
    });

    expect(screen.getAllByTestId('skeleton')).not.toHaveLength(0);
    expect(screen.queryByTestId('token-row')).toBeNull();
  });

  it('shows settled value-sorted rows only after account and requests align', () => {
    renderTokenList({
      activeAccountReady: true,
      networkAccountId: 'account-1',
      tokenDetailsAccountId: 'account-1',
    });

    expect(screen.queryByTestId('skeleton')).toBeNull();
    expect(screen.getByTestId('token-row')).toBeTruthy();
  });

  it('does not gate fixed-order token lists', () => {
    renderTokenList({
      activeAccountReady: false,
      sortTokensByValue: false,
    });

    expect(screen.queryByTestId('skeleton')).toBeNull();
    expect(screen.getByTestId('token-row')).toBeTruthy();
  });
});
