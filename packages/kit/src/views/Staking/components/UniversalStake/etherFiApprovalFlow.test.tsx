/** @jest-environment jsdom */
/* eslint-disable import/first */

import type { ComponentProps, ReactNode } from 'react';

const mockAccount = jest.fn<Promise<unknown>, [unknown]>();
const mockAllowance = jest.fn<Promise<unknown>, [unknown]>();
const mockCheckAmount = jest.fn<Promise<unknown>, [unknown]>();
const mockConfirmation = jest.fn<Promise<unknown>, [unknown]>();
const mockEstimate = jest.fn<Promise<unknown>, [unknown]>();
const mockNavigate = jest.fn<
  Promise<void>,
  [
    {
      onSuccess: (data: { decodedTx: { txid: string } }[]) => void;
      approvesInfo?: { spender: string; amount: string }[];
    },
  ]
>();
const mockOnConfirm = jest.fn<Promise<boolean>, [IApproveConfirmFnParams]>();
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
    Alert: ({
      title,
      action,
    }: {
      title?: string;
      action?: { primary: string; onPrimaryPress: () => void };
    }) => (
      <div>
        {title}
        {action ? (
          <button type="button" onClick={action.onPrimaryPress}>
            {action.primary}
          </button>
        ) : null}
      </div>
    ),
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
      fetchTxDetails: async () => ({ data: { status: '1' } }),
      getAccountLocalHistoryPendingTxs: async () => [],
    },
    serviceToken: {
      fetchTokenInfoOnly: async () => ({
        info: {
          address: '0x08c6f91e2b681faf5e17227f2a44c307b3c1364c',
          isNative: false,
        },
      }),
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

import { UniversalStake } from '.';

import { act, fireEvent, render, waitFor } from '@testing-library/react';

import { Dialog } from '@onekeyhq/components';
import {
  EtherFiLiquidReferContract,
  EthereumWETH,
} from '@onekeyhq/shared/src/consts/addresses';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EApproveType } from '@onekeyhq/shared/types/staking';
import type { IApproveConfirmFnParams } from '@onekeyhq/shared/types/staking';

import { etherFiDepositRecovery } from '../../hooks/etherFiDepositRecovery';

const account = '0x1111111111111111111111111111111111111111';
const token = {
  uniqueKey: 'weth',
  address: EthereumWETH,
  symbol: 'WETH',
  name: 'Wrapped Ether',
  decimals: 18,
  isNative: false,
  logoURI: '',
  totalSupply: '0',
  riskLevel: 0,
  coingeckoId: 'weth',
  networkId: 'evm--1',
};
const props: ComponentProps<typeof UniversalStake> = {
  accountId: 'account-1',
  networkId: 'evm--1',
  balance: '2',
  decimals: 18,
  tokenSymbol: 'WETH',
  providerName: 'etherfi',
  transactionInputTokenAddress: EthereumWETH,
  stakeType: 'normal',
  currentAllowance: '0',
  approveType: EApproveType.Legacy,
  tokenInfo: {
    token,
    balanceParsed: '2',
    price: '1',
    accountId: 'account-1',
    networkId: 'evm--1',
    provider: 'etherfi',
    vault: '0xf0bb20865277abd641a307ece5ee04e79073416c',
  },
  approveTarget: {
    accountId: 'account-1',
    networkId: 'evm--1',
    spenderAddress: EtherFiLiquidReferContract,
    token,
  },
  protocolInfo: {
    stakeTag: '',
    provider: 'etherfi',
    networkId: 'evm--1',
    symbol: 'WETH',
    vault: '0xf0bb20865277abd641a307ece5ee04e79073416c',
    providerDetail: { name: 'ether.fi', logoURI: '' },
    earnAccount: {
      accountId: 'account-1',
      networkId: 'evm--1',
      accountAddress: account,
      account: {
        id: 'account-1',
        name: 'Account',
        type: undefined,
        path: '',
        coinType: '60',
        impl: 'evm',
        pub: '',
        address: account,
        addressDetail: {
          isValid: true,
          networkId: 'evm--1',
          address: account,
          baseAddress: account,
          normalizedAddress: account,
          displayAddress: account,
          allowEmptyAddress: false,
        },
      },
    },
  },
  onConfirm: mockOnConfirm,
};

