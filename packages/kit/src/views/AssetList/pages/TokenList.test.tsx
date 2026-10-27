/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalAssetListRoutes,
  IModalAssetListParamList,
} from '@onekeyhq/shared/src/routes/assetList';

import { TokenList } from './TokenList';

type ITokenListParams =
  IModalAssetListParamList[EModalAssetListRoutes.TokenList];

let mockParams: ITokenListParams | undefined;
const mockPopToMainRoute = jest.fn();
const mockTokenListView = jest.fn();
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
  };
});

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
  withTokenListProvider: (component: unknown) => component,
}));

jest.mock('../../../components/TokenListView', () => ({
  TokenListView: (props: unknown) => {
    mockTokenListView(props);
    return null;
  },
}));

jest.mock('../../../components/TokenListView/perfTokenListView', () => ({
  perfTokenListView: { markEnd: jest.fn() },
}));

describe('TokenList route recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = undefined;
  });

  it('offers a safe exit without loading account data when params are absent', () => {
    render(<TokenList />);

    expect(
      screen.getByText(ETranslations.global_unknown_error_retry_message),
    ).toBeTruthy();
    expect(mockTokenListView).not.toHaveBeenCalled();
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

    expect(mockTokenListView).toHaveBeenLastCalledWith(
      expect.objectContaining({
        accountId: mockParams.accountId,
        networkId: mockParams.networkId,
        onPressToken,
        hostTokenList: {
          tokens: mockParams.tokenList.tokens,
          smallBalanceTokens: [],
        },
        hostTokenListMap: mockParams.tokenList.map,
      }),
    );
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
    const renderCount = mockTokenListView.mock.calls.length;

    mockParams = undefined;
    rerender(<TokenList />);
    expect(
      screen.getByRole('button', { name: ETranslations.global_back }),
    ).toBeTruthy();
    expect(mockTokenListView).toHaveBeenCalledTimes(renderCount);

    mockParams = params;
    rerender(<TokenList />);
    expect(mockTokenListView).toHaveBeenLastCalledWith(
      expect.objectContaining({ accountId: params.accountId }),
    );
    expect(
      screen.queryByRole('button', { name: ETranslations.global_back }),
    ).toBeNull();
  });
});
