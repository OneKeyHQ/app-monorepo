/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { TokenListView } from '.';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

const mockFooterMount = jest.fn();
const mockFooterUnmount = jest.fn();
let mockNativeProps: Record<string, unknown> = {};

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true, isNativeAndroid: false },
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Container = ({ children }: { children?: ReactNode }) =>
    React.createElement('div', null, children);
  const Button = ({
    children,
    testID,
    onPress,
  }: {
    children?: ReactNode;
    testID?: string;
    onPress?: () => void;
  }) =>
    React.createElement(
      'button',
      { 'data-testid': testID, onClick: onPress },
      children,
    );
  return {
    Button,
    SizableText: Container,
    Stack: Container,
    XStack: Container,
    YStack: Container,
  };
});
jest.mock('./NativeTokenSelectorList', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    NativeTokenSelectorList: (props: Record<string, unknown>) => {
      mockNativeProps = props;
      return React.createElement(
        'div',
        null,
        props.expandedContent as ReactNode,
        props.structureToggle as ReactNode,
        props.footer as ReactNode,
      );
    },
  };
});
jest.mock('./TokenListFooter', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    TokenListFooter: () => {
      React.useEffect(() => {
        mockFooterMount();
        return () => {
          mockFooterUnmount();
        };
      }, []);
      return React.createElement('div', { 'data-testid': 'expanded-footer' });
    },
  };
});
jest.mock('./TokenListHeader', () => ({ TokenListHeader: () => null }));
jest.mock('../Empty', () => ({
  EmptySearch: () => null,
  EmptyToken: () => null,
}));
jest.mock('../Empty/EmptyToken', () => ({ EmptyToken: () => null }));
jest.mock('../Loading', () => ({ ListLoading: () => null }));
jest.mock('../../views/AssetList/hooks/useTokenManagement', () => ({
  useTokenManagement: () => ({ customTokens: [] }),
}));
jest.mock('../../views/DAppConnection/hooks/useActiveTabDAppInfo', () => ({
  __esModule: true,
  default: () => ({ result: undefined }),
}));
jest.mock('../../hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ result: { networks: [] } }),
}));
jest.mock('../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('./perfTokenListView', () => ({
  perfTokenListView: {
    reset: jest.fn(),
    done: jest.fn(),
    markStart: jest.fn(),
    markEnd: jest.fn(),
  },
}));
jest.mock('../../states/jotai/contexts/tokenList', () => ({
  useActiveAccountTokenListAtom: () => [{ tokens: [] }],
  useActiveAccountTokenListStateAtom: () => [
    { initialized: true, isRefreshing: false },
  ],
  useListStructureAtom: () => [
    { ownerKey: '', generation: -1, ownedAggregateTokenListMap: {} },
  ],
  useSearchKeyAtom: () => [''],
  useSearchTokenListAtom: () => [{ tokens: [] }],
  useSearchTokenStateAtom: () => [{ isSearching: false }],
  useTokenListSortAtom: () => [{ sortType: 'default', sortDirection: 'desc' }],
  useTokenListStateAtom: () => [{ initialized: true, isRefreshing: false }],
  useTokenListContextData: () => ({ store: undefined }),
}));

const tokens = Array.from({ length: 8 }, (_, index) => ({
  $key: `token-${index}`,
  networkId: 'evm--1',
  address: `0x${index}`,
  symbol: `T${index}`,
  name: `Token ${index}`,
  decimals: 18,
  isNative: false,
}));

function renderList(owner = 'account-a', visibleTokens = tokens) {
  return (
    <TokenListView
      accountId={owner}
      networkId="evm--1"
      indexedAccountId={undefined}
      plainMode
      limit={2}
      withFooter
      hostTokenList={{ tokens: visibleTokens, smallBalanceTokens: [] }}
      hostTokenListMap={{}}
    />
  );
}

