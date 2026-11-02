/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

// OK-63928: recent rows are memoized on their data only, so a row kept the
// `onPress` closure from its first render. When the list painted at once from
// the session cache, that closure predated the Send page's vault settings and
// wrote an empty memo/note on tap. A tap must always reach the latest
// `onSelect` the parent passed down.

import type { ReactNode } from 'react';

type IBoxProps = { children?: ReactNode };
const mockNativeSnapshots: NativeListProps['snapshot'][] = [];
let mockNativeRowAction: NativeListProps['onRowAction'];

const mockRecentData = {
  recentRecipients: [
    {
      input: 'UQADDR',
      validAddress: 'UQADDR',
      walletId: 'hd-1',
      walletAccountName: 'Hidden #1 / Account #1',
      recipientMemo: '123456789',
      lastTransferTime: 1,
      lastTransferNetworkName: 'Ethereum',
    },
  ],
  isLoadingRecent: false,
  isLoadingMore: false,
  lastUsedDeriveType: undefined,
};

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
    locale: 'en',
  }),
}));
jest.mock('@onekeyfe/react-native-native-list', () => ({
  NativeList: ({ snapshot, onRowAction }: NativeListProps) => {
    mockNativeRowAction = onRowAction;
    mockNativeSnapshots.push(snapshot);
    return null;
  },
}));
jest.mock(
  '@onekeyhq/kit/src/views/AccountManagerStacks/pages/AccountSelectorStack/accountSelectorNativeListV2',
  () => ({
    useAccountSelectorNativeListThemeV2: () => ({}),
  }),
);
jest.mock('@onekeyhq/components', () => {
  const Box = ({ children }: IBoxProps) => <>{children}</>;
  const Text = ({ children }: IBoxProps) => <span>{children}</span>;
  const Nothing = () => null;
  return {
    ActionList: Object.assign(Nothing, { show: jest.fn() }),
    Divider: Nothing,
    Empty: Nothing,
    MatchSizeableText: Text,
    SizableText: Text,
    Spinner: Nothing,
    Stack: Box,
    XStack: Box,
  };
});
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/kit/src/components/ListItem', () => ({
  ListItem: Object.assign(() => null, { IconButton: () => null }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: jest.fn() }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useDebounce', () => ({
  useDebounce: <T,>(value: T) => value,
}));
// Stable like the real hook (useCallback), so the row memo comparator sees an
// unchanged formatRelativeTime and really skips the re-render.
const mockFormatDistanceToNowStrict = () => '';
jest.mock('@onekeyhq/kit/src/hooks/useFormatDate', () => ({
  __esModule: true,
  default: () => ({
    formatDistanceToNowStrict: mockFormatDistanceToNowStrict,
  }),
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (
    _fn: unknown,
    _deps: unknown,
    options?: { initResult?: unknown },
  ) => ({ result: options?.initResult, isLoading: false, run: jest.fn() }),
}));
jest.mock('@onekeyhq/kit/src/utils/botWalletAccountUtils', () => ({
  isAddressOwnedByDeactivatedBotWallet: async () => false,
}));
jest.mock('@onekeyhq/kit/src/utils/botWalletDisabledToast', () => ({
  showBotWalletDisabledToast: jest.fn(),
}));
jest.mock('./QuickSelectListShared', () => ({
  QuickSelectListItemFrame: ({
    onPress,
    testID,
  }: {
    onPress?: () => void;
    testID?: string;
  }) => (
    <button
      type="button"
      aria-label={testID}
      data-testid={testID}
      onClick={onPress}
    />
  ),
  QuickSelectListSkeleton: () => null,
}));
jest.mock('./useRecentRecipientsData', () => ({
  useRecentRecipientsData: () => mockRecentData,
}));

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { ActionList } from '@onekeyhq/components';

import RecentRecipients from './RecentRecipients';

import type {
  NativeListProps,
  RowActionEvent,
} from '@onekeyfe/react-native-native-list';

/*
yarn jest packages/kit/src/views/Send/pages/SendDataInput/RecentRecipients.latestSelect.test.tsx
*/

describe('RecentRecipients row press', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNativeRowAction = undefined;
  });

  it('reaches the latest onSelect after the parent re-renders with a new handler', async () => {
    const firstOnSelect = jest.fn();
    const latestOnSelect = jest.fn();
    const { rerender } = render(
      <RecentRecipients
        compact
        accountId="acc-1"
        networkId="ton--mainnet"
        onSelect={firstOnSelect}
      />,
    );
    // Same rows, new handler: the parent learned its vault settings and now
    // passes a handler that knows how to fill the memo field.
    rerender(
      <RecentRecipients
        compact
        accountId="acc-1"
        networkId="ton--mainnet"
        onSelect={latestOnSelect}
      />,
    );

    fireEvent.click(screen.getByTestId('recent-item-UQADDR'));

    await waitFor(() =>
      expect(latestOnSelect).toHaveBeenCalledWith({
        address: 'UQADDR',
        memo: '123456789',
      }),
    );
    expect(firstOnSelect).not.toHaveBeenCalled();
  });

  it('passes Recent network and time as separate plain title suffixes', () => {
    mockNativeSnapshots.length = 0;
    const previousName = mockRecentData.recentRecipients[0].walletAccountName;
    mockRecentData.recentRecipients[0].walletAccountName = '';
    render(
      <RecentRecipients nativeList accountId="acc-1" networkId="evm--1" />,
    );

    const rows = mockNativeSnapshots.at(-1)?.rows as
      | { titleSuffixes?: unknown[]; badges?: unknown[] }[]
      | undefined;
    expect(rows?.[0]?.titleSuffixes).toEqual([
      { text: 'Ethereum', tone: 'disabled', maxWidth: 96 },
      { text: expect.any(String), tone: 'disabled' },
    ]);
    expect(rows?.[0]?.badges).toBeUndefined();
    mockRecentData.recentRecipients[0].walletAccountName = previousName;
  });

  it.each([true, false])(
    'anchors the native-row menu with rect=%s and ignores a missing row',
    (hasAnchor) => {
      render(
        <RecentRecipients nativeList accountId="acc-1" networkId="evm--1" />,
      );
      const event: RowActionEvent = {
        actionKey: 'menu',
        rowKey: '0-UQADDR',
        windowPoint: { x: 300, y: 400 },
        anchor: hasAnchor
          ? {
              token: 'recent-menu',
              windowRect: { x: 100, y: 200, width: 40, height: 32 },
              source: 'trailingAccessory',
              generation: 1,
              layoutDirection: 'ltr',
            }
          : undefined,
      };
      act(() => mockNativeRowAction?.(event));
      expect(ActionList.show).toHaveBeenCalledWith(
        expect.objectContaining({
          triggerRect: event.anchor?.windowRect,
          triggerPosition: hasAnchor ? undefined : event.windowPoint,
        }),
      );
      act(() =>
        mockNativeRowAction?.({ ...event, rowKey: 'missing-recipient' }),
      );
      expect(ActionList.show).toHaveBeenCalledTimes(1);
    },
  );
});
