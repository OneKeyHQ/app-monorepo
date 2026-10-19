/** @jest-environment jsdom */

import * as React from 'react';

import { act, fireEvent, render } from '@testing-library/react';

import { MobileMarketTokenFlatList } from './MobileMarketTokenFlatList';

const mockLoadMore = jest.fn();
let mockState = {
  data: [{ address: 'a', symbol: 'A', networkId: 'evm--1' }],
  isLoading: false,
  isLoadingMore: false,
  isError: false,
  isLoadMoreError: true,
  isNetworkSwitching: false,
  isProvisionalFirstPageResult: false,
  canLoadMore: true,
  loadMore: mockLoadMore,
  refetch: jest.fn(),
};
let mockEndReached: (() => boolean) | undefined;
function mockBox({ children }: React.PropsWithChildren) {
  return <div>{children}</div>;
}
jest.mock('@onekeyhq/components', () => ({
  Stack: mockBox,
  SizableText: mockBox,
  Spinner: () => <div data-testid="loading" />,
  ListEndIndicator: () => null,
  Tabs: {},
  useScrollContentTabBarOffset: () => 0,
  Button: ({
    children,
    onPress,
    disabled,
  }: React.PropsWithChildren<{ onPress: () => void; disabled?: boolean }>) => (
    <button disabled={disabled} onClick={onPress}>
      {children}
    </button>
  ),
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: () => 'Retry' }),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));
let mockUpdate: () => void;
jest.mock('./hooks/useMarketTokenList', () => ({
  useMarketTokenList: () => {
    const [, update] = React.useReducer((value: number) => value + 1, 0);
    mockUpdate = update;
    return mockState;
  },
}));
jest.mock('../../layouts/mobileLayoutUtils', () => ({
  getMarketNativeCompactListStyle: () => ({}),
}));
jest.mock('./hooks/useToMarketDetailPage', () => ({
  useToDetailPage: () => jest.fn(),
}));
jest.mock('./utils/tokenListHelpers', () => ({
  shouldUseStockMetadataColumnsForTokens: () => false,
}));
jest.mock('./components/TokenListItem', () => ({ TokenListItem: () => null }));
jest.mock('./components/TokenListSkeleton', () => ({
  TokenListSkeleton: () => null,
}));
jest.mock('../MarketNativeList/marketNativeListRows', () => ({
  buildTokenMarketRow: jest.fn(),
}));
jest.mock('../MarketNativeList/WebMarketCompactList', () => ({
  WebMarketCompactList: ({
    footer,
    onEndReached,
  }: {
    footer: React.ReactNode;
    onEndReached: () => boolean;
  }) => {
    mockEndReached = onEndReached;
    return <div>{footer}</div>;
  },
}));
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/marketDetailImagePreload',
  () => ({ prewarmMarketTokenImages: jest.fn() }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/marketDetailPagePreload',
  () => ({ preloadMarketDetailV2Page: jest.fn() }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/resolveIsStockToken',
  () => ({ resolveMarketStockId: jest.fn() }),
);

it.each([375, 1920])(
  'offers one manual retry for failed same-row pagination at %ipx',
  async (width) => {
    window.innerWidth = width;
    mockLoadMore.mockReset();
    mockState = { ...mockState, isLoadMoreError: true, isLoadingMore: false };
    const props = {
      networkId: 'evm--1',
      listContainerProps: { paddingBottom: 0 },
    };
    const view = render(<MobileMarketTokenFlatList {...props} />);
    expect(mockEndReached?.()).toBe(false);
    expect(mockLoadMore).not.toHaveBeenCalled();
    mockLoadMore.mockImplementation(() => {
      mockState = { ...mockState, isLoadingMore: true, isLoadMoreError: false };
      return Promise.resolve();
    });
    fireEvent.click(view.getByRole('button', { name: 'Retry' }));
    act(() => mockUpdate());
    expect(mockLoadMore).toHaveBeenCalledTimes(1);
    expect(view.queryByRole('button')).toBeNull();
    expect(mockEndReached?.()).toBe(false);
    mockState = { ...mockState, isLoadingMore: false, isLoadMoreError: true };
    act(() => mockUpdate());
    mockLoadMore.mockImplementation(async () => undefined);
    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Retry' }));
    });
    expect(mockLoadMore).toHaveBeenCalledTimes(2);
    expect(view.getByRole('button', { name: 'Retry' })).toBeDefined();
    mockState = {
      ...mockState,
      isLoadMoreError: false,
      data: [
        ...mockState.data,
        { address: 'b', symbol: 'B', networkId: 'evm--1' },
      ],
    };
    act(() => mockUpdate());
    expect(view.queryByRole('button')).toBeNull();
  },
);
