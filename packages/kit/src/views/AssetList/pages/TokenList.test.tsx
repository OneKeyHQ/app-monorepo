/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalAssetListRoutes,
  IModalAssetListParamList,
} from '@onekeyhq/shared/src/routes/assetList';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import { TokenList } from './TokenList';

import type { NativeListSnapshot } from '@onekeyfe/react-native-native-list';

type ITokenListParams =
  IModalAssetListParamList[EModalAssetListRoutes.TokenList];

let mockParams: ITokenListParams | undefined;
let mockSearchKey = '';
let mockHideValue = false;
const mockPopToMainRoute = jest.fn();
const mockNativeList = jest.fn();
const mockUpdateTokenListState = jest.fn();
const mockUpdateSearchKey = jest.fn();

jest.mock('@react-navigation/core', () => ({
  useRoute: () => ({ params: mockParams }),
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Container = ({ children }: { children?: ReactNode }) =>
    React.createElement('div', null, children);
  return {
    Page: Object.assign(Container, {
      Header: () => null,
      Body: Container,
    }),
    Button: ({
      children,
      onPress,
    }: {
      children?: ReactNode;
      onPress?: () => void;
    }) => React.createElement('button', { onClick: onPress }, children),
    Popover: () => null,
    HeaderIconButton: () => null,
    SizableText: Container,
    Stack: Container,
    XStack: Container,
    YStack: Container,
    LazyTooltip: () => null,
    useMedia: () => ({ gtMd: false }),
    useTheme: () => new Proxy({}, { get: () => ({ val: '#111111' }) }),
  };
});

jest.mock('@onekeyfe/react-native-native-list', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    NativeList: React.forwardRef(
      (props: { snapshot: NativeListSnapshot }, _ref) => {
        mockNativeList(props);
        return null;
      },
    ),
    validateSnapshot: (snapshot: NativeListSnapshot) => snapshot,
  };
});

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useCurrencyPersistAtom: () => [{ currencyMap: {} }],
  useSettingsPersistAtom: () => [{ currencyInfo: { id: 'usd' } }],
  useSettingsValuePersistAtom: () => [{ hideValue: mockHideValue }],
}));

jest.mock('../../../hooks/useThemeVariant', () => ({
  useThemeVariant: () => 'light',
}));

jest.mock('../../../components/Empty', () => ({
  EmptySearch: () => null,
  EmptyToken: () => null,
}));

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceNetwork: { getNetwork: jest.fn() } },
}));

jest.mock('../../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ popToMainRoute: mockPopToMainRoute, push: jest.fn() }),
}));

jest.mock('../../../states/jotai/contexts/tokenList', () => ({
  useTokenListActions: () => ({
    current: {
      updateTokenListState: mockUpdateTokenListState,
      updateSearchKey: mockUpdateSearchKey,
    },
  }),
  useSearchKeyAtom: () => [mockSearchKey],
  useSearchTokenListAtom: () => [{ tokens: [] }],
  useTokenListSortAtom: () => [{ sortType: 'value', sortDirection: 'desc' }],
  withTokenListProvider: (component: unknown) => component,
}));

jest.mock('../../../components/TokenListView/perfTokenListView', () => ({
  perfTokenListView: { markEnd: jest.fn() },
}));

