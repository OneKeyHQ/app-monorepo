/** @jest-environment jsdom */

import { act, render } from '@testing-library/react';

import type {
  IPrimeTransferData,
  IPrimeTransferSelectedItemMap,
} from '@onekeyhq/shared/types/prime/primeTransferTypes';

import { PrimeTransferPreviewList } from './PrimeTransferPreviewList.native';

import type {
  NativeListProps,
  NativeListTheme,
} from '@onekeyfe/react-native-native-list';

let mockListProps: NativeListProps;
const mockGetNetworksByIds = jest.fn(
  async (_params: { networkIds: string[] }) => ({ networks: [] }),
);
const mockTheme: NativeListTheme = {
  background: '#ffffff',
  rowBackground: '#ffffff',
  rowSelectedBackground: '#eeeeee',
  subduedBackground: '#eeeeee',
  primaryText: '#000000',
  secondaryText: '#555555',
  separator: '#eeeeee',
  accent: '#00aa00',
  positive: '#00aa00',
  negative: '#aa0000',
};
const mockIntl = {
  formatMessage: ({ id }: { id: string }, values?: { amount?: number }) =>
    values?.amount === undefined ? id : `${id}:${values.amount}`,
};
jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: {
    global_software_wallet: 'global_software_wallet',
    wallet_label_private_key: 'wallet_label_private_key',
    global_watched: 'global_watched',
    global_transfer_accounts_count: 'global_transfer_accounts_count',
    global_deselect_all: 'global_deselect_all',
    global_select_all: 'global_select_all',
  },
}));
jest.mock('react-intl', () => ({ useIntl: () => mockIntl }));
jest.mock('@onekeyfe/react-native-native-list', () => ({
  NativeList: (props: NativeListProps) => {
    mockListProps = props;
    return <div data-testid="native-list-host" />;
  },
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceNetwork: {
      getNetworksByIds: (params: { networkIds: string[] }) =>
        mockGetNetworksByIds(params),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (method: () => Promise<unknown>, deps: unknown[]) => {
    const React = jest.requireActual<typeof import('react')>('react');
    React.useEffect(() => {
      void method();
      // eslint-disable-next-line react-hooks/exhaustive-deps -- Mirror the mocked hook's dependency forwarding.
    }, deps);
    return { result: undefined };
  },
}));
jest.mock(
  '@onekeyhq/kit/src/views/AccountManagerStacks/pages/AccountSelectorStack/accountSelectorNativeListV2',
  () => ({
    useAccountSelectorNativeListThemeV2: () => mockTheme,
    accountSelectorWalletVisualV2: () => ({ kind: 'wallet' }),
    accountSelectorAccountVisualV2: ({
      account,
    }: {
      account: { address: string };
    }) => ({
      kind: 'account',
      image: {
        uri: `onekey-avatar://blockie/v1/${account.address}`,
        width: 32,
        height: 32,
      },
    }),
  }),
);
jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: { shortenAddress: ({ address }: { address: string }) => address },
}));
jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: { getLocalNetworkInfo: () => undefined },
}));

function fixture(count = 2) {
  const data = {
    privateData: {
      wallets: {
        wallet: {
          id: 'wallet',
          name: 'Wallet',
          walletOrder: 0,
          indexedAccountUUIDsLength: 12,
        },
      },
      importedAccounts: Object.fromEntries(
        Array.from({ length: count }, (_, index) => [
          `imported-${index}`,
          {
            id: `imported-${index}`,
            name: `Account ${index}`,
            address: `fixture-${index}`,
            accountOrder: count - index,
            createAtNetwork: 'evm--1',
          },
        ]),
      ),
      watchingAccounts: {
        watch: {
          id: 'watch',
          name: 'Watch',
          address: 'fixture-watch',
          accountOrder: 0,
          createAtNetwork: 'evm--1',
        },
      },
      credentials: { wallet: 'fixture-secret-must-not-enter-snapshot' },
    },
  } as unknown as IPrimeTransferData;
  const selectedItemMap: IPrimeTransferSelectedItemMap = {
    wallet: { wallet: { checked: true, disabled: false } },
    importedAccount: Object.fromEntries(
      Object.keys(data.privateData.importedAccounts).map((id) => [
        id,
        { checked: true, disabled: false },
      ]),
    ),
    watchingAccount: { watch: { checked: false, disabled: true } },
  };
  return { data, selectedItemMap };
}

