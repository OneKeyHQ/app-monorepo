/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, waitFor } from '@testing-library/react';

import { OptionList } from '@onekeyhq/kit/src/views/Staking/components/OptionList';
import type { IClaimableListItem } from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

const mockPop = jest.fn();

jest.mock('react-native', () => ({ StyleSheet: { hairlineWidth: 1 } }));

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pop: mockPop }),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsPersistAtom: () => [{ currencyInfo: { symbol: '$' } }],
}));
jest.mock('@onekeyhq/kit/src/components/Token', () => ({ Token: () => null }));
jest.mock('@onekeyhq/components', () => {
  const Container = ({
    children,
    onPress,
  }: {
    children?: ReactNode;
    onPress?: () => void;
  }) =>
    onPress ? (
      <button type="button" onClick={onPress}>
        {children}
      </button>
    ) : (
      <div>{children}</div>
    );
  return {
    Stack: Container,
    XStack: Container,
    YStack: Container,
    SizableText: Container,
    NumberSizeableText: Container,
    Badge: Object.assign(Container, { Text: Container }),
    Empty: ({ title }: { title: string }) => <div>{title}</div>,
    ListView: ({
      data,
      renderItem,
      ListEmptyComponent,
    }: {
      data: IClaimableListItem[];
      renderItem: (params: { item: IClaimableListItem }) => ReactNode;
      ListEmptyComponent?: React.ComponentType | ReactNode;
    }) => {
      if (!data.length) {
        return typeof ListEmptyComponent === 'function' ? (
          <ListEmptyComponent />
        ) : (
          ListEmptyComponent
        );
      }
      return (
        <div>
          {data.map((item) => (
            <div key={item.id}>{renderItem({ item })}</div>
          ))}
        </div>
      );
    },
    Page: {
      Footer: ({
        onConfirmText,
        onCancelText,
        confirmButtonProps,
        cancelButtonProps,
      }: {
        onConfirmText?: string;
        onCancelText?: string;
        confirmButtonProps: {
          onPress: () => void;
          disabled?: boolean;
          loading?: boolean;
        };
        cancelButtonProps: { onPress: () => void };
      }) => (
        <div>
          <button
            type="button"
            disabled={confirmButtonProps.disabled || confirmButtonProps.loading}
            onClick={confirmButtonProps.onPress}
          >
            {onConfirmText}
          </button>
          <button type="button" onClick={cancelButtonProps.onPress}>
            {onCancelText}
          </button>
        </div>
      ),
    },
  };
});

const token: IToken = {
  name: 'Liquid ETH',
  symbol: 'liquidETH',
  address: '0xf0bb20865277abd641a307ece5ee04e79073416c',
  decimals: 18,
  isNative: false,
};
const items = [
  { id: 'request-1', amount: '0.00001' },
  { id: 'request-2', amount: '0.00002' },
];

describe('OptionList request selection', () => {
  it('only invokes cancellation after confirming the selected request', async () => {
    const onPress = jest.fn();
    const screen = render(
      <OptionList
        token={token}
        items={items}
        onPress={onPress}
        onConfirmText="Cancel withdrawal"
        onCancelText="Close"
      />,
    );

    fireEvent.click(screen.getByText('0.00002'));
    expect(onPress).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel withdrawal' }));
    await waitFor(() =>
      expect(onPress).toHaveBeenCalledWith({ item: items[1] }),
    );
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows the normal empty state with cancel disabled and lets the user close the picker', () => {
    const screen = render(
      <OptionList
        token={token}
        items={[]}
        onConfirmText="Cancel withdrawal"
        onCancelText="Close"
      />,
    );
    expect(
      (
        screen.getByRole('button', {
          name: 'Cancel withdrawal',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.getByText('earn.no_orders')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(mockPop).toHaveBeenCalledTimes(1);
  });
});
