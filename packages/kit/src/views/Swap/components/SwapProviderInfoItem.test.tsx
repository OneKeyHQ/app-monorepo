/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import SwapProviderInfoItem from './SwapProviderInfoItem';

jest.mock('@onekeyhq/components', () => {
  function MockStack({
    children,
    testID,
    onPress,
  }: PropsWithChildren<{ testID?: string; onPress?: () => void }>) {
    return onPress ? (
      <button type="button" data-testid={testID} onClick={onPress}>
        {children}
      </button>
    ) : (
      <div data-testid={testID}>{children}</div>
    );
  }
  return {
    Badge: MockStack,
    Icon: () => <span data-testid="provider-chevron" />,
    Image: () => <span data-testid="provider-icon" />,
    SizableText: MockStack,
    Skeleton: () => <span data-testid="provider-skeleton" />,
    Stack: MockStack,
    XStack: MockStack,
  };
});
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('./SwapServiceFeeOverview', () => ({
  SwapServiceFeeOverview: () => <span data-testid="provider-fee-help" />,
}));

const token: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '',
  symbol: 'ETH',
  decimals: 18,
};
const missingInputs = [
  { fromToken: undefined, toToken: token },
  { fromToken: token, toToken: undefined },
  { fromToken: undefined, toToken: undefined },
];

it.each(missingInputs)(
  'keeps the default placeholder without both token inputs (%j)',
  (tokens) => {
    const onPress = jest.fn();
    render(
      <SwapProviderInfoItem
        {...tokens}
        providerName="Configured provider"
        providerIcon="https://example.com/provider.png"
        onPress={onPress}
        showEmptyPlaceholder
      />,
    );

    expect(screen.queryByText('Configured provider')).toBeNull();
    expect(screen.getByTestId('provider-fee-help')).toBeTruthy();
    fireEvent.click(screen.getByText('--'));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.queryByTestId('provider-chevron')).toBeNull();
  },
);

it.each(missingInputs)(
  'shows opted-in metadata without enabling the action (%j)',
  (tokens) => {
    const onPress = jest.fn();
    render(
      <SwapProviderInfoItem
        {...tokens}
        providerName="Configured provider"
        providerIcon="https://example.com/provider.png"
        onPress={onPress}
        allowProviderWithoutTokens
        showEmptyPlaceholder
      />,
    );

    expect(screen.getByTestId('provider-icon')).toBeTruthy();
    fireEvent.click(screen.getByText('Configured provider'));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.queryByTestId('provider-chevron')).toBeNull();
  },
);

it.each([false, true])(
  'keeps provider actions available for real token inputs (opt-in=%s)',
  (allowProviderWithoutTokens) => {
    const onPress = jest.fn();
    render(
      <SwapProviderInfoItem
        fromToken={token}
        toToken={token}
        providerName="Quoted provider"
        providerIcon=""
        onPress={onPress}
        allowProviderWithoutTokens={allowProviderWithoutTokens}
      />,
    );

    fireEvent.click(screen.getByText('Quoted provider'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('provider-chevron')).toBeTruthy();
  },
);

it('does not invent metadata when the opt-in has neither name nor logo', () => {
  render(
    <SwapProviderInfoItem
      providerName=""
      providerIcon=""
      allowProviderWithoutTokens
      showEmptyPlaceholder
    />,
  );

  expect(screen.getByText('--')).toBeTruthy();
  expect(screen.queryByTestId('provider-icon')).toBeNull();
});