beforeEach(() => {
  mockGetNetworksByIds.mockClear();
});

test('passes large grouped input to one native host without React account rows or credentials', async () => {
  const props = fixture(2000);
  const view = render(<PrimeTransferPreviewList {...props} />);
  await act(async () => undefined);
  expect(view.getAllByTestId('native-list-host')).toHaveLength(1);
  const { snapshot } = mockListProps;
  expect(snapshot.rows).toHaveLength(2005);
  expect(
    snapshot.rows
      .filter((row) => row.type === 'sectionHeader')
      .map((row) => row.sectionKey),
  ).toEqual(['wallet', 'importedAccount', 'watchingAccount']);
  // Both locked native renderers bind the value action only for summary headers.
  for (const row of snapshot.rows.filter(
    (item) => item.type === 'sectionHeader',
  )) {
    expect(row).toMatchObject({
      variant: 'summary',
      valueActionKey: 'toggle-group',
      height: 60,
      style: { horizontalPadding: 12, verticalPadding: 12 },
      valueActionTestID: `prime-transfer-${row.sectionKey}-select-all`,
    });
  }
  expect(snapshot.rows[3].key).toBe('importedAccount:imported-1999');
  expect(snapshot.selection?.selectedKeys).toHaveLength(2001);
  expect(snapshot.selection?.rowPressToggles).toBe(true);
  expect(mockListProps.style).toEqual({ flex: 1 });
  expect(JSON.stringify(snapshot)).not.toContain('fixture-secret');
  expect(snapshot).not.toHaveProperty('privateData');
  expect(new Set(snapshot.rows.map((row) => row.key)).size).toBe(
    snapshot.rows.length,
  );
  expect(mockGetNetworksByIds).toHaveBeenCalledTimes(1);
  expect(mockGetNetworksByIds).toHaveBeenCalledWith({ networkIds: ['evm--1'] });
});

test('maps explicit native selection deltas and ignores disabled or unknown rows', () => {
  const onItemSelectChange = jest.fn();
  render(
    <PrimeTransferPreviewList
      {...fixture()}
      onItemSelectChange={onItemSelectChange}
    />,
  );
  act(() =>
    mockListProps.onSelectionDelta?.({
      addedKeys: [
        'importedAccount:imported-0',
        'watchingAccount:watch',
        'missing',
      ],
      removedKeys: ['wallet:wallet'],
      source: 'row',
    }),
  );
  expect(onItemSelectChange.mock.calls).toEqual([
    [{ type: 'importedAccount', id: 'imported-0', checked: true }],
    [{ type: 'wallet', id: 'wallet', checked: false }],
  ]);
  // Repeated native deltas carry an explicit value; they must not invert it.
  act(() => {
    mockListProps.onSelectionDelta?.({
      addedKeys: [],
      removedKeys: ['importedAccount:imported-0'],
      source: 'row',
    });
    mockListProps.onSelectionDelta?.({
      addedKeys: ['importedAccount:imported-0'],
      removedKeys: [],
      source: 'row',
    });
    mockListProps.onSelectionDelta?.({
      addedKeys: ['importedAccount:imported-0'],
      removedKeys: [],
      source: 'row',
    });
  });
  expect(onItemSelectChange.mock.calls.slice(-3)).toEqual([
    [{ type: 'importedAccount', id: 'imported-0', checked: false }],
    [{ type: 'importedAccount', id: 'imported-0', checked: true }],
    [{ type: 'importedAccount', id: 'imported-0', checked: true }],
  ]);
});

