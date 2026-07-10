/** @jest-environment jsdom */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalAssetDetailRoutes } from '@onekeyhq/shared/src/routes/assetDetails';

const mockResolvedAction = {
  action: 'withdraw',
  protocolId: 'aave_v3',
  networkId: 'evm--1',
  positionCategory: 'lending',
  assetCategory: 'deposit',
  assets: [
    {
      asset: {
        symbol: 'WETH',
        address: '0xweth',
        amount: '0.004836',
        price: 1757,
        category: 'deposit',
        meta: { decimals: 18, logoUrl: 'weth.png' },
      },
      tokenAddress: '0xweth',
      amount: '0.004836',
      symbol: 'WETH',
      extraParams: { poolAddress: '0xpool' },
    },
    {
      asset: {
        symbol: 'USDC',
        address: '0xusdc',
        amount: '0.3265',
        price: 1,
        category: 'deposit',
        meta: { decimals: 6, logoUrl: 'usdc.png' },
      },
      tokenAddress: '0xusdc',
      amount: '0.3265',
      symbol: 'USDC',
      extraParams: { poolAddress: '0xpool' },
    },
  ],
};
const mockResolvedRepayAction = {
  action: 'repay',
  protocolId: 'aave_v3',
  networkId: 'evm--1',
  positionCategory: 'lending',
  debtCategory: 'borrow',
  assets: [
    {
      asset: {
        symbol: 'USDT',
        address: '0xusdt',
        amount: '1',
        price: 1,
        category: 'borrow',
        meta: { decimals: 6, logoUrl: 'usdt.png' },
      },
      tokenAddress: '0xusdt',
      amount: '1',
      symbol: 'USDT',
      extraParams: { poolAddress: '0xpool' },
    },
  ],
};
const mockPosition = {
  category: 'lending',
  assets: mockResolvedAction.assets.map((item) => item.asset),
  debts: [
    {
      symbol: 'USDT',
      address: '0xusdt',
      amount: '1',
      price: 1,
      category: 'borrow',
      meta: { decimals: 6 },
    },
  ],
  rewards: [],
  sourcePositions: [],
  poolAddress: '0xpool',
};
const mockPushModal = jest.fn();
const mockInPageDialog = {};
const mockGetBorrowMarkets = jest.fn();

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
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
    }) =>
      React.createElement(
        'button',
        {
          'data-testid': testID,
          disabled,
          onClick: onPress,
        },
        children,
      ),
    SizableText: ({ children }: { children?: ReactNode }) =>
      React.createElement('span', undefined, children),
    XStack: ({ children }: { children?: ReactNode }) =>
      React.createElement('div', undefined, children),
    useInPageDialog: () => mockInPageDialog,
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      getBorrowMarkets: mockGetBorrowMarkets,
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: mockPushModal }),
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  // Keep the legacy Borrow route eligible so this test catches a regression
  // that overrides the resolved Portfolio action again.
  usePromiseResult: () => ({
    result: [
      {
        provider: 'aave',
        networkId: 'evm--1',
        marketAddress: '0xpool',
      },
    ],
    isLoading: false,
  }),
}));

jest.mock('@onekeyhq/shared/src/utils/defiActionUtils', () => ({
  __esModule: true,
  default: {
    getPositionRewardAssets: () => [],
    positionHasDebts: () => true,
    positionHasRewards: () => false,
    resolveDeFiPositionActions: () => [
      mockResolvedAction,
      mockResolvedRepayAction,
    ],
    scopeResolvedActionToAsset: ({
      action,
      tokenAddress,
    }: {
      action: typeof mockResolvedAction;
      tokenAddress: string;
    }) => {
      const assets = action.assets.filter(
        (asset) =>
          asset.tokenAddress.toLowerCase() === tokenAddress.toLowerCase(),
      );
      return assets.length ? { ...action, assets } : undefined;
    },
  },
}));

jest.mock('@onekeyhq/shared/src/utils/earnUtils', () => ({
  __esModule: true,
  default: {
    normalizeBorrowAddress: ({ address }: { address: string }) => address,
  },
}));

jest.mock('./protocolLendingActionUtils', () => ({
  findSupportedBorrowMarket: () => true,
}));

jest.mock('./ProtocolLendingActionDialog', () => ({
  showProtocolLendingActionDialog: jest.fn(),
}));

