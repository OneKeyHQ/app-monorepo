/** @jest-environment jsdom */
/* eslint-disable import/first */

import type { ComponentProps, ReactNode } from 'react';

const mockAccount = jest.fn<Promise<unknown>, [unknown]>();
const mockAllowance = jest.fn<Promise<unknown>, [unknown]>();
const mockCheckAmount = jest.fn<Promise<unknown>, [unknown]>();
const mockConfirmation = jest.fn<Promise<unknown>, [unknown]>();
const mockEstimate = jest.fn<Promise<unknown>, [unknown]>();
const mockTxDetails = jest.fn<Promise<{ data: { status: string } }>, []>();
const mockNavigate = jest.fn<
  Promise<void>,
  [
    {
      onSuccess: (data: { decodedTx: { txid: string } }[]) => void;
      onLateBroadcastAccepted?: (fact: {
        uuid: string;
        accountId: string;
        networkId: string;
        txid: string;
      }) => void;
    },
  ]
>();
const mockOnConfirm = jest.fn<
  Promise<boolean>,
  [
    Parameters<
      NonNullable<ComponentProps<typeof UniversalWithdraw>['onConfirm']>
    >[0],
  ]
>();
const mockGasAlert = jest.fn<void, [{ onCancel?: () => void }]>();

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('react-native', () => ({
  Keyboard: { dismiss: jest.fn() },
  StyleSheet: { hairlineWidth: 1 },
  Platform: {
    OS: 'web',
    select: (items: Record<string, unknown>) => items.web ?? items.default,
  },
}));
jest.mock('@onekeyhq/components', () => {
  const deferredPromise = jest.requireActual<
    typeof import('@onekeyhq/components/src/hooks/useDeferredPromise')
  >('../../../../../../components/src/hooks/useDeferredPromise');
  const Container = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  const Page = Object.assign(Container, {
    Footer: Container,
    FooterActions: ({
      onConfirmText,
      confirmButtonProps,
    }: {
      onConfirmText: string;
      confirmButtonProps: {
        onPress: () => void;
        disabled?: boolean;
        loading?: boolean;
      };
    }) => (
      <button
        type="button"
        onClick={confirmButtonProps.onPress}
        disabled={confirmButtonProps.disabled || confirmButtonProps.loading}
      >
        {onConfirmText}
      </button>
    ),
  });
  const Accordion = Object.assign(Container, {
    Item: Container,
    Trigger: Container,
    Content: Container,
    HeightAnimator: Container,
  });
  return {
    Page,
    Accordion,
    Popover: Container,
    Alert: Container,
    Divider: Container,
    HeightTransition: Container,
    Icon: Container,
    IconButton: Container,
    Image: Container,
    SizableText: Container,
    Skeleton: Container,
    Stack: Container,
    XStack: Container,
    YStack: Container,
    Dialog: { show: jest.fn() },
    Toast: { error: jest.fn(), message: jest.fn() },
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => undefined,
    useDeferredPromise: deferredPromise.useDeferredPromise,
    useNetInfo: () => ({ isRawInternetReachable: true }),
  };
});
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getAccount: (params: unknown) => mockAccount(params),
      getAccountAddressForApi: async () =>
        '0x1111111111111111111111111111111111111111',
    },
    serviceNetwork: { getNetwork: async () => ({ logoURI: '' }) },
    serviceHistory: {
      fetchTxDetails: () => mockTxDetails(),
      getAccountLocalHistoryPendingTxs: async () => [],
    },
    serviceStaking: {
      fetchTokenAllowance: (params: unknown) => mockAllowance(params),
      checkAmount: (params: unknown) => mockCheckAmount(params),
      getTransactionConfirmation: (params: unknown) => mockConfirmation(params),
      estimateFee: (params: unknown) => mockEstimate(params),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({}),
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
  useRouteIsFocusedWhenEnabled: () => true,
}));
jest.mock('@onekeyhq/kit/src/hooks/useSignatureConfirm', () => ({
  useSignatureConfirm: () => ({ navigationToTxConfirm: mockNavigate }),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/discovery', () => ({
  useBrowserAction: () => ({ current: { handleOpenWebSite: jest.fn() } }),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/earn', () => ({
  useEarnActions: () => ({
    current: { getPermitCache: jest.fn(), updatePermitCache: jest.fn() },
  }),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsPersistAtom: () => [{ currencyInfo: { symbol: '$' } }],
}));
jest.mock('@onekeyhq/kit/src/components/PercentageStageOnKeyboard', () => ({
  PercentageStageOnKeyboard: () => null,
  calcPercentBalance: jest.fn(),
}));
jest.mock(
  '@onekeyhq/kit/src/components/PercentageStageOnKeyboard/useAmountInputFocus',
  () => ({
    useAmountInputFocus: () => ({
      isAmountFocused: false,
      onAmountFocusChange: jest.fn(),
    }),
  }),
);
jest.mock('@onekeyhq/kit/src/utils/botWalletAccountUtils', () => ({
  isAccountIdDeactivatedBotWallet: async () => false,
}));
jest.mock('@onekeyhq/kit/src/utils/botWalletWarningDialog', () => ({
  showBotWalletDeactivatedWarningDialog: jest.fn(),
}));
jest.mock('@onekeyhq/kit/src/views/Earn/components/EarnAprSuffixText', () => ({
  EarnAprSuffixText: () => null,
}));
jest.mock(
  '@onekeyhq/kit/src/views/Earn/components/showProtocolListDialog',
  () => ({ ProtocolListContent: () => null }),
);
jest.mock('../../hooks/useEarnPermitApprove', () => ({
  useEarnPermitApprove: () => ({ getPermitSignature: jest.fn() }),
}));
jest.mock('../../hooks/useEarnSignMessageWithoutVerify', () => ({
  useEarnSignMessageWithoutVerify: () => jest.fn(),
}));
jest.mock('../../hooks/usePendleLayoutState', () => ({
  usePendleLayoutState: () => ({}),
}));
jest.mock('../../hooks/useQuoteRefresh', () => ({
  useQuoteRefresh: () => ({
    quoteRefreshing: false,
    handleLocalRefreshQuote: jest.fn(),
  }),
}));
jest.mock('../EarnRiskWarningDialog', () => ({
  showEarnRiskWarningDialog: async () => true,
  useEarnRiskWarningGate: () => async () => true,
}));
jest.mock('../EstimateNetworkFee', () => ({
  EstimateNetworkFee: () => null,
  useShowStakeEstimateGasAlert: () => mockGasAlert,
}));
jest.mock('../BtcFeeRateInput', () => ({ BtcFeeRateInput: () => null }));
jest.mock('../CalculationList', () => ({
  CalculationListItem: Object.assign(() => null, { Label: () => null }),
}));
jest.mock('../ManagePageV2ReceiveInput', () => ({
  ManagePageV2ReceiveInput: () => null,
}));
jest.mock('../ProtocolDetails/EarnActionIcon', () => ({
  EarnActionIcon: () => null,
}));
jest.mock('../ProtocolDetails/EarnPlatformBonusSection', () => ({
  EarnPlatformBonusSection: () => null,
}));
jest.mock('../ProtocolDetails/EarnText', () => ({ EarnText: () => null }));
jest.mock('../ProtocolDetails/EarnTooltip', () => ({
  EarnTooltip: () => null,
}));
jest.mock('../ProtocolDetails/EarnValidatorSelect', () => ({
  EarnValidatorSelect: () => null,
}));
jest.mock('../ProtocolDetails/PendleSharedComponents', () => ({
  PendleAccordionTriggerContent: () => null,
  PendleSummarySection: () => null,
}));
jest.mock('../ProtocolDisplayShared', () => ({
  ProtocolImage: () => null,
  formatTvl: () => '',
}));
jest.mock('../showHighPriceImpactDialog', () => ({
  calcPriceImpactInfo: () => undefined,
  showHighPriceImpactDialog: jest.fn(),
}));
jest.mock('../StakeProgress', () => ({
  EStakeProgressStep: { approve: 0, deposit: 1, unstake: 2 },
  StakeProgress: () => null,
}));
jest.mock('../StakingAmountInput', () => ({
  StakingAmountInput: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => (
    <input
      aria-label="amount"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
  useOnBlurAmountValue: () => jest.fn(),
}));
jest.mock('../StakingAmountInput/StakingAmountInputSkeleton', () => ({
  StakingAmountInputSkeleton: () => null,
}));
jest.mock('../StakingFormWrapper', () => ({
  __esModule: true,
  default: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));
jest.mock('../TradeOrBuy', () => ({ TradeOrBuy: () => null }));

jest.mock('../../pages/ProtocolDetails/useHandleActions', () => ({
  useHandleWithdraw: () => jest.fn(),
}));
jest.mock('../ProtocolDetails/EarnAmountText', () => ({
  EarnAmountText: () => null,
}));

import { UniversalWithdraw } from '.';

import { act, fireEvent, render, waitFor } from '@testing-library/react';

import {
  EtherFiLiquidReferContract,
  EthereumWETH,
} from '@onekeyhq/shared/src/consts/addresses';
import { EApproveType } from '@onekeyhq/shared/types/staking';

const account = '0x1111111111111111111111111111111111111111';
const vault = '0xf0bb20865277ab739f0e5a33e4d50f3f5f9c416c';
const token = {
  uniqueKey: 'liquideth',
  address: vault,
  symbol: 'liquidETH',
  name: 'Liquid ETH',
  decimals: 18,
  isNative: false,
  logoURI: '',
  totalSupply: '0',
  riskLevel: 0,
  coingeckoId: 'liquideth',
  networkId: 'evm--1',
};
const props: ComponentProps<typeof UniversalWithdraw> = {
  accountId: 'account-1',
  accountAddress: account,
  networkId: 'evm--1',
  providerName: 'etherfi',
  protocolVault: vault,
  tokenSymbol: 'liquidETH',
  requestSymbol: 'WETH',
  balance: '2',
  price: '1',
  initialAmount: '1',
  transactionInputTokenAddress: vault,
  transactionOutputTokenAddress: EthereumWETH,
  approveTarget: {
    accountId: 'account-1',
    networkId: 'evm--1',
    spenderAddress: EtherFiLiquidReferContract,
    token,
  },
  currentAllowance: '0',
  approveType: EApproveType.Legacy,
  protocolInfo: {
    stakeTag: '',
    provider: 'etherfi',
    networkId: 'evm--1',
    symbol: 'liquidETH',
    vault,
    providerDetail: { name: 'ether.fi', logoURI: '' },
    withdrawApprove: { tokenAddress: vault },
  },
  onConfirm: mockOnConfirm,
};

describe('EtherFi withdrawal approval continuation', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockTxDetails.mockResolvedValue({ data: { status: '1' } });
    mockAccount.mockResolvedValue({ address: account });
    mockAllowance.mockResolvedValue({ allowance: '0', allowanceParsed: '0' });
    mockCheckAmount.mockResolvedValue({
      code: 0,
      message: '',
      data: { alerts: [] },
    });
    mockConfirmation.mockResolvedValue({
      withdrawPath: {
        data: {
          confirmBoxes: [
            {
              withdrawType: 'queued',
              title: { text: 'Queued' },
              description: { text: '1' },
            },
          ],
        },
      },
    });
    mockEstimate.mockResolvedValue({ feeFiatValue: '1', coverFeeSeconds: '0' });
    mockNavigate.mockResolvedValue(undefined);
    mockOnConfirm.mockResolvedValue(true);
  });

  it('reads the allowance when the initial value is unavailable', async () => {
    mockAllowance.mockResolvedValue({
      allowance: '1000000000000000000',
      allowanceParsed: '1',
    });
    const screen = render(
      <UniversalWithdraw {...props} currentAllowance={undefined} />,
    );
    await waitFor(() => expect(mockAllowance).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        mockEstimate.mock.calls.some(
          ([params]) =>
            typeof params === 'object' &&
            params !== null &&
            'action' in params &&
            params.action === 'unstake',
        ),
      ).toBe(true),
    );
    expect(
      await screen.findByRole('button', { name: 'global.withdraw' }),
    ).toBeDefined();
  }, 10_000);

  it('does not apply the legacy approval guard to an existing liquidUSD withdrawal cancellation', async () => {
    const legacyVault = '0x08c6f91e2b681faf5e17227f2a44c307b3c1364c';
    expect(props.protocolInfo).toBeDefined();
    if (!props.protocolInfo) return;
    const screen = render(
      <UniversalWithdraw
        {...props}
        protocolVault={legacyVault}
        protocolInfo={{ ...props.protocolInfo, vault: legacyVault }}
        initialWithdrawType="cancel"
        identity="request-1"
      />,
    );
    const confirm = await screen.findByRole('button', {
      name: 'global.confirm',
    });
    await waitFor(() => expect(confirm.hasAttribute('disabled')).toBe(false));
    fireEvent.click(confirm);
    await waitFor(() => expect(mockOnConfirm).toHaveBeenCalledTimes(1));
    expect(mockOnConfirm.mock.calls[0][0].withdrawType).toBe('cancel');
    expect(
      mockOnConfirm.mock.calls[0][0].verifyEtherFiLegacyApproval,
    ).toBeUndefined();
    const oldQueue = '0xd45884b592e316eb816199615a95c182f75dea07';
    expect(
      mockAllowance.mock.calls.some(
        ([params]) =>
          typeof params === 'object' &&
          params !== null &&
          'spenderAddress' in params &&
          params.spenderAddress === oldQueue,
      ),
    ).toBe(false);
  }, 10_000);

  it('passes a verifier that detects a legacy allowance added before withdrawal', async () => {
    const legacyVault = '0x08c6f91e2b681faf5e17227f2a44c307b3c1364c';
    const oldQueue = '0xd45884b592e316eb816199615a95c182f75dea07';
    let legacyAllowance = '0';
    mockAllowance.mockImplementation(async (params) => {
      if (
        typeof params === 'object' &&
        params !== null &&
        'spenderAddress' in params &&
        params.spenderAddress === oldQueue
      ) {
        return { allowance: legacyAllowance, allowanceParsed: legacyAllowance };
      }
      return { allowance: '1000000000000000000', allowanceParsed: '1' };
    });
    expect(props.protocolInfo).toBeDefined();
    if (!props.protocolInfo) return;
    const screen = render(
      <UniversalWithdraw
        {...props}
        protocolVault={legacyVault}
        protocolInfo={{ ...props.protocolInfo, vault: legacyVault }}
        currentAllowance="1"
      />,
    );
    await waitFor(() => expect(mockEstimate).toHaveBeenCalled());
    const withdraw = await screen.findByRole('button', {
      name: 'global.withdraw',
    });
    await waitFor(() => expect(withdraw.hasAttribute('disabled')).toBe(false));
    fireEvent.click(withdraw);
    await waitFor(() => expect(mockOnConfirm).toHaveBeenCalledTimes(1));
    const verify = mockOnConfirm.mock.calls[0][0].verifyEtherFiLegacyApproval;
    expect(verify).toBeDefined();
    if (!verify) return;
    legacyAllowance = '1';
    await act(async () => expect(await verify()).toBe(false));
  }, 10_000);

  it('does not open manual withdrawal while the current fee is pending', async () => {
    let resolveFee: (value: {
      feeFiatValue: string;
      coverFeeSeconds: string;
    }) => void = () => undefined;
    mockEstimate.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFee = resolve;
        }),
    );
    mockAllowance.mockResolvedValue({
      allowance: '1000000000000000000',
      allowanceParsed: '1',
    });
    const screen = render(
      <UniversalWithdraw {...props} currentAllowance="1" />,
    );
    await waitFor(() => expect(mockEstimate).toHaveBeenCalled());
    const withdraw = screen.getByRole('button', { name: 'global.withdraw' });
    expect(withdraw.hasAttribute('disabled')).toBe(true);
    fireEvent.click(withdraw);
    expect(mockOnConfirm).not.toHaveBeenCalled();
    await act(async () =>
      resolveFee({ feeFiatValue: '1', coverFeeSeconds: '0' }),
    );
    await waitFor(() => expect(withdraw.hasAttribute('disabled')).toBe(false));
    fireEvent.click(withdraw);
    await waitFor(() => expect(mockOnConfirm).toHaveBeenCalledTimes(1));
  }, 10_000);

  it('reflects a verified sufficient allowance when history has not settled', async () => {
    const screen = render(<UniversalWithdraw {...props} />);
    const approve = await screen.findByRole('button', {
      name: 'global.approve',
    });
    await waitFor(() => expect(approve.hasAttribute('disabled')).toBe(false));
    fireEvent.click(approve);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    mockAllowance.mockResolvedValue({
      allowance: '1000000000000000000',
      allowanceParsed: '1',
    });
    await act(async () => {
      mockNavigate.mock.calls[0][0].onSuccess([
        { decodedTx: { txid: '0xapproval' } },
      ]);
    });
    await waitFor(() => expect(mockOnConfirm).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByRole('button', { name: 'global.withdraw' }),
    ).toBeDefined();
  }, 10_000);

  it('refreshes a returned withdrawal when an earlier approval confirms later', async () => {
    mockTxDetails.mockResolvedValue({ data: { status: '2' } });
    const first = render(<UniversalWithdraw {...props} />);
    const approve = await first.findByRole('button', {
      name: 'global.approve',
    });
    await waitFor(() => expect(approve.hasAttribute('disabled')).toBe(false));
    fireEvent.click(approve);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    first.unmount();
    const returned = render(<UniversalWithdraw {...props} />);
    await returned.findByRole('button', { name: 'global.approve' });
    await act(async () => {
      mockNavigate.mock.calls[0][0].onSuccess([
        { decodedTx: { txid: '0xwithdraw-returned-approval' } },
      ]);
    });
    await waitFor(() => expect(mockTxDetails).toHaveBeenCalled());
    expect(
      returned.getByRole('button', { name: 'global.approve' }),
    ).toBeDefined();
    mockTxDetails.mockResolvedValue({ data: { status: '1' } });
    mockAllowance.mockResolvedValue({
      allowance: '1000000000000000000',
      allowanceParsed: '1',
    });
    await returned.findByRole(
      'button',
      { name: 'global.withdraw' },
      { timeout: 7000 },
    );
    expect(mockOnConfirm).not.toHaveBeenCalled();
  }, 10_000);

  it('refreshes a returned withdrawal after a verified late approval broadcast', async () => {
    const first = render(<UniversalWithdraw {...props} />);
    const approve = await first.findByRole('button', {
      name: 'global.approve',
    });
    await waitFor(() => expect(approve.hasAttribute('disabled')).toBe(false));
    fireEvent.click(approve);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    first.unmount();
    const returned = render(<UniversalWithdraw {...props} />);
    await returned.findByRole('button', { name: 'global.approve' });
    mockAllowance.mockResolvedValue({
      allowance: '1000000000000000000',
      allowanceParsed: '1',
    });
    await act(async () => {
      mockNavigate.mock.calls[0][0].onLateBroadcastAccepted?.({
        uuid: 'approval-late',
        accountId: 'account-1',
        networkId: 'evm--1',
        txid: '0xwithdraw-late-broadcast',
      });
    });
    await returned.findByRole('button', { name: 'global.withdraw' });
    expect(mockOnConfirm).not.toHaveBeenCalled();
  }, 10_000);

  it('waits for the withdrawal fee before continuing after approval', async () => {
    let resolveWithdrawalFee: (value: {
      feeFiatValue: string;
      coverFeeSeconds: string;
    }) => void = () => undefined;
    mockEstimate.mockImplementation((params) => {
      if (
        typeof params === 'object' &&
        params !== null &&
        'action' in params &&
        params.action === 'unstake'
      ) {
        return new Promise((resolve) => {
          resolveWithdrawalFee = resolve;
        });
      }
      return Promise.resolve({ feeFiatValue: '1', coverFeeSeconds: '0' });
    });
    const screen = render(<UniversalWithdraw {...props} />);
    const approve = await screen.findByRole('button', {
      name: 'global.approve',
    });
    await waitFor(() => expect(approve.hasAttribute('disabled')).toBe(false));
    fireEvent.click(approve);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    mockAllowance.mockResolvedValue({
      allowance: '1000000000000000000',
      allowanceParsed: '1',
    });
    await act(async () => {
      mockNavigate.mock.calls[0][0].onSuccess([
        { decodedTx: { txid: '0xapproval' } },
      ]);
    });
    await waitFor(() =>
      expect(
        mockEstimate.mock.calls.some(
          ([params]) =>
            typeof params === 'object' &&
            params !== null &&
            'action' in params &&
            params.action === 'unstake',
        ),
      ).toBe(true),
    );
    expect(mockOnConfirm).not.toHaveBeenCalled();
    const withdraw = screen.getByRole('button', { name: 'global.withdraw' });
    expect(withdraw.hasAttribute('disabled')).toBe(true);
    fireEvent.click(withdraw);
    await act(async () => {
      mockNavigate.mock.calls[0][0].onSuccess([
        { decodedTx: { txid: '0xapproval' } },
      ]);
    });
    expect(mockOnConfirm).not.toHaveBeenCalled();
    await act(async () =>
      resolveWithdrawalFee({ feeFiatValue: '1', coverFeeSeconds: '0' }),
    );
    await waitFor(() => expect(mockOnConfirm).toHaveBeenCalledTimes(1));
  }, 10_000);

  it('does not continue after the account changes while the withdrawal fee is pending', async () => {
    let resolveWithdrawalFee: (value: {
      feeFiatValue: string;
      coverFeeSeconds: string;
    }) => void = () => undefined;
    mockEstimate.mockImplementation((params) => {
      if (
        typeof params === 'object' &&
        params !== null &&
        'action' in params &&
        params.action === 'unstake'
      ) {
        return new Promise((resolve) => {
          resolveWithdrawalFee = resolve;
        });
      }
      return Promise.resolve({ feeFiatValue: '1', coverFeeSeconds: '0' });
    });
    const screen = render(<UniversalWithdraw {...props} />);
    const approve = await screen.findByRole('button', {
      name: 'global.approve',
    });
    await waitFor(() => expect(approve.hasAttribute('disabled')).toBe(false));
    fireEvent.click(approve);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    mockAllowance.mockResolvedValue({
      allowance: '1000000000000000000',
      allowanceParsed: '1',
    });
    await act(async () => {
      mockNavigate.mock.calls[0][0].onSuccess([
        { decodedTx: { txid: '0xapproval' } },
      ]);
    });
    await waitFor(() =>
      expect(
        mockEstimate.mock.calls.some(
          ([params]) =>
            typeof params === 'object' &&
            params !== null &&
            'action' in params &&
            params.action === 'unstake',
        ),
      ).toBe(true),
    );
    screen.rerender(
      <UniversalWithdraw
        {...props}
        accountId="account-2"
        accountAddress="0x2222222222222222222222222222222222222222"
      />,
    );
    await act(async () =>
      resolveWithdrawalFee({ feeFiatValue: '1', coverFeeSeconds: '0' }),
    );
    expect(mockOnConfirm).not.toHaveBeenCalled();
  }, 10_000);
});