it('keeps one real expanded footer until the latest owner-scoped collapse ACK', async () => {
  (platformEnv as { isNative: boolean }).isNative = true;
  mockFooterMount.mockClear();
  mockFooterUnmount.mockClear();
  const view = render(renderList());
  await waitFor(() =>
    expect(screen.getByTestId('token-list-show-more-btn')).toBeTruthy(),
  );
  mockFooterMount.mockClear();
  mockFooterUnmount.mockClear();
  fireEvent.click(screen.getByTestId('token-list-show-more-btn'));
  await waitFor(() => expect(mockFooterMount).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByTestId('token-list-show-less-btn'));
  const oldCollapseId = (mockNativeProps.structuralTransition as { id: string })
    .id;
  expect(mockFooterUnmount).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId('token-list-show-more-btn'));
  fireEvent.click(screen.getByTestId('token-list-show-less-btn'));
  const latestCollapseId = (
    mockNativeProps.structuralTransition as { id: string }
  ).id;
  expect(latestCollapseId).not.toBe(oldCollapseId);
  act(() =>
    (mockNativeProps.onStructuralTransitionSettled as (event: unknown) => void)(
      {
        transitionId: oldCollapseId,
        status: 'completed',
        settledExpanded: false,
      },
    ),
  );
  expect(mockFooterUnmount).not.toHaveBeenCalled();
  act(() =>
    (mockNativeProps.onStructuralTransitionSettled as (event: unknown) => void)(
      {
        transitionId: latestCollapseId,
        status: 'completed',
        settledExpanded: false,
      },
    ),
  );
  await waitFor(() => expect(mockFooterUnmount).toHaveBeenCalledTimes(1));
  view.rerender(renderList('account-b'));
  expect(screen.queryByTestId('expanded-footer')).toBeNull();
  fireEvent.click(screen.getByTestId('token-list-show-more-btn'));
  fireEvent.click(screen.getByTestId('token-list-show-less-btn'));
  const newOwnerCollapseId = (
    mockNativeProps.structuralTransition as { id: string }
  ).id;
  expect(newOwnerCollapseId).not.toBe(latestCollapseId);
  act(() =>
    (mockNativeProps.onStructuralTransitionSettled as (event: unknown) => void)(
      {
        transitionId: latestCollapseId,
        status: 'completed',
        settledExpanded: false,
      },
    ),
  );
  expect(screen.getByTestId('expanded-footer')).toBeTruthy();
  act(() =>
    (mockNativeProps.onStructuralTransitionSettled as (event: unknown) => void)(
      {
        transitionId: newOwnerCollapseId,
        status: 'completed',
        settledExpanded: false,
      },
    ),
  );
  await waitFor(() =>
    expect(screen.queryByTestId('expanded-footer')).toBeNull(),
  );
  view.unmount();
});

it('releases a pending collapsed footer when disclosure becomes unavailable', async () => {
  (platformEnv as { isNative: boolean }).isNative = true;
  const view = render(renderList());
  await waitFor(() =>
    expect(screen.getByTestId('token-list-show-more-btn')).toBeTruthy(),
  );
  fireEvent.click(screen.getByTestId('token-list-show-more-btn'));
  fireEvent.click(screen.getByTestId('token-list-show-less-btn'));
  expect(mockNativeProps.expandedContent).toBeTruthy();
  view.rerender(renderList('account-a', []));
  await waitFor(() => expect(mockNativeProps.expandedContent).toBeUndefined());
  view.rerender(renderList());
  await waitFor(() =>
    expect(screen.getByTestId('token-list-show-more-btn')).toBeTruthy(),
  );
  expect(mockNativeProps.expandedContent).toBeUndefined();
  view.unmount();
});

it('keeps the existing web structural command without native disclosure slots', async () => {
  (platformEnv as { isNative: boolean }).isNative = false;
  const view = render(renderList());
  await waitFor(() =>
    expect(screen.getByTestId('token-list-show-more-btn')).toBeTruthy(),
  );
  fireEvent.click(screen.getByTestId('token-list-show-more-btn'));
  expect(mockNativeProps.structuralTransition).toMatchObject({
    durationMs: 220,
  });
  expect(mockNativeProps.disclosure).toBeUndefined();
  view.unmount();
  (platformEnv as { isNative: boolean }).isNative = true;
});
