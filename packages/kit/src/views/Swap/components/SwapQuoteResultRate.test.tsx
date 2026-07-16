/** @jest-environment jsdom */

import type { MouseEvent, ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import SwapQuoteResultRate from './SwapQuoteResultRate';

type IPrimitiveProps = {
  children?: ReactNode;
  onPress?: (event: MouseEvent<HTMLDivElement>) => void;
  testID?: string;
};

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Primitive = ({ children, onPress, testID }: IPrimitiveProps) =>
    React.createElement(
      'div',
      {
        'data-testid': testID,
        onClick: onPress,
      },
      children,
    );

  return {
    Badge: Primitive,
    Divider: Primitive,
    Icon: Primitive,
    Image: Primitive,
    LottieView: Primitive,
    NumberSizeableText: Primitive,
    SizableText: Primitive,
    Stack: Primitive,
    XStack: Primitive,
  };
});

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('./SwapRefreshButton', () => ({
  __esModule: true,
  default: () => null,
}));

const fromToken = {
  networkId: 'evm--1',
  contractAddress: '',
  symbol: 'ETH',
  decimals: 18,
} as ISwapToken;

const toToken = {
  networkId: 'evm--1',
  contractAddress: '0xusdc',
  symbol: 'USDC',
  decimals: 6,
} as ISwapToken;

describe('SwapQuoteResultRate provider selection', () => {
  it('does not expose the requesting provider trigger before a candidate is ready', () => {
    render(
      <SwapQuoteResultRate
        quoting
        isLoading
        fromToken={fromToken}
        toToken={toToken}
        providerSelectorTestID="provider-picker"
        refreshAction={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('provider-picker')).toBeNull();
  });

  it('opens the provider picker without toggling the parent result row', () => {
    const onOpenProviderList = jest.fn();
    const onParentPress = jest.fn();

    render(
      <button type="button" onClick={onParentPress}>
        <SwapQuoteResultRate
          quoting
          isLoading
          fromToken={fromToken}
          toToken={toToken}
          providerSelectorTestID="provider-picker"
          onOpenProviderList={onOpenProviderList}
          refreshAction={jest.fn()}
        />
      </button>,
    );

    fireEvent.click(screen.getByTestId('provider-picker'));

    expect(onOpenProviderList).toHaveBeenCalledTimes(1);
    expect(onParentPress).not.toHaveBeenCalled();
  });
});
