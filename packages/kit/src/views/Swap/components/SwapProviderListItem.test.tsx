/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IFetchQuoteResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import SwapProviderListItem from './SwapProviderListItem';

jest.mock('@onekeyhq/components', () => {
  function MockStack({ children }: PropsWithChildren) {
    return <div>{children}</div>;
  }
  return {
    Badge: MockStack,
    HeightTransition: MockStack,
    Icon: MockStack,
    NATIVE_HIT_SLOP: {},
    NumberSizeableText: MockStack,
    SizableText: MockStack,
    Stack: MockStack,
    Tooltip: MockStack,
    XStack: MockStack,
  };
});
jest.mock('moti', () => ({
  MotiView: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));
jest.mock('react-native', () => ({
  I18nManager: { isRTL: false },
  StyleSheet: { hairlineWidth: 1 },
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }, values?: Record<string, string>) =>
      values ? `${id}: ${values.amount} ${values.token}` : id,
  }),
}));
jest.mock('./SwapProviderIcon', () => ({
  SwapProviderIcon: () => null,
}));
jest.mock('./SwapRoutePaths', () => ({
  __esModule: true,
  default: () => null,
}));

const token: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xtoken',
  symbol: 'USDT',
  decimals: 18,
};
const quote: IFetchQuoteResult = {
  info: { provider: 'SwapQuickeXPrivateSend', providerName: 'Quickex' },
  fromTokenInfo: token,
  toTokenInfo: token,
};

function renderQuote({
  result,
  amount = '100000',
  disabled = true,
}: {
  result: IFetchQuoteResult;
  amount?: string;
  disabled?: boolean;
}) {
  return render(
    <SwapProviderListItem
      providerResult={result}
      currencySymbol="$"
      fromToken={token}
      toToken={token}
      fromTokenAmount={amount}
      disabled={disabled}
    />,
  );
}

it.each([
  {
    amount: '100000',
    limit: { max: '9000' },
    expectedId: ETranslations.provider_max_amount_required,
    displayedAmount: '9,000',
  },
  {
    amount: '0.5',
    limit: { min: '1' },
    expectedId: ETranslations.provider_min_amount_required,
    displayedAmount: '1',
  },
])(
  'shows the actual limit for an unavailable quote without toAmount (%j)',
  ({ amount, limit, expectedId, displayedAmount }) => {
    renderQuote({ result: { ...quote, limit }, amount });

    expect(
      screen.getByText(`${expectedId}: ${displayedAmount} USDT`),
    ).toBeTruthy();
    expect(
      screen.queryByText(ETranslations.provider_route_unable_fetch_price),
    ).toBeNull();
  },
);

it('preserves the provider error when no limit is exceeded', () => {
  renderQuote({
    result: {
      ...quote,
      limit: { max: '9000' },
      errorMessage: 'Provider error',
    },
    amount: '9000',
  });

  expect(screen.getByText('Provider error')).toBeTruthy();
});

it('shows an exceeded limit before a provider error', () => {
  renderQuote({
    result: {
      ...quote,
      limit: { max: '9000' },
      errorMessage: 'Provider error',
    },
  });

  expect(
    screen.getByText(
      `${ETranslations.provider_max_amount_required}: 9,000 USDT`,
    ),
  ).toBeTruthy();
  expect(screen.queryByText('Provider error')).toBeNull();
});

it('falls back to the generic error when there is no quote or limit violation', () => {
  renderQuote({ result: { ...quote, limit: { max: '9000' } }, amount: '9000' });

  expect(
    screen.getByText(ETranslations.provider_route_unable_fetch_price),
  ).toBeTruthy();
});

it('displays an available quote when the amount is within its limit', () => {
  renderQuote({
    result: { ...quote, limit: { max: '9000' }, toAmount: '10' },
    amount: '1',
    disabled: false,
  });

  expect(screen.getByText('10 USDT')).toBeTruthy();
});
