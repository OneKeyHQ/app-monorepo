/** @jest-environment jsdom */

import { render, screen } from '@testing-library/react';
import BigNumber from 'bignumber.js';

import { ESwapDirection } from '../hooks/useTradeType';

import { ActionButton } from './ActionButton';

const usePaymentTokenPriceMock = jest.fn();
type IMockPaymentTokenPriceResult = {
  price?: BigNumber;
  tokenKey?: string;
  isLoading: boolean;
  refetch: () => void;
};

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  Button: ({
    children,
    disabled,
    onPress,
  }: {
    children: React.ReactNode;
    disabled?: boolean;
    onPress?: (event?: unknown) => void;
  }) => (
    <button disabled={disabled} onClick={() => onPress?.()} type="button">
      {children}
    </button>
  ),
  resetToRoute: jest.fn(),
  useMedia: () => ({
    gtMd: false,
  }),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

jest.mock(
  '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorCreateAddress',
  () => ({
    useAccountSelectorCreateAddress: () => ({
      createAddress: jest.fn(),
    }),
  }),
);

jest.mock(
  '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorTrigger',
  () => ({
    useAccountSelectorTrigger: () => ({
      showAccountSelector: jest.fn(),
    }),
  }),
);

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({
    pushModal: jest.fn(),
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({
    result: false,
  }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: {
      account: {
        id: 'account-1',
      },
      wallet: {
        id: 'wallet-1',
      },
      deriveType: 'default',
      canCreateAddress: false,
    },
  }),
}));

jest.mock('../../../hooks/useTokenDetail', () => ({
  useTokenDetail: () => ({
    tokenDetail: {
      symbol: 'xStock BTC',
      price: '100',
    },
  }),
}));

jest.mock('../hooks/usePaymentTokenPrice', () => ({
  usePaymentTokenPrice: (...args: unknown[]) =>
    usePaymentTokenPriceMock(
      ...args,
    ) as unknown as IMockPaymentTokenPriceResult,
}));

jest.mock('@onekeyhq/shared/src/utils/numberUtils', () => ({
  numberFormat: (
    value: string,
    config?: {
      formatterOptions?: {
        tokenSymbol?: string;
        currency?: string;
      };
    },
  ) => {
    const suffix =
      config?.formatterOptions?.tokenSymbol ??
      config?.formatterOptions?.currency ??
      '';
    return suffix ? `${value} ${suffix}` : value;
  },
}));

describe('ActionButton', () => {
  beforeEach(() => {
    usePaymentTokenPriceMock.mockReset();
    usePaymentTokenPriceMock.mockReturnValue({
      price: new BigNumber('2500'),
      tokenKey: 'evm--1:0xpay',
      isLoading: false,
      refetch: jest.fn(),
    });
  });

  it('uses the fetched payment token price to build buy-side fiat text', () => {
    const paymentToken = {
      networkId: 'evm--1',
      contractAddress: '0xpay',
      symbol: 'USDC',
      decimals: 6,
      speedSwapDefaultAmount: [],
    };

    render(
      <ActionButton
        tradeType={ESwapDirection.BUY}
        amount="2"
        token={paymentToken}
        paymentToken={paymentToken}
        balance={new BigNumber(10)}
        networkId="evm--1"
        supportSpeedSwap
      />,
    );

    expect(usePaymentTokenPriceMock).toHaveBeenCalledWith(
      paymentToken,
      'evm--1',
    );
    expect(screen.getByRole('button').textContent).toContain('5000.00 $');
  });
});
