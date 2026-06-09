/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import BigNumber from 'bignumber.js';

import { EModalRoutes, EModalSwapRoutes } from '@onekeyhq/shared/src/routes';
import {
  ESwapSource,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { ESwapDirection } from '../hooks/useTradeType';

import { ActionButton } from './ActionButton';

const pushModalMock = jest.fn();
const showAccountSelectorMock = jest.fn();
const createAddressMock = jest.fn();

jest.mock('@onekeyhq/components', () => ({
  Button: ({
    children,
    disabled,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    disabled?: boolean;
    onPress?: () => void;
    testID?: string;
  }) => (
    <button
      data-testid={testID}
      disabled={disabled}
      onClick={onPress}
      type="button"
    >
      {children}
    </button>
  ),
  resetToRoute: jest.fn(),
  useMedia: () => ({ gtMd: false }),
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getNetworkAccount: jest.fn(),
    },
  },
}));

jest.mock(
  '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorCreateAddress',
  () => ({
    useAccountSelectorCreateAddress: () => ({
      createAddress: createAddressMock,
    }),
  }),
);

jest.mock(
  '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorTrigger',
  () => ({
    useAccountSelectorTrigger: () => ({
      showAccountSelector: showAccountSelectorMock,
    }),
  }),
);

jest.mock('@onekeyhq/kit/src/components/Currency', () => ({
  useCurrency: () => ({ symbol: '$' }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({
    pushModal: pushModalMock,
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ result: false }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: {
      account: { id: 'account-1' },
      indexedAccount: { id: 'indexed-account-1' },
      deriveType: 'default',
      canCreateAddress: false,
    },
  }),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isWeb: false,
  },
}));

jest.mock('@onekeyhq/shared/src/utils/numberUtils', () => ({
  numberFormat: (value: string) => value,
}));

jest.mock('../../../hooks/useTokenDetail', () => ({
  useTokenDetail: () => ({
    tokenDetail: {
      symbol: 'BTC',
    },
  }),
}));

jest.mock('../hooks/usePaymentTokenPrice', () => ({
  usePaymentTokenPrice: () => ({ price: new BigNumber(1) }),
}));

describe('Market ActionButton', () => {
  beforeEach(() => {
    pushModalMock.mockReset();
    showAccountSelectorMock.mockReset();
    createAddressMock.mockReset();
  });

  it('preserves bridge intent when falling back from a cross-chain-only market token', () => {
    render(
      <ActionButton
        amount="1"
        actionOtherToken={{
          networkId: 'evm--1',
          contractAddress: '0xpay',
          symbol: 'USDC',
          decimals: 6,
          isNative: false,
        }}
        actionToken={{
          networkId: 'btc--0',
          contractAddress: '',
          symbol: 'BTC',
          decimals: 8,
          isNative: true,
        }}
        balance={new BigNumber(10)}
        onlySupportCrossChain
        supportSpeedSwap={false}
        tradeType={ESwapDirection.BUY}
      />,
    );

    fireEvent.click(screen.getByTestId('market-btn'));

    expect(pushModalMock).toHaveBeenCalledWith(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapMainLand,
      params: expect.objectContaining({
        importFromToken: expect.objectContaining({ networkId: 'evm--1' }),
        importToToken: expect.objectContaining({ networkId: 'btc--0' }),
        swapSource: ESwapSource.MARKET,
        swapTabSwitchType: ESwapTabSwitchType.BRIDGE,
      }),
    });
  });
});
