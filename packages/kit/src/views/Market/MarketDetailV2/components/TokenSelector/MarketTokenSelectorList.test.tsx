/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { MarketTokenSelectorList } from './MarketTokenSelectorList';

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2', () => ({
  useMarketWatchListV2Atom: jest.fn(),
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => ({
  YStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Spinner: () => <div data-testid="loading" />,
  Empty: ({ title }: { title: string }) => <div>{title}</div>,
  Button: ({
    children,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    onPress: () => void;
    testID: string;
  }) => (
    <button type="button" data-testid={testID} onClick={onPress}>
      {children}
    </button>
  ),
  ListView: () => <div data-testid="list" />,
}));
jest.mock(
  '../../../MarketHomeV2/components/MarketTokenList/hooks/useMarketTokenList',
  () => ({ useMarketTokenList: jest.fn() }),
);
jest.mock(
  '../../../MarketHomeV2/components/MarketTokenList/hooks/useMarketWatchlistTokenList',
  () => ({ useMarketWatchlistTokenList: jest.fn() }),
);
jest.mock('./MarketTokenSelectorRow', () => ({
  MarketTokenSelectorRow: () => null,
}));
jest.mock('./selectorTable', () => ({
  SelectorTableHeader: () => <div data-testid="header" />,
}));
jest.mock('../../../MarketHomeV2/utils', () => ({
  isTrendingStyleSpotCategory: () => false,
}));
jest.mock('../../utils/marketDetailPreview', () => ({
  buildMarketSearchTokenDetailPreview: jest.fn(),
}));

describe('desktop Top Coins request states', () => {
  it('offers a retry after an empty failed request and returns to loading on retry', () => {
    const onRetry = jest.fn();
    const { rerender } = render(
      <MarketTokenSelectorList
        networkId=""
        onItemPress={jest.fn()}
        dataOverride={[]}
        dataOverrideError
        onDataOverrideRetry={onRetry}
      />,
    );
    expect(screen.getByTestId('header')).toBeTruthy();
    expect(screen.queryByTestId('list')).toBeNull();
    fireEvent.click(screen.getByTestId('market-token-selector-list-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
    rerender(
      <MarketTokenSelectorList
        networkId=""
        onItemPress={jest.fn()}
        dataOverride={[]}
        dataOverrideLoading
        onDataOverrideRetry={onRetry}
      />,
    );
    expect(screen.getByTestId('loading')).toBeTruthy();
    expect(screen.queryByTestId('market-token-selector-list-retry')).toBeNull();
  });
});
