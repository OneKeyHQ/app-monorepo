/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IPrimeTransferData,
  IPrimeTransferSelectedItemMap,
} from '@onekeyhq/shared/types/prime/primeTransferTypes';

import { PrimeTransferPreviewList } from './PrimeTransferPreviewList';

import type { FlatListProps } from 'react-native';

const mockToast = jest.fn();
const mockIntl = { formatMessage: ({ id }: { id: string }) => id };
let mockNetworks = {};
jest.mock('react-intl', () => ({ useIntl: () => mockIntl }));
jest.mock('./usePrimeTransferPreviewNetworks', () => ({
  usePrimeTransferPreviewNetworks: () => mockNetworks,
}));
jest.mock('@onekeyhq/components', () => {
  const { FlatList } =
    jest.requireActual<typeof import('react-native')>('react-native');
  const Container = ({
    children,
    onPress,
  }: {
    children?: ReactNode;
    onPress?: () => void;
  }) => {
    if (!onPress) return <div>{children}</div>;
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onPress}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onPress();
          }
        }}
      >
        {children}
      </div>
    );
  };
  return {
    Stack: Container,
    XStack: Container,
    YStack: Container,
    SizableText: Container,
    Button: ({
      children,
      onPress,
    }: {
      children?: ReactNode;
      onPress: () => void;
    }) => (
      <button type="button" onClick={onPress}>
        {children}
      </button>
    ),
    Checkbox: ({
      value,
      disabled,
      onChange,
      onChangeForDisabled,
    }: {
      value: boolean;
      disabled: boolean;
      onChange: () => void;
      onChangeForDisabled: () => void;
    }) => (
      <button
        type="button"
        role="checkbox"
        aria-label="Select account"
        aria-checked={value}
        aria-disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          if (disabled) onChangeForDisabled();
          else onChange();
        }}
      />
    ),
    // Keep the actual browser FlatList windowing implementation in this test.
    ListView: (props: FlatListProps<unknown>) => <FlatList {...props} />,
    Toast: {
      error: (params: unknown) => {
        mockToast(params);
      },
    },
  };
});
jest.mock('@onekeyhq/kit/src/components/AccountAvatar', () => ({
  AccountAvatar: ({ networkId }: { networkId?: string }) => (
    <span data-testid="account-avatar" data-network={networkId} />
  ),
}));
jest.mock('@onekeyhq/kit/src/components/WalletAvatar', () => ({
  WalletAvatar: () => null,
}));
jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: { shortenAddress: ({ address }: { address: string }) => address },
}));

function fixture(count = 2) {
  const data = {
    privateData: {
      wallets: {},
      importedAccounts: Object.fromEntries(
        Array.from({ length: count }, (_, index) => [
          `account-${index}`,
          {
            id: `account-${index}`,
            name: `Account ${index}`,
            address: `fixture-${index}`,
            accountOrder: index,
            createAtNetwork: 'evm--1',
          },
        ]),
      ),
      watchingAccounts: {},
    },
  } as unknown as IPrimeTransferData;
  const selectedItemMap: IPrimeTransferSelectedItemMap = {
    wallet: {},
    importedAccount: Object.fromEntries(
      Object.keys(data.privateData.importedAccounts).map((id) => [
        id,
        { checked: true, disabled: false },
      ]),
    ),
    watchingAccount: {},
  };
  return { data, selectedItemMap };
}
beforeEach(() => {
  mockToast.mockClear();
  mockNetworks = {};
});

test('browser FlatList mounts a bounded initial window for 2000 accounts', () => {
  const view = render(<PrimeTransferPreviewList {...fixture(2000)} />);
  expect(view.getAllByTestId('account-avatar').length).toBeLessThanOrEqual(12);
  expect(view.getAllByTestId('account-avatar').length).toBeGreaterThan(0);
  expect(view.queryByText('Account 1999')).toBeNull();
});

test('preserves disabled checkbox Toast without changing selection', () => {
  const props = fixture(1);
  props.selectedItemMap.importedAccount['account-0'] = {
    checked: false,
    disabled: true,
  };
  const onItemSelectChange = jest.fn();
  const view = render(
    <PrimeTransferPreviewList
      {...props}
      onItemSelectChange={onItemSelectChange}
    />,
  );
  fireEvent.click(view.getByRole('checkbox'));
  expect(mockToast).toHaveBeenCalledTimes(1);
  expect(onItemSelectChange).not.toHaveBeenCalled();
});

test('updates checked state and group action after rerender', () => {
  const props = fixture(1);
  const onItemSelectChange = jest.fn();
  const onGroupSelectChange = jest.fn();
  const view = render(
    <PrimeTransferPreviewList
      {...props}
      onItemSelectChange={onItemSelectChange}
      onGroupSelectChange={onGroupSelectChange}
    />,
  );
  fireEvent.click(view.getByRole('checkbox'));
  expect(onItemSelectChange).toHaveBeenCalledWith({
    type: 'importedAccount',
    id: 'account-0',
  });
  const selectedItemMap = {
    ...props.selectedItemMap,
    importedAccount: { 'account-0': { checked: false, disabled: false } },
  };
  view.rerender(
    <PrimeTransferPreviewList
      {...props}
      selectedItemMap={selectedItemMap}
      onGroupSelectChange={onGroupSelectChange}
    />,
  );
  expect(view.getByRole('checkbox').getAttribute('aria-checked')).toBe('false');
  fireEvent.click(
    view.getByRole('button', { name: ETranslations.global_select_all }),
  );
  expect(onGroupSelectChange).toHaveBeenCalledWith({
    type: 'importedAccount',
    selectAll: true,
  });
});

test('does not give avatars a network ID until batch metadata is available', () => {
  const props = fixture(1);
  const view = render(<PrimeTransferPreviewList {...props} />);
  expect(
    view.getByTestId('account-avatar').getAttribute('data-network'),
  ).toBeNull();
  mockNetworks = { 'evm--1': { id: 'evm--1' } };
  view.rerender(<PrimeTransferPreviewList {...props} />);
  expect(view.getByTestId('account-avatar').getAttribute('data-network')).toBe(
    'evm--1',
  );
});
