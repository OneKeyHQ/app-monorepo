/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render, screen } from '@testing-library/react';

import { Dialog } from '@onekeyhq/components';
import {
  EDeFiPositionAction,
  type IDeFiAsset,
  type IResolvedDeFiPositionAction,
} from '@onekeyhq/shared/types/defi';

import {
  ProtocolPositionActionAmountInput,
  ProtocolPositionActionAnchor,
  showProtocolPositionActionDialog,
} from './ProtocolPositionActionDialog';

const mockContentLoaded = jest.fn();
const mockContentProps = jest.fn();
const mockAmountProps = jest.fn();
const mockAnchorProps = jest.fn();
jest.mock('@onekeyhq/components', () => ({ Dialog: { show: jest.fn() } }));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/kit/src/components/NumberSizeableTextWrapper', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('@onekeyhq/kit/src/components/Token', () => ({ Token: jest.fn() }));
jest.mock('@onekeyhq/kit/src/hooks/useSignatureConfirm', () => ({
  useSignatureConfirm: jest.fn(),
}));
jest.mock(
  '@onekeyhq/kit/src/views/Staking/components/EarnRiskWarningDialog',
  () => ({
    useEarnRiskWarningGate: jest.fn(),
  }),
);
jest.mock('./DeFiActionTxConfirmResult', () => ({
  showDeFiActionTxConfirmDialog: jest.fn(),
}));
jest.mock('./ProtocolValueCell', () => ({
  ProtocolValueCell: jest.fn(),
  isProtocolAssetValueUnavailable: jest.fn(),
}));
jest.mock('./ProtocolPositionActionDialogContent', () => {
  mockContentLoaded();
  return {
    ProtocolPositionActionDialogContent: (props: unknown) => {
      mockContentProps(props);
      return <div data-testid="position-dialog-content" />;
    },
    ProtocolPositionActionAmountInput: (props: unknown) => {
      mockAmountProps(props);
      return <div data-testid="position-amount-input" />;
    },
    ProtocolPositionActionAnchor: (props: unknown) => {
      mockAnchorProps(props);
      return <div data-testid="position-action-anchor" />;
    },
  };
});

const flush = async () => {
  await act(async () => {
    for (let index = 0; index < 20; index += 1) await Promise.resolve();
  });
};

it('keeps presentation unloaded until rendered and preserves dialog and lending props', async () => {
  expect(mockContentLoaded).not.toHaveBeenCalled();
  const show = jest.spyOn(Dialog, 'show');
  const onSuccess = jest.fn();
  const action: IResolvedDeFiPositionAction = {
    action: EDeFiPositionAction.Withdraw,
    protocolId: 'test-protocol',
    networkId: 'test-network',
    positionCategory: 'supply',
    assets: [],
  };
  const rewardAssets: IDeFiAsset[] = [];
  try {
    showProtocolPositionActionDialog({
      accountId: 'test-account',
      networkId: 'test-network',
      action,
      hasRewards: true,
      hasDebts: true,
      rewardAssets,
      onSuccess,
    });
    expect(mockContentLoaded).not.toHaveBeenCalled();
    expect(show).toHaveBeenCalledTimes(1);
    const options = show.mock.calls[0][0];
    expect(options.showFooter).toBe(false);
    render(<>{options.renderContent as ReactNode}</>);
    await flush();
    expect(screen.getByTestId('position-dialog-content')).toBeTruthy();
    expect(mockContentLoaded).toHaveBeenCalledTimes(1);
    expect(mockContentProps).toHaveBeenLastCalledWith({
      accountId: 'test-account',
      networkId: 'test-network',
      action,
      hasRewards: true,
      hasDebts: true,
      rewardAssets,
      onSuccess,
    });

    const amountProps = {
      assetSelector: <span>Test asset</span>,
      amount: '1.25',
      onChangeAmount: jest.fn(),
      onSelectPercent: jest.fn(),
      selectedPercent: 25,
      symbol: 'TEST',
      availableAmount: '5',
      fiatValue: '2.50',
      currencySymbol: '$',
      isInsufficient: false,
      availableLabel: 'Available',
      maxLabel: 'Max',
      insufficientLabel: 'Insufficient balance',
    };
    const anchorProps = {
      label: 'Test title',
      valueNode: <span>Test balance</span>,
    };
    render(<ProtocolPositionActionAmountInput {...amountProps} />);
    render(<ProtocolPositionActionAnchor {...anchorProps} />);
    await flush();
    expect(screen.getByTestId('position-amount-input')).toBeTruthy();
    expect(screen.getByTestId('position-action-anchor')).toBeTruthy();
    expect(mockAmountProps).toHaveBeenLastCalledWith(amountProps);
    expect(mockAnchorProps).toHaveBeenLastCalledWith(anchorProps);
    expect(mockContentLoaded).toHaveBeenCalledTimes(1);
  } finally {
    show.mockRestore();
  }
});