test('keeps group select-all and deselect-all independent and does not refetch networks on selection', async () => {
  const props = fixture();
  const onGroupSelectChange = jest.fn();
  const view = render(
    <PrimeTransferPreviewList
      {...props}
      onGroupSelectChange={onGroupSelectChange}
    />,
  );
  await act(async () => undefined);
  act(() =>
    mockListProps.onRowAction?.({
      rowKey: 'header:importedAccount',
      sectionKey: 'importedAccount',
      actionKey: 'toggle-group',
    }),
  );
  expect(onGroupSelectChange).toHaveBeenLastCalledWith({
    type: 'importedAccount',
    selectAll: false,
  });
  view.rerender(
    <PrimeTransferPreviewList
      {...props}
      selectedItemMap={{
        ...props.selectedItemMap,
        importedAccount: {
          ...props.selectedItemMap.importedAccount,
          'imported-0': { checked: false, disabled: false },
        },
      }}
      onGroupSelectChange={onGroupSelectChange}
    />,
  );
  act(() =>
    mockListProps.onRowAction?.({
      rowKey: 'header:importedAccount',
      actionKey: 'toggle-group',
    }),
  );
  expect(onGroupSelectChange).toHaveBeenLastCalledWith({
    type: 'importedAccount',
    selectAll: true,
  });
  expect(mockGetNetworksByIds).toHaveBeenCalledTimes(1);
});

test('omits empty sections and keeps disabled rows unselected', () => {
  const props = fixture(0);
  render(<PrimeTransferPreviewList {...props} />);
  expect(
    mockListProps.snapshot.rows
      .filter((row) => row.type === 'sectionHeader')
      .map((row) => row.sectionKey),
  ).toEqual(['wallet', 'watchingAccount']);
  expect(
    mockListProps.snapshot.rows.find(
      (row) => row.key === 'watchingAccount:watch',
    )?.disabled,
  ).toBe(true);
  expect(mockListProps.snapshot.selection?.selectedKeys).toEqual([
    'wallet:wallet',
  ]);
});

test('batches distinct networks across imported and watching accounts', async () => {
  const props = fixture(3);
  props.data.privateData.importedAccounts['imported-1'].createAtNetwork =
    'btc--0';
  props.data.privateData.importedAccounts['imported-2'].createAtNetwork =
    undefined;
  props.data.privateData.watchingAccounts.watch.createAtNetwork = 'btc--0';
  render(<PrimeTransferPreviewList {...props} />);
  await act(async () => undefined);
  expect(mockGetNetworksByIds).toHaveBeenCalledTimes(1);
  expect(mockGetNetworksByIds).toHaveBeenCalledWith({
    networkIds: ['evm--1', 'btc--0'],
  });
});

test('skips network RPC when preview accounts have no network IDs', async () => {
  const props = fixture(1);
  props.data.privateData.importedAccounts['imported-0'].createAtNetwork =
    undefined;
  props.data.privateData.watchingAccounts.watch.createAtNetwork = undefined;
  render(<PrimeTransferPreviewList {...props} />);
  await act(async () => undefined);
  expect(mockGetNetworksByIds).not.toHaveBeenCalled();
});

test.each(['wallet', 'importedAccount', 'watchingAccount'] as const)(
  'excludes checked-but-disabled %s rows from native selection',
  (type) => {
    const props = fixture(1);
    const id = Object.keys(props.selectedItemMap[type])[0];
    props.selectedItemMap[type][id] = { checked: true, disabled: true };
    render(<PrimeTransferPreviewList {...props} />);
    const key = `${type}:${id}`;
    expect(mockListProps.snapshot.selection?.selectedKeys).not.toContain(key);
    const row = mockListProps.snapshot.rows.find((item) => item.key === key);
    expect(row?.disabled).toBe(true);
    expect(
      row?.type === 'identity' ? row.trailing?.[0] : undefined,
    ).toMatchObject({
      kind: 'checkbox',
      state: 'unchecked',
      disabled: true,
    });
  },
);