jest.mock('./ProtocolPositionActionDialog', () => ({
  getActionLabel: ({ action }: { action: string }) => action,
  showProtocolPositionActionDialog: jest.fn(),
  useProtocolPositionActionSubmit: () => jest.fn(),
}));

import { showProtocolLendingActionDialog } from './ProtocolLendingActionDialog';
import { ProtocolPositionActionButton } from './ProtocolPositionActionButton';
import { showProtocolPositionActionDialog } from './ProtocolPositionActionDialog';

describe('ProtocolPositionActionButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes resolved portfolio assets to the native Aave action route', () => {
    render(
      <ProtocolPositionActionButton
        accountId="account-1"
        indexedAccountId="indexed-1"
        protocol={{
          networkId: 'evm--1',
          protocol: 'aave_v3',
          indexedAccountId: 'indexed-1',
        }}
        position={mockPosition as never}
        supportedActions={[]}
        preferLendingDialog
        actionPresentation="modal-route"
      />,
    );

    expect(mockGetBorrowMarkets).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('defi-position-action-withdraw'));

    expect(mockPushModal).toHaveBeenCalledWith(
      EModalRoutes.MainModal,
      expect.objectContaining({
        screen: EModalAssetDetailRoutes.DeFiProtocolAction,
        params: expect.objectContaining({
          mode: 'lending',
          accountId: 'account-1',
          networkId: 'evm--1',
          actionType: 'withdraw',
          hasDebts: true,
          source: {
            type: 'defi',
            action: expect.objectContaining({
              assets: [
                expect.objectContaining({
                  symbol: 'WETH',
                  tokenAddress: '0xweth',
                  amount: '0.004836',
                  extraParams: { poolAddress: '0xpool' },
                }),
                expect.objectContaining({
                  symbol: 'USDC',
                  tokenAddress: '0xusdc',
                  amount: '0.3265',
                  extraParams: { poolAddress: '0xpool' },
                }),
              ],
            }),
          },
        }),
      }),
    );
    expect(showProtocolLendingActionDialog).not.toHaveBeenCalled();
  });

  it('scopes the desktop Aave action to the selected Portfolio asset', () => {
    render(
      <ProtocolPositionActionButton
        accountId="account-1"
        indexedAccountId="indexed-1"
        protocol={{
          networkId: 'evm--1',
          protocol: 'aave_v3',
          indexedAccountId: 'indexed-1',
        }}
        position={mockPosition as never}
        supportedActions={[]}
        manageAsset={mockResolvedAction.assets[0].asset as never}
      />,
    );

    fireEvent.click(screen.getByTestId('defi-position-action-withdraw'));

    expect(showProtocolPositionActionDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'account-1',
        networkId: 'evm--1',
        dialog: mockInPageDialog,
        hasDebts: true,
        action: expect.objectContaining({
          assets: [
            expect.objectContaining({
              symbol: 'WETH',
              tokenAddress: '0xweth',
              amount: '0.004836',
              extraParams: { poolAddress: '0xpool' },
            }),
          ],
        }),
      }),
    );
    expect(showProtocolLendingActionDialog).not.toHaveBeenCalled();
  });

  it('routes Aave repay with the resolved debt asset', () => {
    render(
      <ProtocolPositionActionButton
        accountId="account-1"
        indexedAccountId="indexed-1"
        protocol={{
          networkId: 'evm--1',
          protocol: 'aave_v3',
          indexedAccountId: 'indexed-1',
        }}
        position={mockPosition as never}
        supportedActions={[]}
        preferLendingDialog
        actionPresentation="modal-route"
      />,
    );

    fireEvent.click(screen.getByTestId('defi-position-action-repay'));

    expect(mockPushModal).toHaveBeenCalledWith(
      EModalRoutes.MainModal,
      expect.objectContaining({
        screen: EModalAssetDetailRoutes.DeFiProtocolAction,
        params: expect.objectContaining({
          mode: 'lending',
          accountId: 'account-1',
          networkId: 'evm--1',
          actionType: 'repay',
          hasDebts: true,
          source: {
            type: 'defi',
            action: expect.objectContaining({
              debtCategory: 'borrow',
              assets: [
                expect.objectContaining({
                  symbol: 'USDT',
                  tokenAddress: '0xusdt',
                  amount: '1',
                  extraParams: { poolAddress: '0xpool' },
                }),
              ],
            }),
          },
        }),
      }),
    );
  });
});
