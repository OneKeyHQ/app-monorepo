/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EStrk20ErrorCode } from '@onekeyhq/shared/types/starknetPrivacy';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { StarknetPrivateHistory } from './StarknetPrivateHistory';

import type { useStarknetPrivateHistory } from '../hooks/useStarknetPrivateHistory';

const mockObserver = jest.fn(
  (_props: {
    enabled: boolean;
    hasMore?: boolean;
    progressKey: string;
    onEndReached: () => void;
  }) => null,
);
jest.mock(
  '@onekeyhq/kit/src/views/AssetDetails/pages/TokenDetails/TokenDetailsPager',
  () => ({
    TokenDetailsPaginationObserver: (
      props: Parameters<typeof mockObserver>[0],
    ) => mockObserver(props),
  }),
);

let mockHistory: ReturnType<typeof useStarknetPrivateHistory>;

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => {
  const View = ({
    children,
    testID,
  }: {
    children?: ReactNode;
    testID?: string;
  }) => <div data-testid={testID}>{children}</div>;
  return { Button: View, Stack: View, YStack: View, SizableText: View };
});
jest.mock('../hooks/useStarknetPrivateHistory', () => ({
  useStarknetPrivateHistory: () => mockHistory,
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ push: jest.fn() }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
}));
jest.mock('@onekeyhq/kit/src/components/AppPager/useAppPagerPage', () => ({
  useAppPagerPage: () => ({ isFocused: true }),
}));
jest.mock('@onekeyhq/kit/src/components/AppPager/AppPagerContent', () => ({
  AppPagerContent: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));
jest.mock(
  '@onekeyhq/kit/src/views/Discovery/pages/Browser/WithBrowserProvider',
  () => ({
    withBrowserProvider: (component: unknown) => component,
  }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Home/components/HomeHistoryListView/NativeHistoryList',
  () => ({
    NativeHistoryList: ({
      ListHeaderComponent,
      ListEmptyComponent,
      ListFooterComponent,
      data,
    }: {
      ListHeaderComponent?: ReactNode;
      ListEmptyComponent?: ReactNode;
      ListFooterComponent?: ReactNode;
      data: IAccountHistoryTx[];
    }) => (
      <div>
        {ListHeaderComponent}
        {ListFooterComponent}
        {data.length ? (
          <span data-testid="history-rows">{data.length}</span>
        ) : null}
        {data.length === 0 && ListEmptyComponent === undefined ? (
          <span>No transactions</span>
        ) : null}
      </div>
    ),
  }),
);
jest.mock(
  '@onekeyhq/kit/src/views/AssetDetails/pages/TokenDetails/TokenPrivacyPanel',
  () => ({
    TokenPrivacyPanel: () => <span data-testid="history-error" />,
  }),
);

const props = {
  accountId: 'test-account',
  networkId: 'starknet--mainnet',
  walletId: 'test-wallet',
  tokenInfo: {
    address: '0x1',
    decimals: 18,
    symbol: 'STRK',
    name: 'Starknet',
    isNative: true,
  },
  ListHeaderComponent: <span data-testid="balance-header" />,
};

beforeEach(() => {
  mockObserver.mockClear();
  mockHistory = {
    txs: [],
    isEnabled: undefined,
    hasMore: false,
    cursorId: undefined,
    initialized: true,
    errorKey: ETranslations.privacy_balance_verification_pending__msg,
    errorCode: EStrk20ErrorCode.Locked,
    moreErrorKey: undefined,
    isLoading: false,
    loadingMore: false,
    loadMore: jest.fn(),
    reload: jest.fn(),
  };
});

it('does not show a password action or an empty result while private history is locked', () => {
  const ui = render(<StarknetPrivateHistory {...props} />);
  expect(ui.getByTestId('balance-header')).not.toBeNull();
  expect(ui.queryByText(ETranslations.transfer_verify_passcode)).toBeNull();
  expect(ui.queryByText('No transactions')).toBeNull();
  expect(ui.queryByTestId('history-error')).toBeNull();
});

it('renders private transactions after verification without the locked hint', () => {
  mockHistory.errorKey = undefined;
  mockHistory.errorCode = undefined;
  mockHistory.isEnabled = true;
  mockHistory.txs = [
    {
      id: '0x123',
      isLocalCreated: false,
      decodedTx: {
        txid: '0x123',
        owner: '0x1',
        signer: '0x1',
        nonce: 0,
        actions: [],
        extraInfo: null,
        status: EDecodedTxStatus.Confirmed,
        accountId: props.accountId,
        networkId: props.networkId,
      },
    },
  ];
  const ui = render(<StarknetPrivateHistory {...props} />);
  expect(ui.getByTestId('history-rows').textContent).toBe('1');
  expect(ui.queryByTestId('starknet-private-history-locked')).toBeNull();
});

it('keeps the history section hidden for an account without local opt-in', () => {
  mockHistory.errorKey = undefined;
  mockHistory.errorCode = undefined;
  mockHistory.isEnabled = false;
  const ui = render(<StarknetPrivateHistory {...props} />);
  expect(ui.getByTestId('balance-header')).not.toBeNull();
  expect(ui.queryByText('No transactions')).toBeNull();
});

it('pages an empty filtered web tab using the shared observer', () => {
  mockHistory.errorKey = undefined;
  mockHistory.errorCode = undefined;
  mockHistory.hasMore = true;
  const ui = render(<StarknetPrivateHistory {...props} isTabView />);
  expect(mockObserver).toHaveBeenCalledWith(
    expect.objectContaining({
      enabled: true,
      hasMore: true,
      onEndReached: mockHistory.loadMore,
    }),
  );
  expect(ui.queryByTestId('starknet-private-history-more')).toBeNull();
  expect(ui.queryByText('No transactions')).toBeNull();
  mockHistory.moreErrorKey = ETranslations.global_sync_error;
  ui.rerender(<StarknetPrivateHistory {...props} isTabView />);
  expect(mockObserver).toHaveBeenLastCalledWith(
    expect.objectContaining({ enabled: false }),
  );
  expect(ui.getByTestId('history-error')).not.toBeNull();
});

it('advances observer progressKey across consecutive empty filtered pages via cursorId', () => {
  mockHistory.errorKey = undefined;
  mockHistory.errorCode = undefined;
  mockHistory.hasMore = true;
  mockHistory.cursorId = 'cursor-page-1';

  const ui = render(<StarknetPrivateHistory {...props} isTabView />);
  const firstProgressKey = mockObserver.mock.lastCall?.[0].progressKey;
  expect(firstProgressKey).toContain('cursor-page-1');

  mockHistory = { ...mockHistory, cursorId: 'cursor-page-2' };
  ui.rerender(<StarknetPrivateHistory {...props} isTabView />);
  const secondProgressKey = mockObserver.mock.lastCall?.[0].progressKey;
  expect(secondProgressKey).toContain('cursor-page-2');
  expect(secondProgressKey).not.toBe(firstProgressKey);
});
