/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, fireEvent, render, waitFor } from '@testing-library/react';

import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import {
  EStakingActionType,
  type IEarnCancelWithdrawalActionIcon,
  type IProtocolInfo,
} from '@onekeyhq/shared/types/staking';

import { EarnActionIcon } from './EarnActionIcon';

import type { useUniversalWithdraw } from '../../hooks/useUniversalHooks';

const mockWithdraw = jest.fn<
  ReturnType<ReturnType<typeof useUniversalWithdraw>>,
  Parameters<ReturnType<typeof useUniversalWithdraw>>
>();
const mockUseUniversalWithdraw = jest.fn<
  ReturnType<typeof useUniversalWithdraw>,
  Parameters<typeof useUniversalWithdraw>
>();
const mockPushModal = jest.fn();

jest.mock('../../hooks/useUniversalHooks', () => ({
  useUniversalWithdraw: (params: Parameters<typeof useUniversalWithdraw>[0]) =>
    mockUseUniversalWithdraw(params),
}));

jest.mock('@onekeyhq/components', () => ({
  Button: ({
    children,
    disabled,
    onPress,
  }: {
    children?: ReactNode;
    disabled?: boolean;
    onPress?: () => void;
  }) => (
    <button type="button" disabled={disabled} onClick={onPress}>
      {children}
    </button>
  ),
  useClipboard: () => ({ copyText: jest.fn() }),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: mockPushModal }),
}));
jest.mock('./showKYCDialog', () => ({ showClaimWithKycDialog: jest.fn() }));
jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: jest.fn(),
}));
jest.mock('../../hooks/useEarnSignMessage', () => ({
  useEarnSignMessage: jest.fn(),
}));
jest.mock('../../pages/ProtocolDetails/useHandleClaim', () => ({
  useHandleClaim: jest.fn(),
}));
jest.mock('./EarnAmountText', () => ({ EarnAmountText: () => null }));
jest.mock('./EarnIcon', () => ({ EarnIcon: () => null }));
jest.mock('./EarnText', () => ({ EarnText: () => null }));

const networkId = 'evm--1';
const owner = '0xf67b153b536f47a6e04cb8779e689f6a3b89e5c7';
const identity =
  '0x14e5511f491565d7e10ab19a35c7ce3e61a243245ec4573c341298d775d5833d';
const requestVault = '0xf0bb20865277abd641a307ece5ee04e79073416c';
const protocolInfo: IProtocolInfo = {
  provider: 'etherfi',
  networkId,
  symbol: 'eETH',
  vault: '0x08c6f91e2b681faf5e17227f2a44c307b3c1364c',
  stakeTag: '',
  providerDetail: { name: 'ether.fi', logoURI: '' },
  earnAccount: {
    accountId: 'account-1',
    networkId,
    accountAddress: owner,
    account: {
      id: 'account-1',
      name: 'Account 1',
      type: undefined,
      path: '',
      coinType: '60',
      impl: 'evm',
      pub: '',
      address: owner,
      addressDetail: {
        isValid: true,
        networkId,
        address: owner,
        baseAddress: owner,
        normalizedAddress: owner,
        displayAddress: owner,
        allowEmptyAddress: false,
      },
    },
  },
};
const cancelAction: IEarnCancelWithdrawalActionIcon = {
  type: EStakingActionType.CancelWithdrawal,
  text: { text: '取消' },
  disabled: false,
  data: { identity, vault: requestVault },
};

describe('EarnActionIcon cancel withdrawal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWithdraw.mockResolvedValue(true);
    mockUseUniversalWithdraw.mockReturnValue(mockWithdraw);
  });

  it.each(['button', 'trigger'] as const)(
    'opens the request picker from the aggregated %s action using its vault',
    async (entry) => {
      const onActionSuccess = jest.fn();
      const screen = render(
        <EarnActionIcon
          actionIcon={{
            ...cancelAction,
            data: { vault: requestVault, selectRequest: true },
          }}
          protocolInfo={protocolInfo}
          onActionSuccess={onActionSuccess}
          trigger={
            entry === 'trigger'
              ? ({ onPress }) => (
                  <button type="button" onClick={onPress}>
                    取消
                  </button>
                )
              : undefined
          }
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: '取消' }));

      expect(mockPushModal).toHaveBeenCalledWith(EModalRoutes.StakingModal, {
        screen: EModalStakingRoutes.WithdrawOptions,
        params: expect.objectContaining({
          accountId: 'account-1',
          networkId,
          symbol: 'eETH',
          provider: 'etherfi',
          protocolInfo: expect.objectContaining({ vault: requestVault }),
          withdrawType: 'cancel',
          onSuccess: onActionSuccess,
        }),
      });
      expect(mockWithdraw).not.toHaveBeenCalled();
      expect(onActionSuccess).not.toHaveBeenCalled();
    },
  );

  it.each(['button', 'trigger'] as const)(
    'forwards the selected request from the %s and refreshes only after success',
    async (entry) => {
      const onActionSuccess = jest.fn();
      const screen = render(
        <EarnActionIcon
          actionIcon={cancelAction}
          protocolInfo={protocolInfo}
          onActionSuccess={onActionSuccess}
          trigger={
            entry === 'trigger'
              ? ({ onPress, disabled }) => (
                  <button type="button" onClick={onPress} disabled={disabled}>
                    取消
                  </button>
                )
              : undefined
          }
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: '取消' }));

      await waitFor(() => expect(mockWithdraw).toHaveBeenCalledTimes(1));
      expect(mockUseUniversalWithdraw).toHaveBeenCalledWith({
        accountId: 'account-1',
        networkId,
      });
      expect(mockWithdraw).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: '0',
          provider: 'etherfi',
          symbol: 'eETH',
          identity,
          protocolVault: requestVault,
          withdrawType: 'cancel',
          withdrawAll: false,
          onSuccess: onActionSuccess,
        }),
      );
      expect(onActionSuccess).not.toHaveBeenCalled();

      act(() => {
        mockWithdraw.mock.calls[0][0].onSuccess?.([]);
      });
      expect(onActionSuccess).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['native', 'spark'])(
    'keeps %s cancellation without action data using its protocol vault',
    async (provider) => {
      const screen = render(
        <EarnActionIcon
          actionIcon={{ ...cancelAction, data: undefined }}
          protocolInfo={{ ...protocolInfo, provider, symbol: 'USDC' }}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: '取消' }));

      await waitFor(() => expect(mockWithdraw).toHaveBeenCalledTimes(1));
      expect(mockWithdraw).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: '0',
          provider,
          symbol: 'USDC',
          identity: undefined,
          protocolVault: protocolInfo.vault,
          withdrawType: 'cancel',
          withdrawAll: false,
        }),
      );
    },
  );

  it('does not build a cancellation without an earn account', async () => {
    const onActionSuccess = jest.fn();
    const screen = render(
      <EarnActionIcon
        actionIcon={cancelAction}
        protocolInfo={{ ...protocolInfo, earnAccount: undefined }}
        onActionSuccess={onActionSuccess}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '取消' }));
    });

    expect(mockWithdraw).not.toHaveBeenCalled();
    expect(onActionSuccess).not.toHaveBeenCalled();
  });
});