describe('EtherFi stake approval continuation', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockAccount.mockResolvedValue({ address: account });
    mockAllowance.mockResolvedValue({ allowance: '0', allowanceParsed: '0' });
    mockCheckAmount.mockResolvedValue({
      code: 0,
      message: '',
      data: { alerts: [] },
    });
    mockConfirmation.mockResolvedValue({});
    mockEstimate.mockResolvedValue({ feeFiatValue: '1', coverFeeSeconds: '0' });
    mockNavigate.mockResolvedValue(undefined);
    mockOnConfirm.mockResolvedValue(true);
  });

  it('does not request an ERC-20 allowance for native ETH on mount', async () => {
    const nativeToken = {
      ...token,
      address: '',
      symbol: 'ETH',
      name: 'Ether',
      isNative: true,
    };
    mockAllowance.mockImplementation(() => new Promise(() => undefined));
    if (!props.tokenInfo) throw new OneKeyLocalError('Missing token fixture');
    render(
      <UniversalStake
        {...props}
        tokenSymbol="ETH"
        stakeType="wrap"
        approveType={undefined}
        tokenInfo={{ ...props.tokenInfo, token: nativeToken }}
        approveTarget={{ ...props.approveTarget, token: nativeToken }}
      />,
    );
    await act(async () => Promise.resolve());
    expect(mockAllowance).not.toHaveBeenCalled();
  });

  it('continues a confirmed wrapped intent with its original amount', async () => {
    const vault = '0xf0bb20865277abd641a307ece5ee04e79073416c';
    const id = etherFiDepositRecovery.begin(
      {
        accountId: 'account-1',
        accountAddress: account,
        networkId: 'evm--1',
        vault,
      },
      '0.1',
      'wrap',
    );
    const attempt = etherFiDepositRecovery.markSending(id, id, 'wrap');
    if (!attempt) throw new OneKeyLocalError('Missing attempt');
    const txid = `0x${'d'.repeat(64)}`;
    etherFiDepositRecovery.recordTxid(id, attempt, txid);
    etherFiDepositRecovery.recordFinal(id, attempt, txid, 'success');
    etherFiDepositRecovery.detach(id, id);
    const owner = etherFiDepositRecovery.claim(id);
    if (!owner) throw new OneKeyLocalError('Missing owner');
    const screen = render(
      <UniversalStake
        {...props}
        etherFiNativeRecovery={{ id, owner, amount: '0.1' }}
      />,
    );
    expect((screen.getByLabelText('amount') as HTMLInputElement).value).toBe(
      '0.1',
    );
    const proceed = await screen.findByRole('button', {
      name: 'global.continue',
    });
    await waitFor(() => expect(proceed.hasAttribute('disabled')).toBe(false));
    fireEvent.click(proceed);
    await waitFor(() => expect(mockOnConfirm).toHaveBeenCalledTimes(1));
    expect(mockOnConfirm.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        amount: '0.1',
        etherFiNativeRecovery: { id, owner, amount: '0.1' },
      }),
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  }, 10_000);

  it('keeps a recovered amount when the post-approval deposit gas warning is cancelled', async () => {
    const vault = '0xf0bb20865277abd641a307ece5ee04e79073416c';
    const id = etherFiDepositRecovery.begin(
      {
        accountId: 'account-1',
        accountAddress: account,
        networkId: 'evm--1',
        vault,
      },
      '0.1',
      'wrap',
    );
    const attempt = etherFiDepositRecovery.markSending(id, id, 'wrap');
    if (!attempt) throw new OneKeyLocalError('Missing attempt');
    const txid = `0x${'c'.repeat(64)}`;
    etherFiDepositRecovery.recordTxid(id, attempt, txid);
    etherFiDepositRecovery.recordFinal(id, attempt, txid, 'success');
    etherFiDepositRecovery.detach(id, id);
    const owner = etherFiDepositRecovery.claim(id);
    if (!owner) throw new OneKeyLocalError('Missing owner');
    mockEstimate.mockImplementation(async (params) => {
      if (
        typeof params === 'object' &&
        params !== null &&
        'action' in params &&
        params.action === 'stake'
      ) {
        return { feeFiatValue: '1', coverFeeSeconds: '518400' };
      }
      return { feeFiatValue: '1', coverFeeSeconds: '0' };
    });
    mockOnConfirm.mockImplementation(
      async ({ beforeEtherFiPostWrapDeposit, actionSignal }) =>
        beforeEtherFiPostWrapDeposit
          ? beforeEtherFiPostWrapDeposit(actionSignal)
          : false,
    );
    const screen = render(
      <UniversalStake
        {...props}
        etherFiNativeRecovery={{ id, owner, amount: '0.1' }}
      />,
    );
    const proceed = await screen.findByRole('button', {
      name: 'global.continue',
    });
    await waitFor(() => expect(proceed.hasAttribute('disabled')).toBe(false));
    fireEvent.click(proceed);
    await waitFor(() => expect(mockGasAlert).toHaveBeenCalledTimes(1));
    act(() => mockGasAlert.mock.calls[0][0].onCancel?.());
    await waitFor(() => expect(proceed.hasAttribute('disabled')).toBe(false));
    expect((screen.getByLabelText('amount') as HTMLInputElement).value).toBe(
      '0.1',
    );
  }, 10_000);

  it('asks before starting a same-amount WETH operation while the old one is uncertain', async () => {
    const scope = {
      accountId: 'account-1',
      accountAddress: account,
      networkId: 'evm--1',
      vault: '0xf0bb20865277abd641a307ece5ee04e79073416c',
    };
    const id = etherFiDepositRecovery.begin(scope, '0.1', 'wrap');
    etherFiDepositRecovery.markSending(id, id, 'wrap');
    const screen = render(
      <UniversalStake
        {...props}
        etherFiNativeRecoveryRecords={etherFiDepositRecovery.list(scope, true)}
      />,
    );
    fireEvent.change(screen.getByLabelText('amount'), {
      target: { value: '0.100' },
    });
    const approve = await screen.findByRole('button', {
      name: 'global.approve',
    });
    await waitFor(() => expect(approve.hasAttribute('disabled')).toBe(false));
    fireEvent.click(approve);
    expect(Dialog.show).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'tray_pending_transactions_title',
        onConfirmText: 'global.continue_anyway',
      }),
    );
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockOnConfirm).not.toHaveBeenCalled();
    fireEvent.click(approve);
    expect(Dialog.show).toHaveBeenCalledTimes(1);
    const dialog = jest.mocked(Dialog.show).mock.calls[0]?.[0];
    fireEvent.change(screen.getByLabelText('amount'), {
      target: { value: '0.2' },
    });
    await act(async () => {
      await dialog?.onConfirm?.({
        close: async () => undefined,
        getForm: () => undefined,
        isExist: () => true,
        preventClose: () => undefined,
      });
    });
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockOnConfirm).not.toHaveBeenCalled();
  }, 10_000);

  it('does not start a new operation if the old transaction changes while the warning is open', async () => {
    const scope = {
      accountId: 'account-1',
      accountAddress: account,
      networkId: 'evm--1',
      vault: '0xf0bb20865277abd641a307ece5ee04e79073416c',
    };
    const id = etherFiDepositRecovery.begin(scope, '0.1', 'wrap');
    const attempt = etherFiDepositRecovery.markSending(id, id, 'wrap');
    if (!attempt) throw new OneKeyLocalError('Missing attempt');
    etherFiDepositRecovery.detach(id, id);
    const screen = render(
      <UniversalStake
        {...props}
        etherFiNativeRecoveryRecords={etherFiDepositRecovery.list(scope)}
      />,
    );
    fireEvent.change(screen.getByLabelText('amount'), {
      target: { value: '0.1' },
    });
    const approve = await screen.findByRole('button', {
      name: 'global.approve',
    });
    await waitFor(() => expect(approve.hasAttribute('disabled')).toBe(false));
    fireEvent.click(approve);
    const dialog = jest.mocked(Dialog.show).mock.calls[0]?.[0];
    etherFiDepositRecovery.recordTxid(id, attempt, `0x${'9'.repeat(64)}`);
    await act(async () => {
      await dialog?.onConfirm?.({
        close: async () => undefined,
        getForm: () => undefined,
        isExist: () => true,
        preventClose: () => undefined,
      });
    });
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockOnConfirm).not.toHaveBeenCalled();
  }, 10_000);

  it('blocks liquidUSD deposit and opens an approval to revoke only the legacy queue', async () => {
    const legacyVault = '0x08c6f91e2b681faf5e17227f2a44c307b3c1364c';
    const oldQueue = '0xd45884b592e316eb816199615a95c182f75dea07';
    mockAllowance.mockImplementation(async (params) => {
      if (
        typeof params === 'object' &&
        params !== null &&
        'spenderAddress' in params &&
        params.spenderAddress === oldQueue
      ) {
        return { allowance: '1', allowanceParsed: '1' };
      }
      return { allowance: '0', allowanceParsed: '0' };
    });
    expect(props.protocolInfo).toBeDefined();
    if (!props.protocolInfo) return;
    const screen = render(
      <UniversalStake
        {...props}
        protocolInfo={{ ...props.protocolInfo, vault: legacyVault }}
      />,
    );
    fireEvent.change(screen.getByLabelText('amount'), {
      target: { value: '0.1' },
    });
    const revoke = await screen.findByRole('button', {
      name: 'global.revoke_approve',
    });
    expect(
      screen
        .getByRole('button', { name: 'global.approve' })
        .hasAttribute('disabled'),
    ).toBe(true);
    fireEvent.click(revoke);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    expect(mockNavigate.mock.calls[0][0].approvesInfo).toEqual([
      expect.objectContaining({ spender: oldQueue, amount: '0' }),
    ]);
  }, 10_000);

  it('passes a verifier that detects a legacy allowance added before sending', async () => {
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
      <UniversalStake
        {...props}
        currentAllowance="1"
        protocolInfo={{ ...props.protocolInfo, vault: legacyVault }}
      />,
    );
    fireEvent.change(screen.getByLabelText('amount'), {
      target: { value: '0.1' },
    });
    const deposit = await screen.findByRole('button', { name: 'earn.deposit' });
    await waitFor(() => expect(deposit.hasAttribute('disabled')).toBe(false));
    fireEvent.click(deposit);
    await waitFor(() => expect(mockOnConfirm).toHaveBeenCalledTimes(1));
    const verify = mockOnConfirm.mock.calls[0][0].verifyEtherFiLegacyApproval;
    expect(verify).toBeDefined();
    if (!verify) return;
    legacyAllowance = '1';
    await act(async () => expect(await verify()).toBe(false));
    expect(
      await screen.findByRole('button', { name: 'global.revoke_approve' }),
    ).toBeDefined();
  }, 10_000);

  it('continues exactly once after approval even if a later fee refresh overlaps', async () => {
    const screen = render(<UniversalStake {...props} />);
    fireEvent.change(screen.getByLabelText('amount'), {
      target: { value: '0.1' },
    });
    const approve = await screen.findByRole('button', {
      name: 'global.approve',
    });
    await waitFor(() => expect(approve.hasAttribute('disabled')).toBe(false));
    await waitFor(() => expect(mockEstimate).toHaveBeenCalledTimes(1));
    fireEvent.click(approve);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    mockAllowance.mockResolvedValue({
      allowance: '100000000000000000',
      allowanceParsed: '0.1',
    });
    let resolveFee: (value: {
      feeFiatValue: string;
      coverFeeSeconds: string;
    }) => void = () => undefined;
    mockEstimate.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFee = resolve;
        }),
    );
    await act(async () => {
      mockNavigate.mock.calls[0][0].onSuccess([
        { decodedTx: { txid: '0xapproval' } },
      ]);
    });
    await waitFor(() => expect(mockEstimate).toHaveBeenCalledTimes(2));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 450));
    });
    expect(mockEstimate).toHaveBeenCalledTimes(2);
    const pendingButton = screen.getByRole('button');
    expect(pendingButton.hasAttribute('disabled')).toBe(true);
    fireEvent.click(pendingButton);
    expect(mockOnConfirm).not.toHaveBeenCalled();
    await act(async () =>
      resolveFee({ feeFiatValue: '1', coverFeeSeconds: '0' }),
    );
    await waitFor(() => expect(mockOnConfirm).toHaveBeenCalledTimes(1));
    await act(async () => {
      mockNavigate.mock.calls[0][0].onSuccess([
        { decodedTx: { txid: '0xapproval' } },
      ]);
      await new Promise((resolve) => setTimeout(resolve, 450));
    });
    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
  }, 10_000);

  it('keeps the entered amount and permits retry after the high-gas warning is cancelled', async () => {
    const screen = render(<UniversalStake {...props} />);
    fireEvent.change(screen.getByLabelText('amount'), {
      target: { value: '0.1' },
    });
    const approve = await screen.findByRole('button', {
      name: 'global.approve',
    });
    await waitFor(() => expect(approve.hasAttribute('disabled')).toBe(false));
    await waitFor(() => expect(mockEstimate).toHaveBeenCalledTimes(1));
    fireEvent.click(approve);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    mockAllowance.mockResolvedValue({
      allowance: '100000000000000000',
      allowanceParsed: '0.1',
    });
    mockEstimate.mockResolvedValueOnce({
      feeFiatValue: '1',
      coverFeeSeconds: '518400',
    });
    await act(async () => {
      mockNavigate.mock.calls[0][0].onSuccess([
        { decodedTx: { txid: '0xapproval' } },
      ]);
    });
    await waitFor(() => expect(mockGasAlert).toHaveBeenCalledTimes(1));
    expect(mockOnConfirm).not.toHaveBeenCalled();
    act(() => mockGasAlert.mock.calls[0][0].onCancel?.());
    expect((screen.getByLabelText('amount') as HTMLInputElement).value).toBe(
      '0.1',
    );
    const deposit = await screen.findByRole('button', { name: 'earn.deposit' });
    await waitFor(() => expect(deposit.hasAttribute('disabled')).toBe(false));
    fireEvent.click(deposit);
    await waitFor(() => expect(mockOnConfirm).toHaveBeenCalledTimes(1));
  }, 10_000);

  it('does not continue an old approval after the account changes', async () => {
    const screen = render(<UniversalStake {...props} />);
    fireEvent.change(screen.getByLabelText('amount'), {
      target: { value: '0.1' },
    });
    const approve = await screen.findByRole('button', {
      name: 'global.approve',
    });
    await waitFor(() => expect(approve.hasAttribute('disabled')).toBe(false));
    await waitFor(() => expect(mockEstimate).toHaveBeenCalledTimes(1));
    fireEvent.click(approve);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    mockAllowance.mockResolvedValue({
      allowance: '100000000000000000',
      allowanceParsed: '0.1',
    });
    let resolveFee: (value: {
      feeFiatValue: string;
      coverFeeSeconds: string;
    }) => void = () => undefined;
    mockEstimate.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFee = resolve;
        }),
    );
    await act(async () => {
      mockNavigate.mock.calls[0][0].onSuccess([
        { decodedTx: { txid: '0xapproval' } },
      ]);
    });
    await waitFor(() => expect(mockEstimate).toHaveBeenCalledTimes(2));
    screen.rerender(<UniversalStake {...props} accountId="account-2" />);
    await act(async () =>
      resolveFee({ feeFiatValue: '1', coverFeeSeconds: '0' }),
    );
    expect(mockOnConfirm).not.toHaveBeenCalled();
  }, 10_000);

  it('refreshes allowance after leaving and returning while approval finishes', async () => {
    const first = render(<UniversalStake {...props} />);
    fireEvent.change(first.getByLabelText('amount'), {
      target: { value: '0.1' },
    });
    const approve = await first.findByRole('button', {
      name: 'global.approve',
    });
    await waitFor(() => expect(approve.hasAttribute('disabled')).toBe(false));
    fireEvent.click(approve);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    first.unmount();
    mockAllowance.mockResolvedValue({
      allowance: '100000000000000000',
      allowanceParsed: '0.1',
    });
    await act(async () => {
      mockNavigate.mock.calls[0][0].onSuccess([
        { decodedTx: { txid: '0xapproval' } },
      ]);
    });
    expect(mockOnConfirm).not.toHaveBeenCalled();
    const returned = render(<UniversalStake {...props} />);
    fireEvent.change(returned.getByLabelText('amount'), {
      target: { value: '0.1' },
    });
    const deposit = await returned.findByRole('button', {
      name: 'earn.deposit',
    });
    await waitFor(() => expect(deposit.hasAttribute('disabled')).toBe(false));
    expect(mockOnConfirm).not.toHaveBeenCalled();
  }, 10_000);

  it('refreshes a returned form when an earlier approval confirms later', async () => {
    const first = render(<UniversalStake {...props} />);
    fireEvent.change(first.getByLabelText('amount'), {
      target: { value: '0.1' },
    });
    const approve = await first.findByRole('button', {
      name: 'global.approve',
    });
    await waitFor(() => expect(approve.hasAttribute('disabled')).toBe(false));
    fireEvent.click(approve);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    first.unmount();
    const returned = render(<UniversalStake {...props} />);
    fireEvent.change(returned.getByLabelText('amount'), {
      target: { value: '0.1' },
    });
    await returned.findByRole('button', { name: 'global.approve' });
    mockAllowance.mockResolvedValue({
      allowance: '100000000000000000',
      allowanceParsed: '0.1',
    });
    await act(async () => {
      mockNavigate.mock.calls[0][0].onSuccess([
        { decodedTx: { txid: '0xapproval-returned-form' } },
      ]);
    });
    await returned.findByRole('button', { name: 'earn.deposit' });
    expect(mockOnConfirm).not.toHaveBeenCalled();
  }, 10_000);

  it('shows a pending submission and ignores a second deposit click while estimating', async () => {
    mockAllowance.mockResolvedValue({
      allowance: '1000000000000000000',
      allowanceParsed: '1',
    });
    const screen = render(<UniversalStake {...props} currentAllowance="1" />);
    fireEvent.change(screen.getByLabelText('amount'), {
      target: { value: '0.1' },
    });
    const deposit = await screen.findByRole('button', { name: 'earn.deposit' });
    await waitFor(() => expect(deposit.hasAttribute('disabled')).toBe(false));
    await waitFor(() => expect(mockEstimate).toHaveBeenCalledTimes(1));
    let resolveFee: (value: {
      feeFiatValue: string;
      coverFeeSeconds: string;
    }) => void = () => undefined;
    mockEstimate.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFee = resolve;
        }),
    );
    fireEvent.click(deposit);
    await waitFor(() => expect(mockEstimate).toHaveBeenCalledTimes(2));
    expect(deposit.hasAttribute('disabled')).toBe(true);
    fireEvent.click(deposit);
    expect(mockOnConfirm).not.toHaveBeenCalled();
    await act(async () =>
      resolveFee({ feeFiatValue: '1', coverFeeSeconds: '0' }),
    );
    await waitFor(() => expect(mockOnConfirm).toHaveBeenCalledTimes(1));
  }, 10_000);

  it('can estimate a new amount while the previous submission fee never resolves', async () => {
    mockAllowance.mockResolvedValue({
      allowance: '1000000000000000000',
      allowanceParsed: '1',
    });
    const screen = render(<UniversalStake {...props} currentAllowance="1" />);
    const amount = screen.getByLabelText('amount');
    fireEvent.change(amount, { target: { value: '0.1' } });
    const deposit = await screen.findByRole('button', { name: 'earn.deposit' });
    await waitFor(() => expect(deposit.hasAttribute('disabled')).toBe(false));
    await waitFor(() => expect(mockEstimate).toHaveBeenCalledTimes(1));
    mockEstimate.mockImplementationOnce(() => new Promise(() => undefined));
    fireEvent.click(deposit);
    await waitFor(() => expect(mockEstimate).toHaveBeenCalledTimes(2));
    fireEvent.change(amount, { target: { value: '0.2' } });
    await waitFor(() => expect(mockEstimate).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(deposit.hasAttribute('disabled')).toBe(false));
    expect(mockOnConfirm).not.toHaveBeenCalled();
  }, 10_000);
});