describe('TokenList route recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = undefined;
    mockSearchKey = '';
    mockHideValue = false;
  });

  it('offers a safe exit without loading account data when params are absent', () => {
    render(<TokenList />);

    expect(
      screen.getByText(ETranslations.global_unknown_error_retry_message),
    ).toBeTruthy();
    expect(mockNativeList).not.toHaveBeenCalled();
    expect(mockUpdateTokenListState).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: ETranslations.global_back }),
    );
    expect(mockPopToMainRoute).toHaveBeenCalledTimes(1);
  });

  it('keeps valid route data and callbacks when the page rerenders', () => {
    const onPressToken = jest.fn();
    mockParams = {
      accountId: 'test-account',
      networkId: 'evm--1',
      walletId: 'test-wallet',
      tokenList: { tokens: [], keys: 'test-list', map: {} },
      onPressToken,
    };
    const { rerender } = render(<TokenList />);
    rerender(<TokenList />);

    const snapshot = mockNativeList.mock.lastCall?.[0]?.snapshot as
      | NativeListSnapshot
      | undefined;
    expect(snapshot?.rows).toEqual([]);
    expect(snapshot?.layout.kind).toBe('linear');
    expect(mockUpdateTokenListState).toHaveBeenCalledWith({
      initialized: true,
      isRefreshing: false,
    });
  });

  it('recovers if params disappear and renders again when they return', () => {
    const params: ITokenListParams = {
      accountId: 'test-account',
      networkId: 'evm--1',
      walletId: 'test-wallet',
      tokenList: { tokens: [], keys: 'test-list', map: {} },
    };
    mockParams = params;
    const { rerender } = render(<TokenList />);
    const renderCount = mockNativeList.mock.calls.length;

    mockParams = undefined;
    rerender(<TokenList />);
    expect(
      screen.getByRole('button', { name: ETranslations.global_back }),
    ).toBeTruthy();
    expect(mockNativeList).toHaveBeenCalledTimes(renderCount);

    mockParams = params;
    rerender(<TokenList />);
    expect(mockNativeList.mock.lastCall?.[0]?.snapshot.layout.kind).toBe(
      'linear',
    );
    expect(
      screen.queryByRole('button', { name: ETranslations.global_back }),
    ).toBeNull();
  });

  it('keeps formatted low-value rows tied to their route callback', () => {
    const token = {
      $key: 'low-value-token',
      symbol: 'LOW',
      name: 'Low value token',
      networkId: 'evm--1',
      address: '0x0000000000000000000000000000000000000001',
    } as IAccountToken;
    const fiat = {
      balance: '0.00000000000001',
      balanceParsed: '0.00000000000001',
      fiatValue: '0.00000000000001',
      price: 0.000_000_000_000_01,
      price24h: 0.5,
      currency: 'usd',
    } as ITokenFiat;
    const onPressToken = jest.fn();
    const params: ITokenListParams = {
      accountId: 'test-account',
      networkId: 'evm--1',
      walletId: 'test-wallet',
      tokenList: {
        tokens: [token],
        keys: 'test-list',
        map: { [token.$key]: fiat },
      },
      onPressToken,
    };
    mockParams = params;
    const { rerender } = render(<TokenList />);

    const props = mockNativeList.mock.lastCall?.[0] as {
      snapshot: NativeListSnapshot;
      onRowAction: (event: { rowKey: string; actionKey: string }) => void;
    };
    expect(props.snapshot.rows).toHaveLength(1);
    expect(props.snapshot.rows[0]).toEqual(
      expect.objectContaining({
        key: token.$key,
        type: 'identity',
        title: 'LOW',
        height: 60,
      }),
    );
    const row = props.snapshot.rows[0];
    expect(row.type).toBe('identity');
    if (row.type === 'identity')
      expect(row.trailing?.[0]).toEqual(
        expect.objectContaining({
          kind: 'valuePair',
          primaryTextSegments: expect.arrayContaining([
            expect.objectContaining({ style: 'subscript' }),
          ]),
          secondary: expect.any(String),
        }),
      );
    act(() => props.onRowAction({ rowKey: token.$key, actionKey: 'press' }));
    expect(onPressToken).toHaveBeenCalledWith(token);
    act(() => props.onRowAction({ rowKey: 'missing-row', actionKey: 'press' }));
    expect(onPressToken).toHaveBeenCalledTimes(1);

    mockParams = {
      ...params,
      tokenList: {
        ...params.tokenList,
        map: { [token.$key]: { ...fiat, fiatValue: '0.02' } },
      },
    };
    rerender(<TokenList />);
    const updatedProps = mockNativeList.mock.lastCall?.[0] as typeof props;
    act(() =>
      updatedProps.onRowAction({ rowKey: token.$key, actionKey: 'press' }),
    );
    expect(onPressToken).toHaveBeenCalledTimes(2);
    expect(onPressToken).toHaveBeenLastCalledWith(token);
  });

  it('keeps search, map priority, rebased balance, and privacy masking', () => {
    const alpha = {
      $key: 'alpha',
      symbol: 'ALPHA',
      networkId: 'evm--1',
    } as IAccountToken;
    const beta = {
      $key: 'beta',
      symbol: 'BETA',
      networkId: 'evm--1',
    } as IAccountToken;
    const directFiat = {
      balanceParsed: '2',
      balanceMultiplier: '3',
      fiatValue: '10',
      currency: 'usd',
      price: 1,
      price24h: 0,
    } as ITokenFiat;
    const aggregateFiat = {
      balanceParsed: '5',
      fiatValue: '20',
      currency: 'usd',
      price: 1,
      price24h: 0,
    } as ITokenFiat;
    mockParams = {
      accountId: 'test-account',
      networkId: 'evm--1',
      walletId: 'test-wallet',
      tokenList: {
        tokens: [beta, alpha],
        keys: 'test-list',
        map: { alpha: directFiat },
      },
      aggregateTokensMap: {
        alpha: { 'evm--1': { ...aggregateFiat, fiatValue: '1000' } },
        beta: { 'evm--1': aggregateFiat },
      },
      hideValue: true,
      searchKeyLengthThreshold: 2,
    };
    mockSearchKey = 'A';
    const { rerender } = render(<TokenList />);
    let rows = (
      mockNativeList.mock.lastCall?.[0]?.snapshot as NativeListSnapshot
    ).rows;
    expect(rows.map((row) => row.key)).toEqual(['alpha', 'beta']);
    const first = rows[0];
    expect(first.type).toBe('identity');
    if (first.type === 'identity')
      expect(first.trailing?.[0]).toEqual(
        expect.objectContaining({
          kind: 'valuePair',
          primary: '6',
          secondary: '10.00',
        }),
      );

    mockSearchKey = 'BETA';
    rerender(<TokenList />);
    rows = (mockNativeList.mock.lastCall?.[0]?.snapshot as NativeListSnapshot)
      .rows;
    expect(rows.map((row) => row.key)).toEqual(['beta']);
    const fallback = rows[0];
    expect(fallback.type).toBe('identity');
    if (fallback.type === 'identity')
      expect(fallback.trailing?.[0]).toEqual(
        expect.objectContaining({ primary: '5', secondary: '20.00' }),
      );
    mockHideValue = true;
    rerender(<TokenList />);
    rows = (mockNativeList.mock.lastCall?.[0]?.snapshot as NativeListSnapshot)
      .rows;
    const masked = rows[0];
    expect(masked.type).toBe('identity');
    if (masked.type === 'identity')
      expect(masked.trailing?.[0]).toEqual(
        expect.objectContaining({ primary: '****', secondary: '****' }),
      );
  });

  it('keeps network badges when a logo is unavailable', () => {
    const networkInfo = jest.spyOn(networkUtils, 'getLocalNetworkInfo');
    networkInfo.mockImplementation((id) =>
      id === 'custom--1'
        ? ({
            id,
            name: 'Custom',
            logoURI: '',
            isCustomNetwork: true,
          } as IServerNetwork)
        : undefined,
    );
    mockParams = {
      accountId: 'test-account',
      networkId: 'onekeyall',
      walletId: 'test-wallet',
      isAllNetworks: true,
      tokenList: {
        tokens: [
          { $key: 'custom', symbol: 'CUSTOM', networkId: 'custom--1' },
          { $key: 'aggregate', symbol: 'AGG', networkId: 'aggregate--0' },
          { $key: 'all', symbol: 'ALL', networkId: 'onekeyall--0' },
          { $key: 'unknown', symbol: 'UNKNOWN', networkId: 'evm--unknown' },
        ] as IAccountToken[],
        keys: 'test-list',
        map: {},
      },
    };

    try {
      render(<TokenList />);
      const rows = (
        mockNativeList.mock.lastCall?.[0]?.snapshot as NativeListSnapshot
      ).rows;
      const overlays = (key: string) => {
        const row = rows.find((item) => item.key === key);
        expect(row?.type).toBe('identity');
        return row?.type === 'identity' && row.leading?.kind === 'token'
          ? row.leading.overlays
          : undefined;
      };

      expect(overlays('custom')).toEqual(
        expect.arrayContaining([expect.objectContaining({ text: 'C' })]),
      );
      expect(overlays('aggregate')).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'AllNetworksSolid' }),
        ]),
      );
      expect(overlays('all')).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'AllNetworksSolid' }),
        ]),
      );
      expect(overlays('unknown')).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'GlobusOutline' }),
        ]),
      );
    } finally {
      networkInfo.mockRestore();
    }
  });
});
