/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketTokenHolder } from '@onekeyhq/shared/types/marketV2';

import { Holders } from './Holders';

const mockCopy = jest.fn<void, [string]>();
const mockOpen = jest.fn<void, [unknown]>();
const mockHoldersState = {
  holders: [] as IMarketTokenHolder[],
  isRefreshing: undefined as boolean | undefined,
  isInitialPending: true,
};

jest.mock('@onekeyhq/components', () => {
  const Stack = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Stack,
    SizableText: Stack,
    ListEndIndicator: Stack,
    useClipboard: () => ({ copyText: mockCopy }),
  };
});

jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/useMarketHolders',
  () => ({
    useMarketHolders: () => mockHoldersState,
  }),
);

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('./components/HoldersSkeleton', () => ({
  HoldersSkeleton: () => <div>holders skeleton</div>,
}));

jest.mock('@onekeyhq/kit/src/utils/explorerUtils', () => ({
  openExplorerAddressUrl: (args: unknown) => mockOpen(args),
}));
jest.mock('@onekeyhq/kit/src/views/Home/hooks/useHomeNativeListTheme', () => ({
  useHomeNativeListTheme: () => ({}),
}));
jest.mock('./useHoldersScrollHost', () => ({
  useHoldersScrollHost: () => null,
}));
jest.mock('../../layout/MarketDetailScroll', () => ({
  useMarketDetailIsFocusedTab: () => true,
}));
jest.mock('@onekeyhq/kit/src/components/AppPager/AppPagerContent', () => ({
  AppPagerContent: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
jest.mock('@onekeyfe/react-native-native-list', () => ({
  planNativeListPatches: () => undefined,
  NativeList: ({
    snapshot,
    listEmpty,
    onRowAction,
  }: import('@onekeyfe/react-native-native-list').NativeListProps) =>
    snapshot.rows.length ? (
      <>
        {snapshot.rows.map(
          (row) =>
            row.type === 'dataRow' &&
            row.tableColumns?.flatMap((col) =>
              col.actions?.map((action) => (
                <button
                  type="button"
                  key={row.key + action.actionKey}
                  onClick={() =>
                    onRowAction?.({
                      rowKey: row.key,
                      actionKey: action.actionKey,
                    })
                  }
                >
                  {action.accessibilityLabel}
                </button>
              )),
            ),
        )}
      </>
    ) : (
      <>{listEmpty}</>
    ),
}));

it('shows a skeleton before dispatch and an empty state only after the request settles', () => {
  const { queryByText, rerender } = render(
    <Holders tokenAddress="0xa" networkId="evm--1" />,
  );
  expect(queryByText('holders skeleton')).toBeTruthy();
  expect(queryByText(ETranslations.dexmarket_details_nodata)).toBeNull();
  mockHoldersState.isInitialPending = false;
  mockHoldersState.isRefreshing = false;
  rerender(
    <Holders tokenAddress="0xa" networkId="evm--1" scrollEnabled={false} />,
  );
  expect(queryByText('holders skeleton')).toBeNull();
  expect(queryByText(ETranslations.dexmarket_details_nodata)).toBeTruthy();
});

it('copies and opens the full account on the selected network', () => {
  const address = '0x1234567890abcdef1234567890abcdef12345678';
  mockHoldersState.holders = [
    {
      accountAddress: address,
      percentage: '0.00',
      amount: '12',
      fiatValue: '2',
    },
  ];
  const { getByRole } = render(
    <Holders tokenAddress="0xa" networkId="evm--1" />,
  );
  fireEvent.click(
    getByRole('button', { name: ETranslations.global_copy_address }),
  );
  expect(mockCopy).toHaveBeenCalledWith(address);
  expect(mockOpen).not.toHaveBeenCalled();
  fireEvent.click(
    getByRole('button', {
      name: ETranslations.global_view_in_blockchain_explorer,
    }),
  );
  expect(mockOpen).toHaveBeenCalledWith({
    networkId: 'evm--1',
    address,
    openInExternal: true,
  });
  expect(mockCopy).toHaveBeenCalledTimes(1);
});
