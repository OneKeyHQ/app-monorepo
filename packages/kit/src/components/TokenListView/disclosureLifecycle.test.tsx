/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { TokenListView } from '.';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

const mockFooterMount = jest.fn();
const mockFooterUnmount = jest.fn();
let mockNativeProps: Record<string, unknown> = {};

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true, isNativeAndroid: false, isWeb: false },
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

it('keeps one expanded footer mounted through collapse and rapid reversal', async () => {
  (platformEnv as { isNative: boolean }).isNative = true;
  mockFooterMount.mockClear();
  mockFooterUnmount.mockClear();
  const view = render(renderList());
  await waitFor(() =>
    expect(screen.getByTestId('token-list-show-more-btn')).toBeTruthy(),
  );
  expect(mockFooterMount).not.toHaveBeenCalled();
  expect(mockNativeProps.expandedContent).toBeUndefined();
  expect(mockNativeProps.rows as unknown[]).toHaveLength(2);

  fireEvent.click(screen.getByTestId('token-list-show-more-btn'));
  await waitFor(() => expect(mockFooterMount).toHaveBeenCalledTimes(1));
  expect(mockNativeProps.rows as unknown[]).toHaveLength(8);
  fireEvent.click(screen.getByTestId('token-list-show-less-btn'));
  expect(mockNativeProps.rows as unknown[]).toHaveLength(2);
  expect(mockFooterUnmount).not.toHaveBeenCalled();
  const firstCollapseId = (
    mockNativeProps.structuralTransition as { id: string }
  ).id;
  fireEvent.click(screen.getByTestId('token-list-show-more-btn'));
  fireEvent.click(screen.getByTestId('token-list-show-less-btn'));
  expect((mockNativeProps.structuralTransition as { id: string }).id).not.toBe(
    firstCollapseId,
  );
  expect(mockNativeProps.rows as unknown[]).toHaveLength(2);
  expect(mockNativeProps.onStructuralTransitionSettled).toBeUndefined();
  expect(mockFooterMount).toHaveBeenCalledTimes(1);
  expect(mockFooterUnmount).not.toHaveBeenCalled();
  view.unmount();
  expect(mockFooterUnmount).toHaveBeenCalledTimes(1);
});

it('releases collapsed owner content and remounts an expanded owner', async () => {
  (platformEnv as { isNative: boolean }).isNative = true;
  mockFooterMount.mockClear();
  mockFooterUnmount.mockClear();
  const view = render(renderList());
  await waitFor(() =>
    expect(screen.getByTestId('token-list-show-more-btn')).toBeTruthy(),
  );
  fireEvent.click(screen.getByTestId('token-list-show-more-btn'));
  await waitFor(() => expect(mockFooterMount).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByTestId('token-list-show-less-btn'));
  view.rerender(renderList('account-b'));
  expect(screen.queryByTestId('expanded-footer')).toBeNull();
  expect(mockFooterUnmount).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByTestId('token-list-show-more-btn'));
  await waitFor(() => expect(mockFooterMount).toHaveBeenCalledTimes(2));
  view.rerender(renderList('account-c'));
  expect(screen.getByTestId('expanded-footer')).toBeTruthy();
  expect(mockFooterUnmount).toHaveBeenCalledTimes(2);
  expect(mockFooterMount).toHaveBeenCalledTimes(3);
  fireEvent.click(screen.getByTestId('token-list-show-less-btn'));
  expect(mockFooterUnmount).toHaveBeenCalledTimes(2);
  view.unmount();
  expect(mockFooterUnmount).toHaveBeenCalledTimes(3);
});

it('releases a collapsed footer when disclosure becomes unavailable', async () => {
  (platformEnv as { isNative: boolean }).isNative = true;
  mockFooterMount.mockClear();
  mockFooterUnmount.mockClear();
  const view = render(renderList());
  await waitFor(() =>
    expect(screen.getByTestId('token-list-show-more-btn')).toBeTruthy(),
  );
  fireEvent.click(screen.getByTestId('token-list-show-more-btn'));
  fireEvent.click(screen.getByTestId('token-list-show-less-btn'));
  expect(mockNativeProps.expandedContent).toBeTruthy();
  expect(mockFooterMount).toHaveBeenCalledTimes(1);
  view.rerender(renderList('account-a', []));
  await waitFor(() => expect(mockNativeProps.expandedContent).toBeUndefined());
  expect(mockFooterUnmount).toHaveBeenCalledTimes(1);
  view.rerender(renderList());
  await waitFor(() =>
    expect(screen.getByTestId('token-list-show-more-btn')).toBeTruthy(),
  );
  expect(mockNativeProps.expandedContent).toBeUndefined();
  expect(mockFooterMount).toHaveBeenCalledTimes(1);
  view.unmount();
});

it('keeps the Web footer mounted through collapse and releases it on owner change', async () => {
  const webEnv = platformEnv as { isNative: boolean; isWeb: boolean };
  webEnv.isNative = false;
  webEnv.isWeb = true;
  mockFooterMount.mockClear();
  mockFooterUnmount.mockClear();
  try {
    const view = render(renderList());
    await waitFor(() =>
      expect(screen.getByTestId('token-list-show-more-btn')).toBeTruthy(),
    );
    expect(mockFooterMount).not.toHaveBeenCalled();
    expect(mockNativeProps.expandedContent).toBeUndefined();

    fireEvent.click(screen.getByTestId('token-list-show-more-btn'));
    await waitFor(() => expect(mockFooterMount).toHaveBeenCalledTimes(1));
    expect(mockNativeProps.disclosure).toMatchObject({ expanded: true });
    expect(mockNativeProps.structuralTransition).toMatchObject({
      durationMs: 220,
    });
    fireEvent.click(screen.getByTestId('token-list-show-less-btn'));
    expect(mockNativeProps.disclosure).toMatchObject({ expanded: false });
    expect(mockFooterUnmount).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('token-list-show-more-btn'));
    fireEvent.click(screen.getByTestId('token-list-show-less-btn'));
    expect(mockFooterMount).toHaveBeenCalledTimes(1);
    expect(mockFooterUnmount).not.toHaveBeenCalled();

    view.rerender(renderList('account-b'));
    expect(mockFooterUnmount).toHaveBeenCalledTimes(1);
    expect(mockNativeProps.expandedContent).toBeUndefined();
    view.unmount();
  } finally {
    webEnv.isNative = true;
    webEnv.isWeb = false;
  }
});
