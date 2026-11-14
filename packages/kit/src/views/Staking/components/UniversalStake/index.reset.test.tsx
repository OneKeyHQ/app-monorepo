/** @jest-environment jsdom */

import { Suspense, startTransition, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';

import { UniversalStake } from '.';

import { act, fireEvent, render, waitFor } from '@testing-library/react';

import { EthereumWETH } from '@onekeyhq/shared/src/consts/addresses';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import { EApproveType, EEarnLabels } from '@onekeyhq/shared/types/staking';
import type { IFetchTokenDetailItem } from '@onekeyhq/shared/types/token';

import { depositTaskRegistry } from '../../earnDepositTask/registry';
import {
  createDepositTask,
  reduceDepositTask,
} from '../../earnDepositTask/state';
import {
  getDepositTaskOwnerKey,
  useRetainedDepositTask,
} from '../../earnDepositTask/useRetainedDepositTask';
import { useUniversalStake } from '../../hooks/useUniversalHooks';

import type {
  IDepositTaskHandle,
  IEarnStakeConfirmParams,
} from '../../earnDepositTask/types';

type IConfirm = {
  approvesInfo: { amount: string }[];
  onBeforeSend?: () => void | Promise<void>;
  onCancel?: () => void;
  onSuccess: (
    data: {
      signedTx?: { txid: string };
      decodedTx: { txid: string; status?: string };
    }[],
  ) => void;
};
const mockNavigate = jest.fn<Promise<void>, [IConfirm]>();
const mockDialog = jest.fn<
  void,
  [{ onConfirm: (dialog: { close: () => Promise<void> }) => Promise<void> }]
>();
const mockWaitStatus = jest.fn<
  Promise<EOnChainHistoryTxStatus | undefined>,
  [unknown]
>();
const mockAllowance = jest.fn<Promise<{ allowanceParsed: string }>, []>();
const mockWrappedBalance = jest.fn<
  Promise<IFetchTokenDetailItem[]>,
  [unknown]
>();
const mockCheck = jest.fn<Promise<unknown>, [unknown]>();
const mockToast = jest.fn<void, [unknown]>();
const mockRisk = jest.fn<Promise<boolean>, [unknown]>();
const mockTrack = jest.fn<void, [string]>();
const mockRetryAllowance = jest.fn();
const mockAllowanceState = { available: true, error: false, value: '1' };
const mockPreviewAllowance = { value: undefined as string | undefined };
const mockRealPreview = { enabled: false };
const mockPreviewFocus = { focused: true };
const mockPreviewOptions = jest.fn();
const mockStakeProgress = jest.fn();
const mockPendleLayout = jest.fn();
const mockShowEstimate = { value: false };
const mockAccount = jest.fn<Promise<{ address: string }>, [unknown]>();
const mockBot = jest.fn<Promise<boolean>, [unknown]>();
const mockEstimate = jest.fn<Promise<unknown>, [unknown]>();
const mockPermitCache = jest.fn();
const mockConfirmation = jest.fn<Promise<unknown>, [unknown]>();
const mockBuildStake = jest.fn<Promise<unknown>, [unknown]>();
type IOrderResult =
  | { localStatus: 'saved'; remoteStatus: 'synced' }
  | { localStatus: 'saved'; remoteStatus: 'failed' }
  | { localStatus: 'failed'; remoteStatus: 'notAttempted' };
const mockAddOrder = jest.fn<Promise<IOrderResult>, [unknown]>();
const mockTaskAddress = jest.fn<Promise<string>, []>();
const mockTaskSuccess = jest.fn<void, [unknown]>();
const mockBuildInternal = jest.fn<Promise<unknown>, [unknown]>();
const mockGasAlert = jest.fn<
  void,
  [{ onConfirm: (dialog: { close: () => Promise<void> }) => Promise<void> }]
>();

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
  const Popover = Object.assign(Container, {
    Trigger: Container,
    Content: Container,
  });
  return {
    Page,
    Accordion,
    Popover,
    Alert: ({
      action,
      title,
      type,
    }: {
      action?: { primary: string; onPrimaryPress: () => void };
      title?: ReactNode;
      type?: string;
    }) =>
      action ? (
        <button type="button" onClick={action.onPrimaryPress}>
          {action.primary}
        </button>
      ) : (
        <div data-testid={`alert-${type ?? ''}`}>{title}</div>
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
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => undefined,
    useDeferredPromise: deferredPromise.useDeferredPromise,
    useNetInfo: () => ({ isRawInternetReachable: true }),
    Dialog: {
      show: (params: Parameters<typeof mockDialog>[0]) => mockDialog(params),
    },
    Toast: {
      message: (p: unknown) => mockToast(p),
      error: (p: unknown) => mockToast(p),
    },
  };
});
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceToken: {
      fetchTokensDetails: (input: unknown) => mockWrappedBalance(input),
    },
    serviceAccount: {
      getAccount: (p: unknown) => mockAccount(p),
      getAccountAddressForApi: () => mockTaskAddress(),
    },
    serviceStaking: {
      checkAmount: (p: unknown) => mockCheck(p),
      fetchTokenAllowance: () => mockAllowance(),
      buildStakeTransaction: (p: unknown) => mockBuildStake(p),
      buildInternalDappTx: (p: unknown) => mockBuildInternal(p),
      addEarnOrder: (p: unknown) => mockAddOrder(p),
      getTransactionConfirmation: (p: unknown) => mockConfirmation(p),
      estimateFee: (p: unknown) => mockEstimate(p),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({}),
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (
    method: () => Promise<unknown>,
    deps: unknown[],
    options?: { undefinedResultIfReRun?: boolean },
  ) => {
    if (options?.undefinedResultIfReRun) {
      mockPreviewOptions(options);
      if (mockRealPreview.enabled) {
        const actual = jest.requireActual<
          typeof import('@onekeyhq/kit/src/hooks/usePromiseResult')
        >('@onekeyhq/kit/src/hooks/usePromiseResult');
        return actual.usePromiseResult(method, deps, options);
      }
      return {
        result: { scope: deps[1], allowance: mockPreviewAllowance.value },
        run: jest.fn(),
      };
    }
    return { result: undefined, run: jest.fn() };
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
  useRouteIsFocusedWhenEnabled: () => mockPreviewFocus.focused,
}));
jest.mock('@onekeyhq/kit/src/hooks/useSignatureConfirm', () => ({
  useSignatureConfirm: () => ({ navigationToTxConfirm: mockNavigate }),
}));
jest.mock('@onekeyhq/kit/src/utils/waitForTxFinalStatus', () => ({
  waitForTxFinalStatus: (p: unknown) => mockWaitStatus(p),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/discovery', () => ({
  useBrowserAction: () => ({ current: { handleOpenWebSite: jest.fn() } }),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/earn', () => ({
  useEarnActions: () => ({
    current: { getPermitCache: mockPermitCache, updatePermitCache: jest.fn() },
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
  isAccountIdDeactivatedBotWallet: (params: unknown) => mockBot(params),
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
jest.mock('@onekeyhq/shared/src/errors/utils/errorToastUtils', () => ({
  __esModule: true,
  default: { toastIfError: jest.fn(), showToastOfError: jest.fn() },
}));
jest.mock('../../hooks/useEarnPermitApprove', () => ({
  useEarnPermitApprove: () => ({ getPermitSignature: jest.fn() }),
}));
jest.mock('../../hooks/useEarnSignMessageWithoutVerify', () => ({
  useEarnSignMessageWithoutVerify: () => jest.fn(),
}));
jest.mock('../../hooks/usePendleLayoutState', () => ({
  usePendleLayoutState: (params: unknown) => {
    mockPendleLayout(params);
    return { showPendleTransactionSection: mockShowEstimate.value };
  },
}));
jest.mock('../../hooks/useQuoteRefresh', () => ({
  useQuoteRefresh: () => ({
    quoteRefreshing: false,
    handleLocalRefreshQuote: jest.fn(),
  }),
}));
jest.mock('../../hooks/useUtilsHooks', () => ({
  useTrackTokenAllowance: () => ({
    allowance: mockAllowanceState.value,
    allowanceAvailable: mockAllowanceState.available,
    allowanceError: mockAllowanceState.error,
    loading: false,
    trackAllowance: mockTrack,
    retryAllowance: mockRetryAllowance,
    fetchAllowanceResponse: mockAllowance,
  }),
}));
jest.mock('../EarnRiskWarningDialog', () => ({
  showEarnRiskWarningDialog: (p: unknown) => mockRisk(p),
  useEarnRiskWarningGate: () => mockRisk,
}));
jest.mock('../EstimateNetworkFee', () => ({
  ...jest.requireActual<typeof import('../EstimateNetworkFee')>(
    '../EstimateNetworkFee',
  ),
  EstimateNetworkFee: ({
    estimateFeeResp,
  }: {
    estimateFeeResp: { feeFiatValue: string };
  }) => <span data-testid="estimated-fee">{estimateFeeResp.feeFiatValue}</span>,
  useShowStakeEstimateGasAlert: () => mockGasAlert,
}));
jest.mock('../BtcFeeRateInput', () => ({ BtcFeeRateInput: () => null }));
jest.mock('../CalculationList', () => ({ CalculationListItem: () => null }));
jest.mock('../ManagePageV2ReceiveInput', () => ({
  ManagePageV2ReceiveInput: ({ loading }: { loading?: boolean }) => (
    <span data-testid="quote-loading">{loading ? 'true' : 'false'}</span>
  ),
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
  StakeProgress: (props: unknown) => {
    mockStakeProgress(props);
    return <div data-testid="legacy-stake-progress" />;
  },
  StakeTaskProgress: () => <div data-testid="task-progress" />,
}));
jest.mock('../StakingAmountInput', () => ({
  StakingAmountInput: ({
    value,
    onChange,
    disabled,
    tokenSelectorTriggerProps,
  }: {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    tokenSelectorTriggerProps?: { disabled?: boolean; onPress?: () => void };
  }) => (
    <>
      <input
        aria-label="amount"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {tokenSelectorTriggerProps?.onPress ? (
        <button
          type="button"
          disabled={tokenSelectorTriggerProps.disabled}
          onClick={tokenSelectorTriggerProps.onPress}
        >
          Select asset
        </button>
      ) : null}
    </>
  ),
  useOnBlurAmountValue: () => jest.fn(),
}));
jest.mock('../StakingAmountInput/StakingAmountInputSkeleton', () => ({
  StakingAmountInputSkeleton: () => null,
}));
jest.mock('../TradeOrBuy', () => ({ TradeOrBuy: () => null }));

const token = {
  uniqueKey: 'usdt',
  address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  symbol: 'USDT',
  name: 'Tether',
  decimals: 6,
  isNative: false,
  logoURI: '',
  totalSupply: '0',
  riskLevel: 0,
  coingeckoId: 'tether',
  networkId: 'evm--1',
};
const props: ComponentProps<typeof UniversalStake> = {
  accountId: 'account',
  networkId: 'evm--1',
  balance: '5',
  decimals: 6,
  tokenSymbol: 'USDT',
  providerName: 'etherfi',
  tokenInfo: {
    token,
    balanceParsed: '5',
    price: '1',
    accountId: 'account',
    networkId: 'evm--1',
    provider: 'etherfi',
    vault: '0xvault',
  },
  approveType: EApproveType.Legacy,
  currentAllowance: '1',
  approveTarget: {
    accountId: 'account',
    networkId: 'evm--1',
    spenderAddress: '0xspender',
    token,
  },
  protocolInfo: {
    stakeTag: '',
    earnAccount: {
      accountId: 'account',
      networkId: 'evm--1',
      accountAddress: '0xowner',
      account: {
        id: 'account',
        name: 'Account',
        type: undefined,
        path: '',
        coinType: '60',
        impl: 'evm',
        pub: '',
        address: '0xowner',
        addressDetail: {
          isValid: true,
          networkId: 'evm--1',
          address: '0xowner',
          baseAddress: '0xowner',
          normalizedAddress: '0xowner',
          displayAddress: '0xowner',
          allowEmptyAddress: false,
        },
      },
    },
    provider: 'etherfi',
    networkId: 'evm--1',
    symbol: 'USDT',
    vault: '0xvault',
    providerDetail: { name: 'ether.fi', logoURI: '' },
  },
  preparationPolicy: 'confirm-setup-before-deposit',
};
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function StakeTaskHarness(harnessProps: ComponentProps<typeof UniversalStake>) {
  const { accountId, networkId, tokenInfo, providerName, protocolInfo } =
    harnessProps;
  const stake = useUniversalStake({ accountId, networkId });
  return (
    <UniversalStake
      {...harnessProps}
      transactionInputTokenAddress={tokenInfo?.token.address}
      onConfirm={(params, isActionCurrent) =>
        stake({
          ...params,
          symbol: tokenInfo?.token.symbol ?? '',
          provider: providerName ?? 'etherfi',
          protocolVault: protocolInfo?.vault,
          inputTokenAddress: tokenInfo?.token.address,
          postWrapStakeToken: harnessProps.postWrapApproveTarget?.token,
          postWrapApproveSpenderAddress:
            harnessProps.postWrapApproveTarget?.spenderAddress,
          stakingInfo: {
            protocol: providerName ?? 'etherfi',
            label: EEarnLabels.Stake,
            tags: [],
          },
          onSuccess: mockTaskSuccess,
          isActionCurrent,
        })
      }
    />
  );
}

function RetainedStakeHarness(
  harnessProps: ComponentProps<typeof UniversalStake>,
) {
  const ownerKey = getDepositTaskOwnerKey({
    accountId: harnessProps.accountId,
    accountAddress: harnessProps.protocolInfo?.earnAccount?.accountAddress,
    networkId: harnessProps.networkId,
    provider: harnessProps.providerName,
    vault: harnessProps.protocolInfo?.vault,
  });
  const retained = useRetainedDepositTask(ownerKey);
  if (retained.status === 'checking') return <span>Restoring task</span>;
  if (retained.status === 'unavailable') return <span>Task unavailable</span>;
  return (
    <StakeTaskHarness
      {...harnessProps}
      retainedTask={retained.status === 'ready' ? retained.value : null}
    />
  );
}

async function submitConfirmation(index: number, txid: string) {
  await act(async () => {
    const confirmation = mockNavigate.mock.calls[index][0];
    await confirmation.onBeforeSend?.();
    confirmation.onSuccess([{ decodedTx: { txid } }]);
  });
}

async function beginReset(
  overrides: Partial<ComponentProps<typeof UniversalStake>> = {},
) {
  const screen = render(<StakeTaskHarness {...props} {...overrides} />);
  fireEvent.change(screen.getByLabelText('amount'), { target: { value: '2' } });
  const button = await screen.findByRole(
    'button',
    { name: 'global.approve' },
    { timeout: 5000 },
  );
  await waitFor(() => expect(mockCheck).toHaveBeenCalled(), { timeout: 5000 });
  await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false), {
    timeout: 5000,
  });
  fireEvent.click(button);
  await waitFor(() => expect(mockDialog).toHaveBeenCalledTimes(1));
  await act(async () =>
    mockDialog.mock.calls[0][0].onConfirm({ close: async () => undefined }),
  );
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
  expect(mockNavigate.mock.calls[0][0].approvesInfo[0].amount).toBe('0');
  return screen;
}

function ConcurrentStakeHarness({ onSuspended }: { onSuspended: () => void }) {
  const [view, setView] = useState({ accountId: 'account', suspend: false });
  const suspended = useState(() => new Promise<never>(() => undefined))[0];

  function SuspendAfterStake() {
    if (view.suspend) {
      onSuspended();
      throw suspended;
    }
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() =>
          startTransition(() => setView({ accountId: 'other', suspend: true }))
        }
      >
        Suspend other account
      </button>
      <button
        type="button"
        onClick={() => setView({ accountId: 'account', suspend: false })}
      >
        Restore account
      </button>
      <button
        type="button"
        onClick={() => setView({ accountId: 'other', suspend: false })}
      >
        Commit other account
      </button>
      <Suspense fallback={<span>Loading account</span>}>
        <StakeTaskHarness {...props} accountId={view.accountId} />
        <span data-testid="committed-account">{view.accountId}</span>
        <SuspendAfterStake />
      </Suspense>
    </>
  );
}

describe('EtherFi USDT approval reset', () => {
  const reservations = new Map<string, symbol>();
  const reserveTask = depositTaskRegistry.reserve;
  beforeEach(() => {
    jest.resetAllMocks();
    jest
      .spyOn(depositTaskRegistry, 'reserve')
      .mockImplementation((key, state) => {
        const reservationToken = reserveTask(key, state);
        if (reservationToken) reservations.set(key, reservationToken);
        return reservationToken;
      });
    mockAllowanceState.available = true;
    mockAllowanceState.error = false;
    mockAllowanceState.value = '1';
    mockShowEstimate.value = false;
    mockPreviewAllowance.value = undefined;
    mockRealPreview.enabled = false;
    mockPreviewFocus.focused = true;
    mockAccount.mockResolvedValue({ address: '0xowner' });
    mockBot.mockResolvedValue(false);
    mockAllowance.mockResolvedValue({ allowanceParsed: '1' });
    mockWrappedBalance.mockResolvedValue([
      {
        info: {
          ...token,
          address: EthereumWETH,
          symbol: 'WETH',
          name: 'Wrapped Ether',
          decimals: 18,
          isNative: false,
        },
        balance: '100000000000000000000',
        balanceParsed: '100',
        fiatValue: '0',
        price: 0,
      },
    ]);
    mockRisk.mockResolvedValue(true);
    mockAddOrder.mockResolvedValue({
      localStatus: 'saved',
      remoteStatus: 'synced',
    });
    mockTaskAddress.mockResolvedValue('0xowner');
    mockNavigate.mockResolvedValue(undefined);
    mockBuildStake.mockResolvedValue({ tx: { to: '0xvault', data: '0x' } });
    mockBuildInternal.mockResolvedValue({
      from: '0xowner',
      to: '0xvault',
      data: '0x',
    });
    mockConfirmation.mockResolvedValue({});
    mockCheck.mockResolvedValue({ code: 0, message: '', data: { alerts: [] } });
  });

  it('warns about a high estimated fee before submitting a cached Morpho Permit', async () => {
    const usdc = {
      ...token,
      address: '0xusdc',
      symbol: 'USDC',
      name: 'USD Coin',
    };
    mockPermitCache.mockReturnValue({
      signature: 'cached-signature',
      permit2Data: undefined,
    });
    mockAllowanceState.value = '0';
    mockAllowance.mockResolvedValue({ allowanceParsed: '0' });
    mockEstimate.mockResolvedValue({
      feeFiatValue: '10',
      coverFeeSeconds: 7 * 24 * 3600,
    });
    const screen = render(
      <StakeTaskHarness
        {...props}
        providerName="morpho"
        tokenSymbol="USDC"
        approveType={EApproveType.Permit}
        preparationPolicy={undefined}
        tokenInfo={
          props.tokenInfo ? { ...props.tokenInfo, token: usdc } : undefined
        }
        approveTarget={{ ...props.approveTarget, token: usdc }}
      />,
    );
    fireEvent.change(screen.getByLabelText('amount'), {
      target: { value: '2' },
    });
    const button = await screen.findByRole('button', { name: 'earn.deposit' });
    await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false));
    fireEvent.click(button);
    await waitFor(() => expect(mockGasAlert).toHaveBeenCalledTimes(1));
    expect(mockEstimate).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'morpho',
        approveType: EApproveType.Permit,
        accountAddress: undefined,
      }),
    );
    expect(mockEstimate.mock.calls[0][0]).not.toHaveProperty('permitSignature');
    expect(mockBuildStake).not.toHaveBeenCalled();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    reservations.forEach((reservationToken, key) =>
      depositTaskRegistry.release(key, reservationToken),
    );
    reservations.clear();
  });

  it('resumes after a real unmount without wrapping again', async () => {
    const nativeToken = {
      ...token,
      uniqueKey: 'eth',
      address: '',
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18,
      isNative: true,
    };
    const wrappedToken = {
      ...token,
      uniqueKey: 'weth',
      address: EthereumWETH,
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
      isNative: false,
    };
    if (!props.tokenInfo) throw new OneKeyLocalError('Missing token info');
    const wrapProps: ComponentProps<typeof UniversalStake> = {
      ...props,
      decimals: 18,
      tokenSymbol: 'ETH',
      tokenInfo: { ...props.tokenInfo, token: nativeToken },
      approveType: undefined,
      approveTarget: { ...props.approveTarget, token: nativeToken },
      postWrapApproveTarget: {
        spenderAddress: '0xspender',
        token: wrappedToken,
      },
      stakeType: 'wrap',
    };
    mockAllowance.mockResolvedValue({ allowanceParsed: '0' });
    mockWaitStatus.mockResolvedValue(EOnChainHistoryTxStatus.Success);
    const first = render(<RetainedStakeHarness {...wrapProps} />);
    fireEvent.change(first.getByLabelText('amount'), {
      target: { value: '2' },
    });
    const button = await first.findByRole('button', {
      name: 'Limit.native_token_no_sell_wrap',
    });
    await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false));
    fireEvent.click(button);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    await submitConfirmation(0, 'wrap-tx');
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(2));
    await act(async () => mockNavigate.mock.calls[1][0].onCancel?.());
    first.unmount();

    const second = render(<RetainedStakeHarness {...wrapProps} />);
    await waitFor(() =>
      expect(second.getByLabelText('amount').getAttribute('value')).toBe('2'),
    );
    const retry = await second.findByRole('button', { name: 'global.retry' });
    expect(mockNavigate).toHaveBeenCalledTimes(2);
    fireEvent.click(retry);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(3));
    expect(mockBuildStake).toHaveBeenCalledTimes(1);
    expect(mockNavigate.mock.calls[2][0].approvesInfo).toHaveLength(1);
    second.unmount();
  });

  it('defers the USDT approval estimate until the nonzero allowance is reset', async () => {
    jest.useFakeTimers();
    try {
      mockEstimate.mockResolvedValue({ feeFiatValue: '1' });
      const screen = render(<UniversalStake {...props} />);
      fireEvent.change(screen.getByLabelText('amount'), {
        target: { value: '2' },
      });
      await act(async () => jest.advanceTimersByTimeAsync(351));
      expect(mockEstimate).not.toHaveBeenCalled();

      mockAllowanceState.value = '0';
      screen.rerender(<UniversalStake {...props} currentAllowance="0" />);
      await act(async () => jest.advanceTimersByTimeAsync(351));
      expect(mockEstimate).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'approve', amount: '2' }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not show a delayed approval estimate after allowance changes to require a reset', async () => {
    jest.useFakeTimers();
    try {
      const pending = deferred<{ feeFiatValue: string }>();
      mockShowEstimate.value = true;
      mockAllowanceState.value = '0';
      mockEstimate.mockReturnValueOnce(pending.promise);
      const screen = render(<UniversalStake {...props} />);
      fireEvent.change(screen.getByLabelText('amount'), {
        target: { value: '2' },
      });
      await act(async () => jest.advanceTimersByTimeAsync(351));
      expect(mockEstimate).toHaveBeenCalledTimes(1);
      mockAllowanceState.value = '1';
      screen.rerender(<UniversalStake {...props} />);
      await act(async () => pending.resolve({ feeFiatValue: 'stale' }));
      expect(screen.queryByTestId('estimated-fee')).toBeNull();
      await act(async () => jest.advanceTimersByTimeAsync(351));
      expect(mockEstimate).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it.each(['account', 'vault'] as const)(
    'does not reuse a delayed estimate after the %s changes',
    async (changedScope) => {
      jest.useFakeTimers();
      try {
        const pending = deferred<{ feeFiatValue: string }>();
        mockShowEstimate.value = true;
        mockAllowanceState.value = '0';
        mockEstimate
          .mockReturnValueOnce(pending.promise)
          .mockResolvedValue({ feeFiatValue: 'fresh' });
        const screen = render(<UniversalStake {...props} />);
        fireEvent.change(screen.getByLabelText('amount'), {
          target: { value: '2' },
        });
        await act(async () => jest.advanceTimersByTimeAsync(351));
        expect(mockEstimate).toHaveBeenCalledTimes(1);
        screen.rerender(
          <UniversalStake
            {...props}
            accountId={
              changedScope === 'account' ? 'account-b' : props.accountId
            }
            protocolInfo={
              changedScope === 'vault' && props.protocolInfo
                ? { ...props.protocolInfo, vault: 'other' }
                : props.protocolInfo
            }
          />,
        );
        await act(async () => pending.resolve({ feeFiatValue: 'stale' }));
        expect(screen.queryByTestId('estimated-fee')).toBeNull();
        await act(async () => jest.advanceTimersByTimeAsync(351));
        expect(screen.getByTestId('estimated-fee').textContent).toBe('fresh');
      } finally {
        jest.useRealTimers();
      }
    },
  );

  it('refreshes the USDC estimate when allowance changes without editing the amount', async () => {
    jest.useFakeTimers();
    try {
      const usdc = {
        ...token,
        symbol: 'USDC',
        address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      };
      const usdcProps = {
        ...props,
        tokenSymbol: 'USDC',
        tokenInfo: props.tokenInfo
          ? { ...props.tokenInfo, token: usdc }
          : undefined,
        approveTarget: { ...props.approveTarget, token: usdc },
      };
      mockAllowanceState.value = '0';
      mockEstimate.mockResolvedValue({ feeFiatValue: '1' });
      const screen = render(<UniversalStake {...usdcProps} />);
      fireEvent.change(screen.getByLabelText('amount'), {
        target: { value: '2' },
      });
      await act(async () => jest.advanceTimersByTimeAsync(351));
      expect(mockEstimate).toHaveBeenCalledTimes(1);
      mockAllowanceState.value = '1';
      screen.rerender(<UniversalStake {...usdcProps} />);
      await act(async () => jest.advanceTimersByTimeAsync(351));
      expect(mockEstimate).toHaveBeenCalledTimes(2);
      expect(mockEstimate).toHaveBeenLastCalledWith(
        expect.objectContaining({ amount: '2', action: 'approve' }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps a queued quote on the committed vault while another vault suspends', async () => {
    jest.useFakeTimers();
    try {
      const sourceProtocolInfo = props.protocolInfo;
      if (!sourceProtocolInfo)
        throw new OneKeyLocalError('Protocol info is required');
      const protocolInfo = sourceProtocolInfo;
      const onSuspended = jest.fn();
      const suspended = new Promise<never>(() => undefined);

      const Harness = () => {
        const [view, setView] = useState({ vault: '0xvaultA', suspend: false });
        const SuspendAfterStake = () => {
          if (view.suspend) {
            onSuspended();
            throw suspended;
          }
          return null;
        };
        return (
          <>
            <button
              type="button"
              onClick={() =>
                startTransition(() =>
                  setView({ vault: '0xvaultB', suspend: true }),
                )
              }
            >
              Suspend another vault
            </button>
            <Suspense fallback={<span>Loading vault</span>}>
              <UniversalStake
                {...props}
                approveType={undefined}
                preparationPolicy={undefined}
                protocolInfo={{ ...protocolInfo, vault: view.vault }}
              />
              <span data-testid="committed-vault">{view.vault}</span>
              <SuspendAfterStake />
            </Suspense>
          </>
        );
      };

      const screen = render(<Harness />);
      fireEvent.change(screen.getByLabelText('amount'), {
        target: { value: '2' },
      });
      expect(mockConfirmation).not.toHaveBeenCalled();
      fireEvent.click(screen.getByText('Suspend another vault'));
      expect(onSuspended).toHaveBeenCalled();
      expect(screen.getByTestId('committed-vault').textContent).toBe(
        '0xvaultA',
      );
      expect(mockConfirmation).not.toHaveBeenCalled();
      await act(async () => jest.advanceTimersByTimeAsync(351));
      expect(screen.getByTestId('committed-vault').textContent).toBe(
        '0xvaultA',
      );
      expect(mockConfirmation).toHaveBeenCalledTimes(1);
      expect(mockConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({ vault: '0xvaultA', amount: '2' }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it.each([false, true])(
    'handles the pending quote according to whether the next vault commits: %s',
    async (commitSecondVault) => {
      jest.useFakeTimers();
      try {
        const sourceProtocolInfo = props.protocolInfo;
        if (!sourceProtocolInfo)
          throw new OneKeyLocalError('Protocol info is required');
        const protocolInfo = sourceProtocolInfo;
        const pendingQuote = deferred<unknown>();
        const quote = { effectiveApy: '4.56' };
        const onQuoteReset = jest.fn();
        const onSecondRender = jest.fn();
        const suspended = new Promise<never>(() => undefined);
        mockConfirmation.mockReturnValueOnce(pendingQuote.promise);

        const Harness = () => {
          const [vault, setVault] = useState('0xvaultA');
          const SuspendAfterStake = () => {
            if (vault === '0xvaultB') {
              onSecondRender();
              if (!commitSecondVault) throw suspended;
            }
            return null;
          };
          return (
            <>
              <button
                type="button"
                onClick={() => startTransition(() => setVault('0xvaultB'))}
              >
                Switch vault
              </button>
              <Suspense fallback={<span>Loading vault</span>}>
                <UniversalStake
                  {...props}
                  approveType={undefined}
                  preparationPolicy={undefined}
                  protocolInfo={{ ...protocolInfo, vault }}
                  onQuoteReset={onQuoteReset}
                />
                <span data-testid="committed-vault">{vault}</span>
                <SuspendAfterStake />
              </Suspense>
            </>
          );
        };

        const screen = render(<Harness />);
        fireEvent.change(screen.getByLabelText('amount'), {
          target: { value: '2' },
        });
        await act(async () => jest.advanceTimersByTimeAsync(351));
        expect(mockConfirmation).toHaveBeenCalledTimes(1);
        expect(mockConfirmation).toHaveBeenCalledWith(
          expect.objectContaining({ vault: '0xvaultA', amount: '2' }),
        );
        expect(mockPendleLayout).toHaveBeenLastCalledWith(
          expect.objectContaining({ loading: true }),
        );
        expect(screen.getByTestId('quote-loading').textContent).toBe('true');

        fireEvent.click(screen.getByText('Switch vault'));
        expect(onSecondRender).toHaveBeenCalled();
        expect(screen.getByTestId('committed-vault').textContent).toBe(
          commitSecondVault ? '0xvaultB' : '0xvaultA',
        );
        await act(async () => pendingQuote.resolve(quote));
        expect(screen.getByTestId('committed-vault').textContent).toBe(
          commitSecondVault ? '0xvaultB' : '0xvaultA',
        );
        expect(onQuoteReset).toHaveBeenCalledTimes(commitSecondVault ? 0 : 1);
        expect(screen.getByTestId('quote-loading').textContent).toBe('false');
        expect(mockPendleLayout).toHaveBeenLastCalledWith(
          expect.objectContaining({
            transactionConfirmation: commitSecondVault ? undefined : quote,
            loading: false,
          }),
        );
      } finally {
        jest.useRealTimers();
      }
    },
  );

  it.each([
    ['Infinity', true],
    ['-1', true],
    ['', true],
    ['2', false],
  ] as const)(
    'keeps wrap approval visible for allowance %s when needed: %s',
    (allowance, needsApproval) => {
      mockPreviewAllowance.value = allowance;
      const nativeToken = {
        ...token,
        symbol: 'ETH',
        address: '',
        isNative: true,
        decimals: 18,
      };
      const wrappedToken = {
        ...token,
        symbol: 'WETH',
        address: EthereumWETH,
        decimals: 18,
      };
      const screen = render(
        <UniversalStake
          {...props}
          tokenSymbol="ETH"
          tokenInfo={{
            token: nativeToken,
            balanceParsed: '5',
            price: '1',
            accountId: 'account',
            networkId: 'evm--1',
            provider: 'etherfi',
            vault: '0xvault',
          }}
          approveType={undefined}
          approveTarget={{ ...props.approveTarget, token: nativeToken }}
          postWrapApproveTarget={{
            spenderAddress: '0xspender',
            token: wrappedToken,
          }}
          stakeType="wrap"
        />,
      );
      fireEvent.change(screen.getByLabelText('amount'), {
        target: { value: '2' },
      });
      expect(mockPreviewOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          undefinedResultIfError: true,
          keepResultIfError: true,
        }),
      );
      expect(mockStakeProgress).toHaveBeenLastCalledWith(
        expect.objectContaining({
          step2LabelId: needsApproval ? 'global.approve' : undefined,
        }),
      );
    },
  );

  it.each([false, true])(
    'handles an optional allowance preview failure after unmount=%s',
    async (unmount) => {
      mockRealPreview.enabled = true;
      let reject: (error: Error) => void = () => undefined;
      mockAllowance.mockReturnValueOnce(
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
      );
      const nativeToken = {
        ...token,
        symbol: 'ETH',
        address: '',
        isNative: true,
        decimals: 18,
      };
      const wrappedToken = {
        ...token,
        symbol: 'WETH',
        address: EthereumWETH,
        decimals: 18,
      };
      const screen = render(
        <UniversalStake
          {...props}
          tokenSymbol="ETH"
          tokenInfo={{
            token: nativeToken,
            balanceParsed: '5',
            price: '1',
            accountId: 'account',
            networkId: 'evm--1',
            provider: 'etherfi',
            vault: '0xvault',
          }}
          approveType={undefined}
          approveTarget={{ ...props.approveTarget, token: nativeToken }}
          postWrapApproveTarget={{
            spenderAddress: '0xspender',
            token: wrappedToken,
          }}
          stakeType="wrap"
        />,
      );
      await waitFor(() => expect(mockAllowance).toHaveBeenCalled());
      if (unmount) screen.unmount();
      await act(async () => {
        reject(new OneKeyLocalError('allowance preview failed'));
      });
      if (!unmount) {
        fireEvent.change(screen.getByLabelText('amount'), {
          target: { value: '2' },
        });
        expect(mockStakeProgress).toHaveBeenLastCalledWith(
          expect.objectContaining({ step2LabelId: 'global.approve' }),
        );
      }
    },
  );

  it('does not reuse a prior preview across blurred spender changes', async () => {
    mockRealPreview.enabled = true;
    const pendingAllowance = deferred<{ allowanceParsed: string }>();
    mockAllowance
      .mockResolvedValueOnce({ allowanceParsed: '2' })
      .mockReturnValueOnce(pendingAllowance.promise);
    const nativeToken = {
      ...token,
      symbol: 'ETH',
      address: '',
      isNative: true,
      decimals: 18,
    };
    const wrappedToken = {
      ...token,
      symbol: 'WETH',
      address: EthereumWETH,
      decimals: 18,
    };
    const wrapProps: ComponentProps<typeof UniversalStake> = {
      ...props,
      tokenSymbol: 'ETH',
      tokenInfo: {
        token: nativeToken,
        balanceParsed: '5',
        price: '1',
        accountId: 'account',
        networkId: 'evm--1',
        provider: 'etherfi',
        vault: '0xvault',
      },
      approveType: undefined,
      approveTarget: { ...props.approveTarget, token: nativeToken },
      postWrapApproveTarget: {
        spenderAddress: '0xspenderA',
        token: wrappedToken,
      },
      stakeType: 'wrap',
    };
    const screen = render(<UniversalStake {...wrapProps} />);
    fireEvent.change(screen.getByLabelText('amount'), {
      target: { value: '1' },
    });
    await waitFor(() => {
      expect(mockStakeProgress).toHaveBeenLastCalledWith(
        expect.objectContaining({ step2LabelId: undefined }),
      );
    });

    mockPreviewFocus.focused = false;
    screen.rerender(
      <UniversalStake
        {...wrapProps}
        postWrapApproveTarget={{
          spenderAddress: '0xspenderB',
          token: wrappedToken,
        }}
      />,
    );
    expect(mockAllowance).toHaveBeenCalledTimes(1);
    expect(mockStakeProgress).toHaveBeenLastCalledWith(
      expect.objectContaining({ step2LabelId: 'global.approve' }),
    );

    screen.rerender(<UniversalStake {...wrapProps} />);
    expect(mockStakeProgress).toHaveBeenLastCalledWith(
      expect.objectContaining({ step2LabelId: 'global.approve' }),
    );
    mockPreviewFocus.focused = true;
    screen.rerender(<UniversalStake {...wrapProps} />);
    await waitFor(() => expect(mockAllowance).toHaveBeenCalledTimes(2));
    expect(mockStakeProgress).toHaveBeenLastCalledWith(
      expect.objectContaining({ step2LabelId: 'global.approve' }),
    );
    await act(async () => {
      pendingAllowance.resolve({ allowanceParsed: '0' });
    });
    expect(mockStakeProgress).toHaveBeenLastCalledWith(
      expect.objectContaining({ step2LabelId: 'global.approve' }),
    );
  });

  async function startWrappedTaskGuardTest({
    editAmountBeforeSubmit = false,
  }: { editAmountBeforeSubmit?: boolean } = {}) {
    const nativeToken = {
      ...token,
      symbol: 'ETH',
      name: 'ETH',
      address: '',
      isNative: true,
      decimals: 18,
    };
    const wrappedToken = {
      ...token,
      symbol: 'WETH',
      name: 'WETH',
      address: EthereumWETH,
      decimals: 18,
    };
    const verify = jest.fn().mockResolvedValue(true);
    const actionGuard = {
      loading: false,
      blocked: false,
      verifyBeforeAction: verify,
    };
    const pending = deferred<boolean>();
    const onConfirm = jest.fn(
      (_params: IEarnStakeConfirmParams) => pending.promise,
    );
    const taskProps: ComponentProps<typeof UniversalStake> = {
      ...props,
      balance: '5',
      tokenSymbol: 'ETH',
      tokenInfo: {
        token: nativeToken,
        balanceParsed: '5',
        price: '1',
        accountId: 'account',
        networkId: 'evm--1',
        provider: 'etherfi',
        vault: '0xvault',
      },
      approveType: undefined,
      approveTarget: { ...props.approveTarget, token: nativeToken },
      postWrapApproveTarget: {
        spenderAddress: '0xspender',
        token: wrappedToken,
      },
      stakeType: 'wrap',
      actionGuard: editAmountBeforeSubmit ? undefined : actionGuard,
      onConfirm,
    };
    const screen = render(<UniversalStake {...taskProps} />);
    fireEvent.change(screen.getByLabelText('amount'), {
      target: { value: editAmountBeforeSubmit ? '1' : '2' },
    });
    const button = await screen.findByRole('button', {
      name: 'Limit.native_token_no_sell_wrap',
    });
    await waitFor(() => expect(mockCheck).toHaveBeenCalled());
    await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false));
    if (editAmountBeforeSubmit) {
      fireEvent.change(screen.getByLabelText('amount'), {
        target: { value: '2' },
      });
      await act(async () => {});
    }
    fireEvent.click(button);
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    const beforeSend = onConfirm.mock.calls[0][0].beforeDepositTaskSend;
    expect(beforeSend).toBeDefined();
    verify.mockClear();
    return {
      screen,
      taskProps,
      actionGuard,
      verify,
      beforeSend,
      onConfirm,
      pending,
    };
  }

  it('does not reset a wrapped task if its completion was not settled', async () => {
    const { screen, onConfirm, pending } = await startWrappedTaskGuardTest();
    let task = createDepositTask({
      taskId: 'wrapped-unsettled',
      identity: {
        accountId: 'account',
        accountAddress: '0xowner',
        networkId: 'evm--1',
        provider: 'etherfi',
        vault: '0xvault',
        inputTokenAddress: '',
        depositTokenAddress: EthereumWETH,
        amount: '2',
        spenderAddress: '0xspender',
      },
      steps: [{ id: 'deposit', kind: 'deposit' }],
    });
    const event = {
      taskId: task.taskId,
      stepId: 'deposit',
      attemptId: 'attempt',
    };
    task = reduceDepositTask(task, { ...event, type: 'start' });
    task = reduceDepositTask(task, { ...event, type: 'confirmationOpened' });
    task = reduceDepositTask(task, { ...event, type: 'sendStarted' });
    task = reduceDepositTask(task, { ...event, type: 'submitted', txid: 'tx' });
    task = reduceDepositTask(task, { ...event, type: 'handoff' });
    task = { ...task, recording: { txid: 'tx', status: 'succeeded' } };
    const handle: IDepositTaskHandle = {
      getTask: () => task,
      run: jest.fn(),
      retry: jest.fn(),
      retryStatus: jest.fn(),
      cancel: jest.fn(),
      dispose: jest.fn(),
    };
    act(() => {
      onConfirm.mock.calls[0][0].onDepositTaskReady?.(handle);
    });
    await act(async () => pending.resolve(true));
    expect((screen.getByLabelText('amount') as HTMLInputElement).value).toBe(
      '2',
    );
    expect(handle.dispose).not.toHaveBeenCalled();
  });

  it.each(['disabled', 'blocked'] as const)(
    'keeps a pending task blocked when an enabled render suspends: %s',
    async (reason) => {
      const pending = deferred<boolean>();
      const onConfirm = jest.fn(
        (_params: IEarnStakeConfirmParams) => pending.promise,
      );
      const verify = jest.fn().mockResolvedValue(true);
      const onSuspended = jest.fn();
      const suspended = new Promise<never>(() => undefined);
      const nativeToken = {
        ...token,
        symbol: 'ETH',
        address: '',
        isNative: true,
        decimals: 18,
      };
      const wrappedToken = {
        ...token,
        symbol: 'WETH',
        address: EthereumWETH,
        decimals: 18,
      };

      function Harness() {
        const [view, setView] = useState({ blocked: false, suspend: false });
        function SuspendAfterStake() {
          if (view.suspend) {
            onSuspended();
            throw suspended;
          }
          return null;
        }
        return (
          <>
            <button
              type="button"
              onClick={() => setView({ blocked: true, suspend: false })}
            >
              Commit blocked state
            </button>
            <button
              type="button"
              onClick={() =>
                startTransition(() =>
                  setView({ blocked: false, suspend: true }),
                )
              }
            >
              Suspend enabled state
            </button>
            <Suspense fallback={<span>Loading form</span>}>
              <UniversalStake
                {...props}
                balance="5"
                tokenSymbol="ETH"
                tokenInfo={{
                  token: nativeToken,
                  balanceParsed: '5',
                  price: '1',
                  accountId: 'account',
                  networkId: 'evm--1',
                  provider: 'etherfi',
                  vault: '0xvault',
                }}
                approveType={undefined}
                approveTarget={{ ...props.approveTarget, token: nativeToken }}
                postWrapApproveTarget={{
                  spenderAddress: '0xspender',
                  token: wrappedToken,
                }}
                stakeType="wrap"
                actionGuard={{
                  loading: false,
                  blocked: reason === 'blocked' && view.blocked,
                  verifyBeforeAction: verify,
                }}
                isDisabled={reason === 'disabled' && view.blocked}
                onConfirm={onConfirm}
              />
              <span data-testid="committed-guard">
                {view.blocked ? 'blocked' : 'enabled'}
              </span>
              <SuspendAfterStake />
            </Suspense>
          </>
        );
      }

      const screen = render(<Harness />);
      fireEvent.change(screen.getByLabelText('amount'), {
        target: { value: '2' },
      });
      const button = await screen.findByRole('button', {
        name: 'Limit.native_token_no_sell_wrap',
      });
      await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false));
      fireEvent.click(button);
      await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
      const beforeSend = onConfirm.mock.calls[0][0].beforeDepositTaskSend;
      expect(beforeSend).toBeDefined();

      fireEvent.click(screen.getByText('Commit blocked state'));
      expect(screen.getByTestId('committed-guard').textContent).toBe('blocked');
      expect(await beforeSend?.('deposit')).toBe(false);
      fireEvent.click(screen.getByText('Suspend enabled state'));
      await waitFor(() => expect(onSuspended).toHaveBeenCalled());
      expect(screen.getByTestId('committed-guard').textContent).toBe('blocked');
      expect(await beforeSend?.('deposit')).toBe(false);
      await act(async () => pending.resolve(false));
    },
  );

  it('checks input validity before wrap but does not block later task steps on spent ETH', async () => {
    const { screen, taskProps, verify, beforeSend } =
      await startWrappedTaskGuardTest();
    expect(await beforeSend?.('wrap')).toBe(true);
    expect(verify).toHaveBeenCalledWith({ allowRevoke: false });
    verify.mockClear();
    screen.rerender(<UniversalStake {...taskProps} balance="0" />);

    expect(await beforeSend?.('wrap')).toBe(false);
    expect(verify).not.toHaveBeenCalled();
    expect(await beforeSend?.('approve')).toBe(true);
    expect(await beforeSend?.('deposit')).toBe(true);
    expect(verify.mock.calls).toEqual([
      [{ allowRevoke: false }],
      [{ allowRevoke: false }],
    ]);
  });

  it('ignores a stale input check that finishes after the task validates its wrapped asset', async () => {
    const staleCheck = deferred<unknown>();
    const valid = { code: 0, message: '', data: { alerts: [] } };
    mockCheck
      .mockResolvedValueOnce(valid)
      .mockResolvedValueOnce(valid)
      .mockReturnValueOnce(staleCheck.promise)
      .mockResolvedValue(valid);

    const { onConfirm, beforeSend } = await startWrappedTaskGuardTest({
      editAmountBeforeSubmit: true,
    });
    await waitFor(() => expect(mockCheck).toHaveBeenCalledTimes(3));
    const prepare = onConfirm.mock.calls[0][0].prepareWrappedDeposit;
    expect(prepare).toBeDefined();
    let prepared: Awaited<ReturnType<NonNullable<typeof prepare>>> | undefined;
    await act(async () => {
      prepared = await prepare?.(new AbortController().signal);
    });
    expect(prepared).toEqual({ type: 'confirm', effectiveApy: undefined });
    expect(mockCheck).toHaveBeenCalledTimes(4);
    await act(async () => {
      staleCheck.resolve({
        code: 1,
        message: 'stale input validation error',
        data: { alerts: [] },
      });
      await staleCheck.promise;
    });
    expect(await beforeSend?.('deposit')).toBe(true);
  });

  it('prepares the wrapped deposit with WETH inputs and the fresh quote', async () => {
    const { onConfirm } = await startWrappedTaskGuardTest();
    const prepare = onConfirm.mock.calls[0][0].prepareWrappedDeposit;
    expect(prepare).toBeDefined();
    mockCheck.mockClear();
    mockConfirmation.mockClear().mockResolvedValue({ effectiveApy: '4.56' });
    mockEstimate.mockClear().mockResolvedValue(undefined);
    let preparation:
      | Awaited<ReturnType<NonNullable<typeof prepare>>>
      | undefined;
    await act(async () => {
      preparation = await prepare?.(new AbortController().signal);
    });
    expect(preparation).toEqual({ type: 'confirm', effectiveApy: '4.56' });
    expect(mockCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'account',
        networkId: 'evm--1',
        amount: '2',
        inputTokenAddress: EthereumWETH,
        stakeType: 'normal',
      }),
    );
    expect(mockConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({
        networkId: 'evm--1',
        amount: '2',
        inputTokenAddress: EthereumWETH,
      }),
    );
    expect(mockEstimate).toHaveBeenCalledWith(
      expect.objectContaining({
        networkId: 'evm--1',
        amount: '2',
        inputTokenAddress: EthereumWETH,
        stakeType: 'normal',
      }),
    );
  });

  it('does not let an older preparation estimate replace the deposit estimate', async () => {
    mockShowEstimate.value = true;
    const pending = deferred<{ feeFiatValue: string }>();
    mockEstimate.mockResolvedValue(undefined);
    const { onConfirm, screen, taskProps } = await startWrappedTaskGuardTest();
    mockEstimate
      .mockReset()
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValue({ feeFiatValue: 'deposit' });
    mockAllowanceState.value = '0';
    screen.rerender(<UniversalStake {...taskProps} />);
    await waitFor(() => expect(mockEstimate).toHaveBeenCalledTimes(1));
    const prepare = onConfirm.mock.calls[0][0].prepareWrappedDeposit;
    expect(prepare).toBeDefined();
    await act(async () => prepare?.(new AbortController().signal));
    expect(screen.getByTestId('estimated-fee').textContent).toBe('deposit');
    await act(async () => pending.resolve({ feeFiatValue: 'old' }));
    expect(screen.getByTestId('estimated-fee').textContent).toBe('deposit');
  });

  it('blocks a successful amount response with alerts without showing its success message as an error', async () => {
    const { onConfirm, beforeSend, screen } = await startWrappedTaskGuardTest();
    const prepare = onConfirm.mock.calls[0][0].prepareWrappedDeposit;
    mockCheck.mockResolvedValueOnce({
      code: 0,
      message: 'server success message',
      data: { alerts: [{ type: 'warning', text: { text: 'risk alert' } }] },
    });
    let result: Awaited<ReturnType<NonNullable<typeof prepare>>> | undefined;
    await act(async () => {
      result = await prepare?.(new AbortController().signal);
    });
    expect(result).toEqual({ type: 'cancelled' });
    expect(screen.getByTestId('alert-warning')).toBeTruthy();
    expect(screen.queryByText('server success message')).toBeNull();
    expect(screen.queryByTestId('alert-critical')).toBeNull();
    expect(await beforeSend?.('deposit')).toBe(false);
    expect(mockBuildStake).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it.each(['invalid amount', 'guard rejected'] as const)(
    'cancels wrapped deposit preparation when %s',
    async (reason) => {
      const { onConfirm, verify } = await startWrappedTaskGuardTest();
      const prepare = onConfirm.mock.calls[0][0].prepareWrappedDeposit;
      expect(prepare).toBeDefined();
      mockCheck.mockClear();
      mockConfirmation.mockClear();
      if (reason === 'invalid amount') {
        mockCheck.mockResolvedValueOnce({
          code: 1,
          message: 'invalid amount',
          data: { alerts: [] },
        });
      } else {
        verify.mockResolvedValue(false);
      }
      let preparation:
        | Awaited<ReturnType<NonNullable<typeof prepare>>>
        | undefined;
      await act(async () => {
        preparation = await prepare?.(new AbortController().signal);
      });
      expect(preparation).toEqual({ type: 'cancelled' });
      if (reason === 'invalid amount') {
        expect(mockConfirmation).not.toHaveBeenCalled();
      } else {
        expect(verify).toHaveBeenCalledWith({ allowRevoke: false });
      }
      expect(mockBuildStake).not.toHaveBeenCalled();
    },
  );

  it.each(['blocked', 'disabled', 'scope'] as const)(
    'blocks a task confirmation when the form is %s',
    async (reason) => {
      const { screen, taskProps, actionGuard, verify, beforeSend } =
        await startWrappedTaskGuardTest();
      if (reason === 'blocked') {
        screen.rerender(
          <UniversalStake
            {...taskProps}
            actionGuard={{ ...actionGuard, blocked: true }}
          />,
        );
      } else if (reason === 'disabled') {
        screen.rerender(<UniversalStake {...taskProps} isDisabled />);
      } else {
        screen.rerender(<UniversalStake {...taskProps} accountId="other" />);
      }
      expect(await beforeSend?.('deposit')).toBe(false);
      expect(verify).not.toHaveBeenCalled();
    },
  );

  it('blocks a task confirmation when the read-only action guard rejects it', async () => {
    const { verify, beforeSend } = await startWrappedTaskGuardTest();
    verify.mockResolvedValueOnce(false);
    expect(await beforeSend?.('deposit')).toBe(false);
    expect(verify).toHaveBeenCalledWith({ allowRevoke: false });
  });

  it.each(['blocked', 'disabled', 'scope'] as const)(
    'blocks a task confirmation when %s changes during the guard check',
    async (reason) => {
      const { screen, taskProps, actionGuard, verify, beforeSend } =
        await startWrappedTaskGuardTest();
      const pendingGuard = deferred<boolean>();
      verify.mockReturnValueOnce(pendingGuard.promise);
      const checking = beforeSend?.('deposit');
      expect(verify).toHaveBeenCalledWith({ allowRevoke: false });
      if (reason === 'blocked') {
        screen.rerender(
          <UniversalStake
            {...taskProps}
            actionGuard={{ ...actionGuard, blocked: true }}
          />,
        );
      } else if (reason === 'disabled') {
        screen.rerender(<UniversalStake {...taskProps} isDisabled />);
      } else {
        screen.rerender(<UniversalStake {...taskProps} accountId="other" />);
      }
      pendingGuard.resolve(true);
      expect(await checking).toBe(false);
    },
  );

  it('blocks the transaction and offers retry when approval tracking is unknown', async () => {
    mockAllowanceState.available = false;
    mockAllowanceState.error = true;
    const screen = render(<UniversalStake {...props} />);
    fireEvent.change(screen.getByLabelText('amount'), {
      target: { value: '2' },
    });
    const button = await screen.findByRole('button', {
      name: 'global.approve',
    });
    expect(button.hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'global.retry' }));
    expect(mockRetryAllowance).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('disables the transaction action when the parent becomes disabled after entering an amount', async () => {
    const screen = render(<UniversalStake {...props} />);
    fireEvent.change(screen.getByLabelText('amount'), {
      target: { value: '2' },
    });
    const button = await screen.findByRole('button', {
      name: 'global.approve',
    });
    await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false));
    screen.rerender(<UniversalStake {...props} isDisabled />);
    expect(button.hasAttribute('disabled')).toBe(true);
    expect((screen.getByLabelText('amount') as HTMLInputElement).value).toBe(
      '2',
    );
  });

  function directApprovalOverrides(verify: () => Promise<boolean>) {
    const usdc = {
      ...token,
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0x1111111111111111111111111111111111111111',
    };
    mockAllowance
      .mockResolvedValueOnce({ allowanceParsed: '0' })
      .mockResolvedValue({ allowanceParsed: '2' });
    return {
      ...props,
      tokenSymbol: 'USDC',
      tokenInfo: {
        token: usdc,
        balanceParsed: '5',
        price: '1',
        accountId: 'account',
        networkId: 'evm--1',
        provider: 'etherfi',
        vault: '0xvault',
      },
      approveTarget: { ...props.approveTarget, token: usdc },
      actionGuard: {
        loading: false,
        blocked: false,
        verifyBeforeAction: verify,
      },
    } satisfies ComponentProps<typeof UniversalStake>;
  }

  async function beginDirectApproval(verify: () => Promise<boolean>) {
    const overrides = directApprovalOverrides(verify);
    const screen = render(<StakeTaskHarness {...overrides} />);
    fireEvent.change(screen.getByLabelText('amount'), {
      target: { value: '2' },
    });
    const button = await screen.findByRole('button', {
      name: 'global.approve',
    });
    await waitFor(() => expect(mockCheck).toHaveBeenCalled());
    await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false));
    fireEvent.click(button);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    return { screen, overrides };
  }

  it('renders stake progress inside the manage-position modal', async () => {
    const overrides = directApprovalOverrides(async () => true);
    const screen = render(<StakeTaskHarness {...overrides} isInModalContext />);
    fireEvent.change(screen.getByLabelText('amount'), {
      target: { value: '2' },
    });
    await screen.findByTestId('legacy-stake-progress');
    const approve = await screen.findByRole('button', {
      name: 'global.approve',
    });
    await waitFor(() => expect(approve.hasAttribute('disabled')).toBe(false));
    fireEvent.click(approve);
    await screen.findByTestId('task-progress');
  });

  it('disables asset selection while a deposit task is active', async () => {
    const onSelectAsset = jest.fn();
    const overrides = directApprovalOverrides(async () => true);
    const screen = render(
      <StakeTaskHarness
        {...overrides}
        tokenSelectorTriggerProps={{ onPress: onSelectAsset }}
      />,
    );
    const selector = screen.getByRole('button', { name: 'Select asset' });
    fireEvent.click(selector);
    expect(onSelectAsset).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('amount'), {
      target: { value: '2' },
    });
    const approve = await screen.findByRole('button', {
      name: 'global.approve',
    });
    await waitFor(() => expect(approve.hasAttribute('disabled')).toBe(false));
    fireEvent.click(approve);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    expect(selector.hasAttribute('disabled')).toBe(true);
    fireEvent.click(selector);
    expect(onSelectAsset).toHaveBeenCalledTimes(1);
  });

  it('lets the user check an approval hash that arrives after cancellation without resending', async () => {
    const { screen } = await beginDirectApproval(async () => true);
    const confirmation = mockNavigate.mock.calls[0][0];
    await act(async () => {
      await confirmation.onBeforeSend?.();
      confirmation.onCancel?.();
    });
    const pending = await screen.findByRole('button', {
      name: 'global.pending',
    });
    expect(pending.hasAttribute('disabled')).toBe(true);
    expect(mockWaitStatus).not.toHaveBeenCalled();

    await act(async () => {
      confirmation.onSuccess([{ decodedTx: { txid: 'late-approval-tx' } }]);
    });
    const retry = await screen.findByRole('button', { name: 'global.retry' });
    expect(retry.hasAttribute('disabled')).toBe(false);
    expect(mockWaitStatus).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledTimes(1);

    mockWaitStatus.mockResolvedValue(undefined);
    fireEvent.click(retry);
    await waitFor(() => expect(mockWaitStatus).toHaveBeenCalledTimes(1));
    expect(mockWaitStatus).toHaveBeenCalledWith(
      expect.objectContaining({ txid: 'late-approval-tx' }),
    );
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockBuildStake).not.toHaveBeenCalled();
  });

  it('records a deposit hash arriving after cancellation without navigating the old page', async () => {
    mockWaitStatus.mockResolvedValue(EOnChainHistoryTxStatus.Success);
    mockBuildStake.mockResolvedValue({
      tx: { to: '0xvault', data: '0x' },
      orderId: 'order-1',
    });
    const { screen } = await beginDirectApproval(async () => true);
    await submitConfirmation(0, 'approval-tx');
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(2));

    const deposit = mockNavigate.mock.calls[1][0];
    await act(async () => {
      await deposit.onBeforeSend?.();
      deposit.onCancel?.();
    });
    expect(
      await screen.findByRole('button', { name: 'global.pending' }),
    ).toBeTruthy();
    await act(async () => {
      deposit.onSuccess([
        {
          signedTx: { txid: 'late-deposit-tx' },
          decodedTx: { txid: 'late-deposit-tx', status: 'pending' },
        },
      ]);
    });
    await waitFor(() => expect(mockAddOrder).toHaveBeenCalledTimes(1));
    expect(mockAddOrder).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order-1', txId: 'late-deposit-tx' }),
    );
    expect(mockTaskSuccess).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledTimes(2);
    await waitFor(() =>
      expect((screen.getByLabelText('amount') as HTMLInputElement).value).toBe(
        '',
      ),
    );
    expect(screen.getByLabelText('amount').hasAttribute('disabled')).toBe(
      false,
    );
  });

  it('retries only the failed order recording while asset metadata is loading', async () => {
    mockWaitStatus.mockResolvedValue(EOnChainHistoryTxStatus.Success);
    mockBuildStake.mockResolvedValue({
      tx: { to: '0xvault', data: '0x' },
      orderId: 'order-1',
    });
    mockAddOrder
      .mockResolvedValueOnce({
        localStatus: 'failed',
        remoteStatus: 'notAttempted',
      })
      .mockResolvedValue({ localStatus: 'saved', remoteStatus: 'synced' });
    const { screen, overrides } = await beginDirectApproval(async () => true);
    await submitConfirmation(0, 'approval-tx');
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(2));
    await submitConfirmation(1, 'deposit-tx');
    await waitFor(() => expect(mockAddOrder).toHaveBeenCalledTimes(1));
    const retry = await screen.findByRole('button', { name: 'global.retry' });
    expect((screen.getByLabelText('amount') as HTMLInputElement).value).toBe(
      '2',
    );
    const blockedGuard = jest.fn().mockResolvedValue(false);
    screen.rerender(
      <StakeTaskHarness
        {...overrides}
        isStakeAssetLoading
        isDisabled
        actionGuard={{
          loading: false,
          blocked: true,
          verifyBeforeAction: blockedGuard,
        }}
      />,
    );
    await waitFor(() => expect(retry.hasAttribute('disabled')).toBe(false));
    fireEvent.click(retry);
    await waitFor(() => expect(mockAddOrder).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mockTaskSuccess).toHaveBeenCalledTimes(1));
    expect(mockNavigate).toHaveBeenCalledTimes(2);
    expect(blockedGuard).not.toHaveBeenCalled();
    screen.rerender(<StakeTaskHarness {...overrides} />);
    await waitFor(() =>
      expect((screen.getByLabelText('amount') as HTMLInputElement).value).toBe(
        '',
      ),
    );
  });

  it('only dismisses an uncertain remote order after a final transaction status without resending', async () => {
    mockWaitStatus.mockResolvedValue(EOnChainHistoryTxStatus.Success);
    mockBuildStake.mockResolvedValue({
      tx: { to: '0xvault', data: '0x' },
      orderId: 'order-1',
    });
    mockAddOrder.mockResolvedValueOnce({
      localStatus: 'saved',
      remoteStatus: 'failed',
    });
    const { screen } = await beginDirectApproval(async () => true);
    await submitConfirmation(0, 'approval-tx');
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(2));
    await submitConfirmation(1, 'deposit-tx');
    const done = await screen.findByRole('button', { name: 'global.done' });
    expect(screen.getByText('global.sync_error')).toBeTruthy();
    expect(done.hasAttribute('disabled')).toBe(false);
    expect(screen.queryByRole('button', { name: 'global.retry' })).toBeNull();
    mockWaitStatus.mockResolvedValue(undefined);
    fireEvent.click(done);
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith({ title: 'global.pending' }),
    );
    expect(screen.getByRole('button', { name: 'global.done' })).toBeTruthy();
    expect((screen.getByLabelText('amount') as HTMLInputElement).value).toBe(
      '2',
    );
    expect(mockWaitStatus).toHaveBeenCalledWith(
      expect.objectContaining({ txid: 'deposit-tx', maxAttempts: 1 }),
    );
    mockWaitStatus.mockResolvedValue(EOnChainHistoryTxStatus.Success);
    fireEvent.click(done);
    await waitFor(() =>
      expect((screen.getByLabelText('amount') as HTMLInputElement).value).toBe(
        '',
      ),
    );
    expect(mockAddOrder).toHaveBeenCalledTimes(1);
    expect(mockTaskSuccess).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledTimes(2);
  });

  it('does not navigate or clear a completed order when the actual account changes', async () => {
    mockWaitStatus.mockResolvedValue(EOnChainHistoryTxStatus.Success);
    mockBuildStake.mockResolvedValue({
      tx: { to: '0xvault', data: '0x' },
      orderId: 'order-1',
    });
    mockAddOrder.mockImplementationOnce(async () => {
      mockTaskAddress.mockResolvedValue('0xother');
      return { localStatus: 'saved', remoteStatus: 'synced' };
    });
    const { screen } = await beginDirectApproval(async () => true);
    await submitConfirmation(0, 'approval-tx');
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(2));
    await submitConfirmation(1, 'deposit-tx');
    const done = await screen.findByRole('button', { name: 'global.done' });
    expect(mockTaskSuccess).not.toHaveBeenCalled();
    fireEvent.click(done);
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith({
        title: 'global.an_error_occurred',
      }),
    );
    expect(screen.getByRole('button', { name: 'global.done' })).toBeTruthy();
    expect((screen.getByLabelText('amount') as HTMLInputElement).value).toBe(
      '2',
    );
    expect(mockNavigate).toHaveBeenCalledTimes(2);
    const addressRead = deferred<string>();
    const addressReadCount = mockTaskAddress.mock.calls.length;
    mockTaskAddress.mockReturnValueOnce(addressRead.promise);
    fireEvent.click(done);
    fireEvent.click(done);
    expect(mockTaskAddress).toHaveBeenCalledTimes(addressReadCount + 1);
    await act(async () => addressRead.resolve('0xowner'));
    await waitFor(() =>
      expect((screen.getByLabelText('amount') as HTMLInputElement).value).toBe(
        '',
      ),
    );
    expect(mockToast).toHaveBeenCalledTimes(1);
    expect(mockTaskSuccess).not.toHaveBeenCalled();
  });

  it('keeps only order recovery after the spender changes within the same owner', async () => {
    const onTaskRecoveryComplete = jest.fn();
    mockWaitStatus.mockResolvedValue(EOnChainHistoryTxStatus.Success);
    mockBuildStake.mockResolvedValue({
      tx: { to: '0xvault', data: '0x' },
      orderId: 'order-1',
    });
    mockAddOrder
      .mockResolvedValueOnce({
        localStatus: 'failed',
        remoteStatus: 'notAttempted',
      })
      .mockResolvedValue({ localStatus: 'saved', remoteStatus: 'synced' });
    const { screen, overrides } = await beginDirectApproval(async () => true);
    await submitConfirmation(0, 'approval-tx');
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(2));
    await submitConfirmation(1, 'deposit-tx');
    const retry = await screen.findByRole('button', { name: 'global.retry' });
    screen.rerender(
      <StakeTaskHarness
        {...overrides}
        onTaskRecoveryComplete={onTaskRecoveryComplete}
        approveTarget={{
          ...overrides.approveTarget,
          spenderAddress: '0xother',
        }}
      />,
    );
    await waitFor(() => expect(retry.hasAttribute('disabled')).toBe(false));
    fireEvent.click(retry);
    await waitFor(() => expect(mockAddOrder).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'global.retry' })).toBeNull(),
    );
    expect(mockNavigate).toHaveBeenCalledTimes(2);
    expect(mockTaskSuccess).not.toHaveBeenCalled();
    expect(onTaskRecoveryComplete).not.toHaveBeenCalled();
    expect((screen.getByLabelText('amount') as HTMLInputElement).value).toBe(
      '2',
    );
    fireEvent.click(screen.getByRole('button', { name: 'global.done' }));
    await waitFor(() =>
      expect((screen.getByLabelText('amount') as HTMLInputElement).value).toBe(
        '',
      ),
    );
    expect(mockNavigate).toHaveBeenCalledTimes(2);
    expect(mockTaskSuccess).not.toHaveBeenCalled();
    expect(onTaskRecoveryComplete).toHaveBeenCalledTimes(1);
  });

  it('blocks a new deposit while an old broadcast is unknown across spender changes', async () => {
    mockWaitStatus.mockResolvedValue(EOnChainHistoryTxStatus.Success);
    mockBuildStake.mockResolvedValue({
      tx: { to: '0xvault', data: '0x' },
      orderId: 'order-1',
    });
    const { screen, overrides } = await beginDirectApproval(async () => true);
    await submitConfirmation(0, 'approval-tx');
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(2));
    const deposit = mockNavigate.mock.calls[1][0];
    await act(async () => {
      await deposit.onBeforeSend?.();
      deposit.onCancel?.();
    });
    screen.rerender(
      <StakeTaskHarness
        {...overrides}
        approveTarget={{
          ...overrides.approveTarget,
          spenderAddress: '0xother',
        }}
      />,
    );
    let pending = await screen.findByRole('button', { name: 'global.pending' });
    expect(pending.hasAttribute('disabled')).toBe(true);
    screen.rerender(<StakeTaskHarness {...overrides} />);
    pending = await screen.findByRole('button', { name: 'global.pending' });
    expect(pending.hasAttribute('disabled')).toBe(true);
    expect(mockNavigate).toHaveBeenCalledTimes(2);
    await act(async () =>
      deposit.onSuccess([{ decodedTx: { txid: 'late-deposit-tx' } }]),
    );
    await waitFor(() => expect(mockAddOrder).toHaveBeenCalledTimes(1));
    expect(mockAddOrder).toHaveBeenCalledWith(
      expect.objectContaining({ txId: 'late-deposit-tx' }),
    );
    expect(mockTaskSuccess).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledTimes(2);
  });

  it('keeps a pending transaction when only the EVM address casing changes', async () => {
    mockWaitStatus.mockResolvedValue(EOnChainHistoryTxStatus.Success);
    mockBuildStake.mockResolvedValue({
      tx: { to: '0xvault', data: '0x' },
      orderId: 'order-1',
    });
    const { screen, overrides } = await beginDirectApproval(async () => true);
    await submitConfirmation(0, 'approval-tx');
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(2));
    const deposit = mockNavigate.mock.calls[1][0];
    await act(async () => {
      await deposit.onBeforeSend?.();
      deposit.onCancel?.();
    });
    const protocol = overrides.protocolInfo;
    const earnAccount = protocol?.earnAccount;
    if (!protocol || !earnAccount)
      throw new OneKeyLocalError('Missing test account');
    screen.rerender(
      <StakeTaskHarness
        {...overrides}
        protocolInfo={{
          ...protocol,
          earnAccount: {
            ...earnAccount,
            accountAddress: earnAccount.accountAddress.toUpperCase(),
          },
        }}
      />,
    );
    expect(
      (
        await screen.findByRole('button', { name: 'global.pending' })
      ).hasAttribute('disabled'),
    ).toBe(true);
    expect(screen.getByLabelText('amount').hasAttribute('disabled')).toBe(true);
    expect(mockNavigate).toHaveBeenCalledTimes(2);
  });

  it('shows an unresolved task after returning to an account with an empty amount', async () => {
    mockWaitStatus.mockResolvedValue(EOnChainHistoryTxStatus.Success);
    mockBuildStake.mockResolvedValue({
      tx: { to: '0xvault', data: '0x' },
      orderId: 'order-1',
    });
    const { screen, overrides } = await beginDirectApproval(async () => true);
    await submitConfirmation(0, 'approval-tx');
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(2));
    const deposit = mockNavigate.mock.calls[1][0];
    await act(async () => {
      await deposit.onBeforeSend?.();
      deposit.onCancel?.();
    });
    screen.rerender(<StakeTaskHarness {...overrides} accountId="other" />);
    fireEvent.change(screen.getByLabelText('amount'), {
      target: { value: '' },
    });
    screen.rerender(<StakeTaskHarness {...overrides} />);
    expect(await screen.findByTestId('task-progress')).toBeTruthy();
    expect(screen.getByLabelText('amount').hasAttribute('disabled')).toBe(true);
    expect(
      (
        await screen.findByRole('button', { name: 'global.pending' })
      ).hasAttribute('disabled'),
    ).toBe(true);
    expect(mockNavigate).toHaveBeenCalledTimes(2);
  });

  it.each(['failed', 'succeeded'] as const)(
    'recovers a recording that %s while the committed form is suspended',
    async (outcome) => {
      let resolveRecording: (value: IOrderResult) => void = () => undefined;
      const pending = new Promise<IOrderResult>((resolve) => {
        resolveRecording = resolve;
      });
      mockAddOrder
        .mockReturnValueOnce(pending)
        .mockResolvedValue({ localStatus: 'saved', remoteStatus: 'synced' });
      mockWaitStatus.mockResolvedValue(EOnChainHistoryTxStatus.Success);
      mockBuildStake.mockResolvedValue({
        tx: { to: '0xvault', data: '0x' },
        orderId: 'order-1',
      });
      const overrides = directApprovalOverrides(async () => true);
      const never = new Promise<never>(() => undefined);
      function Block({ hidden }: { hidden: boolean }) {
        if (hidden) throw never;
        return null;
      }
      function Harness() {
        const [hidden, setHidden] = useState(false);
        return (
          <>
            <button type="button" onClick={() => setHidden(true)}>
              Hide task
            </button>
            <button type="button" onClick={() => setHidden(false)}>
              Show task
            </button>
            <Suspense fallback={<span>Task hidden</span>}>
              <StakeTaskHarness {...overrides} />
              <Block hidden={hidden} />
            </Suspense>
          </>
        );
      }
      const screen = render(<Harness />);
      fireEvent.change(screen.getByLabelText('amount'), {
        target: { value: '2' },
      });
      const approve = await screen.findByRole('button', {
        name: 'global.approve',
      });
      await waitFor(() => expect(approve.hasAttribute('disabled')).toBe(false));
      fireEvent.click(approve);
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
      await submitConfirmation(0, 'approval-tx');
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(2));
      await submitConfirmation(1, 'deposit-tx');
      await waitFor(() => expect(mockAddOrder).toHaveBeenCalledTimes(1));
      fireEvent.click(screen.getByRole('button', { name: 'Hide task' }));
      expect(screen.getByText('Task hidden')).toBeTruthy();
      await act(async () => {
        resolveRecording(
          outcome === 'failed'
            ? { localStatus: 'failed', remoteStatus: 'notAttempted' }
            : { localStatus: 'saved', remoteStatus: 'synced' },
        );
        await pending;
      });
      fireEvent.click(screen.getByRole('button', { name: 'Show task' }));
      const button = await screen.findByRole('button', {
        name: outcome === 'failed' ? 'global.retry' : 'global.done',
      });
      expect(button.hasAttribute('disabled')).toBe(false);
      fireEvent.click(button);
      if (outcome === 'failed')
        await waitFor(() => expect(mockAddOrder).toHaveBeenCalledTimes(2));
      await waitFor(() =>
        expect(
          screen.queryByRole('button', {
            name: outcome === 'failed' ? 'global.retry' : 'global.done',
          }),
        ).toBeNull(),
      );
      expect(mockNavigate).toHaveBeenCalledTimes(2);
      expect(mockTaskSuccess).not.toHaveBeenCalled();
      expect((screen.getByLabelText('amount') as HTMLInputElement).value).toBe(
        outcome === 'succeeded' ? '' : '2',
      );
    },
  );

  it('clears the current task after retrying a late submitted deposit record without navigating', async () => {
    mockWaitStatus.mockResolvedValue(EOnChainHistoryTxStatus.Success);
    mockBuildStake.mockResolvedValue({
      tx: { to: '0xvault', data: '0x' },
      orderId: 'order-1',
    });
    mockAddOrder
      .mockResolvedValueOnce({
        localStatus: 'failed',
        remoteStatus: 'notAttempted',
      })
      .mockResolvedValue({ localStatus: 'saved', remoteStatus: 'synced' });
    const { screen } = await beginDirectApproval(async () => true);
    await submitConfirmation(0, 'approval-tx');
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(2));
    const deposit = mockNavigate.mock.calls[1][0];
    await act(async () => {
      await deposit.onBeforeSend?.();
      deposit.onCancel?.();
    });
    await act(async () =>
      deposit.onSuccess([{ decodedTx: { txid: 'late-deposit-tx' } }]),
    );
    const retry = await screen.findByRole('button', { name: 'global.retry' });
    expect(retry.hasAttribute('disabled')).toBe(false);
    fireEvent.click(retry);
    await waitFor(() => expect(mockAddOrder).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect((screen.getByLabelText('amount') as HTMLInputElement).value).toBe(
        '',
      ),
    );
    expect(mockTaskSuccess).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledTimes(2);
  });

  it('retries deposit validation after a confirmed approval without sending approval again', async () => {
    const receipt = deferred<EOnChainHistoryTxStatus | undefined>();
    mockWaitStatus.mockReturnValue(receipt.promise);
    const { screen } = await beginDirectApproval(async () => true);

    mockCheck
      .mockResolvedValueOnce({
        code: 1,
        message: 'Temporarily unavailable',
        data: { alerts: [] },
      })
      .mockResolvedValue({ code: 0, message: '', data: { alerts: [] } });
    await submitConfirmation(0, 'approval-tx');
    await act(async () => receipt.resolve(EOnChainHistoryTxStatus.Success));

    const retry = await screen.findByRole('button', { name: 'global.retry' });
    expect(retry.hasAttribute('disabled')).toBe(false);
    expect(screen.getByLabelText('amount').hasAttribute('disabled')).toBe(true);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockBuildStake).not.toHaveBeenCalled();

    fireEvent.click(retry);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(2));
    expect(mockNavigate.mock.calls[0][0].approvesInfo[0].amount).toBe('2');
    expect(mockBuildStake).toHaveBeenCalledTimes(1);
  });

  it('keeps deposit blocked through distinct validation failures until a fresh success', async () => {
    const receipt = deferred<EOnChainHistoryTxStatus | undefined>();
    mockWaitStatus.mockReturnValue(receipt.promise);
    const { screen } = await beginDirectApproval(async () => true);
    mockCheck
      .mockResolvedValueOnce({
        code: 1,
        message: 'first error',
        data: { alerts: [] },
      })
      .mockResolvedValueOnce({
        code: 2,
        message: 'second error',
        data: { alerts: [] },
      })
      .mockResolvedValue({ code: 0, message: '', data: { alerts: [] } });
    await submitConfirmation(0, 'approval-tx');
    await act(async () => receipt.resolve(EOnChainHistoryTxStatus.Success));
    const retry = await screen.findByRole('button', { name: 'global.retry' });
    expect(screen.getByText('first error')).toBeTruthy();
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockBuildStake).not.toHaveBeenCalled();

    fireEvent.click(retry);
    await waitFor(() => expect(screen.getByText('second error')).toBeTruthy());
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockBuildStake).not.toHaveBeenCalled();
    expect(retry.hasAttribute('disabled')).toBe(false);

    fireEvent.click(retry);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(2));
    expect(mockBuildStake).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('second error')).toBeNull();
  });

  it.each([false, true])(
    'rechecks the action guard after direct ERC20 approval and continues only when it returns %s',
    async (allowed) => {
      let guardAllows = true;
      const verify = jest.fn(async () => guardAllows);
      const pending = deferred<EOnChainHistoryTxStatus | undefined>();
      mockWaitStatus.mockReturnValue(pending.promise);
      await beginDirectApproval(verify);
      await submitConfirmation(0, 'approval-tx');
      verify.mockClear();
      guardAllows = allowed;
      await act(async () => pending.resolve(EOnChainHistoryTxStatus.Success));
      await waitFor(() => expect(verify).toHaveBeenCalled());
      if (allowed) {
        await waitFor(() => expect(mockBuildStake).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(2));
      } else {
        expect(mockBuildStake).not.toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledTimes(1);
      }
    },
  );

  it('rechecks the guard after a delayed gas warning is confirmed', async () => {
    let allowed = true;
    const verify = jest.fn(async () => allowed);
    const pending = deferred<EOnChainHistoryTxStatus | undefined>();
    mockWaitStatus.mockReturnValue(pending.promise);
    mockEstimate.mockResolvedValue({
      coverFeeSeconds: 6 * 24 * 60 * 60,
      feeFiatValue: '1',
    });
    await beginDirectApproval(verify);
    await submitConfirmation(0, 'approval-tx');
    await act(async () => pending.resolve(EOnChainHistoryTxStatus.Success));
    await waitFor(() => expect(mockGasAlert).toHaveBeenCalled());
    verify.mockClear();
    allowed = false;
    await act(async () =>
      mockGasAlert.mock.calls[0][0].onConfirm({ close: async () => undefined }),
    );
    await waitFor(() => expect(verify).toHaveBeenCalled());
    expect(mockBuildStake).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('does not continue direct approval if the form becomes disabled during the guard recheck', async () => {
    const verify = jest.fn<Promise<boolean>, []>().mockResolvedValue(true);
    const receipt = deferred<EOnChainHistoryTxStatus | undefined>();
    mockWaitStatus.mockReturnValue(receipt.promise);
    const { screen, overrides } = await beginDirectApproval(verify);
    await submitConfirmation(0, 'approval-tx');
    const pendingGuard = deferred<boolean>();
    verify.mockClear().mockReturnValueOnce(pendingGuard.promise);
    await act(async () => receipt.resolve(EOnChainHistoryTxStatus.Success));
    await waitFor(() => expect(verify).toHaveBeenCalledTimes(1));
    screen.rerender(<StakeTaskHarness {...overrides} isDisabled />);
    await act(async () => pendingGuard.resolve(true));
    expect(mockBuildStake).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });
  it('does not start a new approval while the reset transaction is pending', async () => {
    const pending = deferred<EOnChainHistoryTxStatus | undefined>();
    mockWaitStatus.mockReturnValue(pending.promise);
    const screen = await beginReset();
    await submitConfirmation(0, 'reset-tx');
    expect(mockWaitStatus).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(
      screen
        .getByRole('button', { name: 'global.approve' })
        .hasAttribute('disabled'),
    ).toBe(true);
    await act(async () => pending.resolve(undefined));
    const retry = await screen.findByRole('button', { name: 'global.retry' });
    expect(retry.hasAttribute('disabled')).toBe(false);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('only starts the new approval after confirmation and a zero allowance', async () => {
    const pending = deferred<EOnChainHistoryTxStatus | undefined>();
    mockWaitStatus.mockReturnValue(pending.promise);
    await beginReset();
    await submitConfirmation(0, 'reset-tx');
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    mockAllowance.mockResolvedValue({ allowanceParsed: '0' });
    await act(async () => pending.resolve(EOnChainHistoryTxStatus.Success));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(2));
    expect(mockNavigate.mock.calls[1][0].approvesInfo[0].amount).toBe('2');
  });

  it('keeps waiting when the confirmed reset has not yet produced a zero allowance', async () => {
    const pending = deferred<EOnChainHistoryTxStatus | undefined>();
    mockWaitStatus.mockReturnValue(pending.promise);
    await beginReset();
    await submitConfirmation(0, 'reset-tx');
    jest.useFakeTimers();
    try {
      await act(async () => pending.resolve(EOnChainHistoryTxStatus.Success));
      await act(async () => jest.advanceTimersByTimeAsync(2100));
      expect(mockNavigate).toHaveBeenCalledTimes(1);
      mockAllowance.mockResolvedValue({ allowanceParsed: '0' });
      await act(async () => jest.advanceTimersByTimeAsync(2100));
      expect(mockNavigate).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('rechecks the action guard before starting the new approval', async () => {
    let allowed = true;
    const verify = jest.fn(async () => allowed);
    const pending = deferred<EOnChainHistoryTxStatus | undefined>();
    mockWaitStatus.mockReturnValue(pending.promise);
    await beginReset({
      actionGuard: {
        loading: false,
        blocked: false,
        verifyBeforeAction: verify,
      },
    });
    await submitConfirmation(0, 'reset-tx');
    const callsBeforeReceipt = verify.mock.calls.length;
    allowed = false;
    mockAllowance.mockResolvedValue({ allowanceParsed: '0' });
    await act(async () => pending.resolve(EOnChainHistoryTxStatus.Success));
    await waitFor(() =>
      expect(verify.mock.calls.length).toBeGreaterThan(callsBeforeReceipt),
    );
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('does not start another approval if the form becomes disabled', async () => {
    const pending = deferred<EOnChainHistoryTxStatus | undefined>();
    mockWaitStatus.mockReturnValue(pending.promise);
    const screen = await beginReset();
    await submitConfirmation(0, 'reset-tx');
    mockAllowance.mockResolvedValue({ allowanceParsed: '0' });
    screen.rerender(<StakeTaskHarness {...props} isDisabled />);
    await act(async () => pending.resolve(EOnChainHistoryTxStatus.Success));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('does not reopen approval if the form becomes disabled while the account is loading', async () => {
    const pending = deferred<EOnChainHistoryTxStatus | undefined>();
    mockWaitStatus.mockReturnValue(pending.promise);
    const screen = await beginReset();
    await submitConfirmation(0, 'reset-tx');
    const pendingAccount = deferred<{ address: string }>();
    mockAllowance.mockResolvedValue({ allowanceParsed: '0' });
    mockAccount.mockReturnValueOnce(pendingAccount.promise);
    await act(async () => pending.resolve(EOnChainHistoryTxStatus.Success));
    await waitFor(() => expect(mockAccount).toHaveBeenCalledTimes(2));
    screen.rerender(<StakeTaskHarness {...props} isDisabled />);
    await act(async () => pendingAccount.resolve({ address: '0xowner' }));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('does not start another approval if the balance becomes insufficient', async () => {
    const pending = deferred<EOnChainHistoryTxStatus | undefined>();
    mockWaitStatus.mockReturnValue(pending.promise);
    const screen = await beginReset();
    await submitConfirmation(0, 'reset-tx');
    mockAllowance.mockResolvedValue({ allowanceParsed: '0' });
    screen.rerender(<StakeTaskHarness {...props} balance="1" />);
    await act(async () => pending.resolve(EOnChainHistoryTxStatus.Success));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it.each([EOnChainHistoryTxStatus.Failed, undefined])(
    'does not continue when the reset transaction status is %s',
    async (status) => {
      mockWaitStatus.mockResolvedValue(status);
      const screen = await beginReset();
      await submitConfirmation(0, 'reset-tx');
      expect(mockNavigate).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(1));
      expect(mockWaitStatus).toHaveBeenCalledWith(
        expect.objectContaining({ txid: 'reset-tx' }),
      );
      expect(mockBuildStake).not.toHaveBeenCalled();
      if (status === undefined) {
        const retry = await screen.findByRole('button', {
          name: 'global.retry',
        });
        const queriesBeforeRetry = mockWaitStatus.mock.calls.length;
        fireEvent.click(retry);
        await waitFor(() =>
          expect(mockWaitStatus.mock.calls.length).toBeGreaterThan(
            queriesBeforeRetry,
          ),
        );
        await waitFor(() => expect(retry.hasAttribute('disabled')).toBe(false));
        for (const [query] of mockWaitStatus.mock.calls) {
          expect(query).toEqual(expect.objectContaining({ txid: 'reset-tx' }));
        }
        expect(mockNavigate).toHaveBeenCalledTimes(1);
        expect(mockBuildStake).not.toHaveBeenCalled();
      }
    },
  );

  it('does not continue when the reset broadcast has no transaction id', async () => {
    const screen = await beginReset();
    await act(async () => {
      const confirmation = mockNavigate.mock.calls[0][0];
      await confirmation.onBeforeSend?.();
      confirmation.onSuccess([]);
    });
    expect(mockWaitStatus).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const pending = await screen.findByRole('button', {
      name: 'global.pending',
    });
    expect(pending.hasAttribute('disabled')).toBe(true);
  });

  it('locks the amount during confirmation and stops when the account changes', async () => {
    const pending = deferred<EOnChainHistoryTxStatus | undefined>();
    mockWaitStatus.mockReturnValue(pending.promise);
    const screen = await beginReset();
    await submitConfirmation(0, 'reset-tx');
    expect(screen.getByLabelText('amount').hasAttribute('disabled')).toBe(true);
    screen.rerender(<StakeTaskHarness {...props} accountId="other" />);
    mockAllowance.mockResolvedValue({ allowanceParsed: '0' });
    await act(async () => pending.resolve(EOnChainHistoryTxStatus.Success));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it.each(['abandoned', 'committed'] as const)(
    'handles a %s account change while the reset transaction is pending',
    async (change) => {
      const receipt = deferred<EOnChainHistoryTxStatus | undefined>();
      mockWaitStatus.mockReturnValue(receipt.promise);
      const onSuspended = jest.fn();
      const screen = render(
        <ConcurrentStakeHarness onSuspended={onSuspended} />,
      );
      fireEvent.change(screen.getByLabelText('amount'), {
        target: { value: '2' },
      });
      const approve = await screen.findByRole('button', {
        name: 'global.approve',
      });
      await waitFor(() => expect(approve.hasAttribute('disabled')).toBe(false));
      fireEvent.click(approve);
      await waitFor(() => expect(mockDialog).toHaveBeenCalledTimes(1));
      await act(async () =>
        mockDialog.mock.calls[0][0].onConfirm({ close: async () => undefined }),
      );
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
      await submitConfirmation(0, 'reset-tx');
      await waitFor(() => expect(mockWaitStatus).toHaveBeenCalled());

      fireEvent.click(screen.getByText('Suspend other account'));
      expect(onSuspended).toHaveBeenCalled();
      expect(screen.queryByText('Loading account')).toBeNull();
      expect(screen.getByTestId('committed-account').textContent).toBe(
        'account',
      );
      if (change === 'abandoned') {
        fireEvent.click(screen.getByText('Restore account'));
        expect(screen.getByTestId('committed-account').textContent).toBe(
          'account',
        );
      } else {
        fireEvent.click(screen.getByText('Commit other account'));
        expect(screen.getByTestId('committed-account').textContent).toBe(
          'other',
        );
      }

      mockAllowance.mockResolvedValue({ allowanceParsed: '0' });
      await act(async () => receipt.resolve(EOnChainHistoryTxStatus.Success));
      if (change === 'abandoned') {
        await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(2));
        expect(mockNavigate.mock.calls[1][0].approvesInfo[0].amount).toBe('2');
      } else {
        expect(mockNavigate).toHaveBeenCalledTimes(1);
      }
    },
  );

  it('allows a status query while the action guard blocks the next transaction', async () => {
    const nativeToken = {
      ...token,
      symbol: 'ETH',
      address: '',
      isNative: true,
      decimals: 18,
    };
    const wrappedToken = {
      ...token,
      symbol: 'WETH',
      address: EthereumWETH,
      decimals: 18,
    };
    let task = createDepositTask({
      taskId: 'task',
      identity: {
        accountId: 'account',
        accountAddress: '0xowner',
        networkId: 'evm--1',
        provider: 'etherfi',
        vault: '0xvault',
        inputTokenAddress: '',
        depositTokenAddress: EthereumWETH,
        amount: '2',
        spenderAddress: '0xspender',
      },
      steps: [
        { id: 'wrap', kind: 'wrap' },
        { id: 'deposit', kind: 'deposit' },
      ],
    });
    const event = { taskId: 'task', stepId: 'wrap', attemptId: 'attempt' };
    task = reduceDepositTask(task, { ...event, type: 'start' });
    task = reduceDepositTask(task, { ...event, type: 'confirmationOpened' });
    task = reduceDepositTask(task, { ...event, type: 'sendStarted' });
    task = reduceDepositTask(task, { ...event, type: 'submitted', txid: 'tx' });
    task = reduceDepositTask(task, { ...event, type: 'cancel' });
    let notify: ((next: typeof task) => void) | undefined;
    const run = jest.fn().mockResolvedValue(undefined);
    const retryStatus = jest.fn(async () => {
      task = reduceDepositTask(task, { ...event, type: 'retryStatus' });
      task = reduceDepositTask(task, { ...event, type: 'confirmed' });
      task = reduceDepositTask(task, { ...event, type: 'verified' });
      notify?.(task);
    });
    const handle: IDepositTaskHandle = {
      getTask: () => task,
      run,
      retry: jest.fn(),
      retryStatus,
      cancel: jest.fn(),
      dispose: jest.fn(),
    };
    const onConfirm = jest.fn(async (params: IEarnStakeConfirmParams) => {
      notify = params.onDepositTaskChange;
      params.onDepositTaskReady?.(handle);
      notify?.(task);
      return false;
    });
    const verify = jest.fn().mockResolvedValue(true);
    const guardAction = jest.fn();
    const form = (blocked: boolean) => (
      <UniversalStake
        {...props}
        tokenSymbol="ETH"
        tokenInfo={{
          token: nativeToken,
          balanceParsed: '5',
          price: '1',
          accountId: 'account',
          networkId: 'evm--1',
          provider: 'etherfi',
          vault: '0xvault',
        }}
        approveType={undefined}
        approveTarget={{ ...props.approveTarget, token: nativeToken }}
        postWrapApproveTarget={{
          spenderAddress: '0xspender',
          token: wrappedToken,
        }}
        stakeType="wrap"
        onConfirm={onConfirm}
        actionGuard={{
          loading: false,
          blocked,
          verifyBeforeAction: verify,
          ...(blocked
            ? { action: { text: 'revoke', onPress: guardAction } }
            : {}),
        }}
      />
    );
    const screen = render(form(false));
    fireEvent.change(screen.getByLabelText('amount'), {
      target: { value: '2' },
    });
    const start = await screen.findByRole('button', {
      name: 'Limit.native_token_no_sell_wrap',
    });
    await waitFor(() => expect(mockCheck).toHaveBeenCalled());
    await waitFor(() => expect(start.hasAttribute('disabled')).toBe(false));
    fireEvent.click(start);
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    verify.mockClear();
    screen.rerender(form(true));

    const query = await screen.findByRole('button', { name: 'global.retry' });
    fireEvent.click(query);
    await waitFor(() => expect(retryStatus).toHaveBeenCalledTimes(1));
    expect(verify).not.toHaveBeenCalled();
    expect(guardAction).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'revoke' })).toBeTruthy();

    verify.mockResolvedValue(false);
    screen.rerender(form(false));
    fireEvent.click(
      await screen.findByRole('button', { name: 'global.continue' }),
    );
    await waitFor(() => expect(verify).toHaveBeenCalledTimes(1));
    expect(run).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    'retains an uncertain wrap task and only retries status when it has a transaction id: %s',
    async (hasTxid) => {
      const nativeToken = {
        ...token,
        symbol: 'ETH',
        name: 'ETH',
        address: '',
        isNative: true,
        decimals: 18,
      };
      const wrappedToken = {
        ...token,
        symbol: 'WETH',
        name: 'WETH',
        address: EthereumWETH,
        decimals: 18,
      };
      let task = createDepositTask({
        taskId: 'task',
        identity: {
          accountId: 'account',
          accountAddress: '0xowner',
          networkId: 'evm--1',
          provider: 'etherfi',
          vault: '0xvault',
          inputTokenAddress: '',
          depositTokenAddress: EthereumWETH,
          amount: '2',
          spenderAddress: '0xspender',
        },
        steps: [
          { id: 'wrap', kind: 'wrap' },
          { id: 'deposit', kind: 'deposit' },
        ],
      });
      const event = { taskId: 'task', stepId: 'wrap', attemptId: 'attempt' };
      task = reduceDepositTask(task, { ...event, type: 'start' });
      task = reduceDepositTask(task, { ...event, type: 'confirmationOpened' });
      task = reduceDepositTask(task, { ...event, type: 'sendStarted' });
      if (hasTxid)
        task = reduceDepositTask(task, {
          ...event,
          type: 'submitted',
          txid: 'wrap-tx',
        });
      task = reduceDepositTask(task, { ...event, type: 'cancel' });
      const retryStatus = jest.fn().mockResolvedValue(undefined);
      const handle: IDepositTaskHandle = {
        getTask: () => task,
        run: jest.fn(),
        retry: jest.fn(),
        retryStatus,
        cancel: jest.fn(),
        dispose: jest.fn(),
      };
      const onConfirm = jest.fn(
        async ({
          onDepositTaskReady,
          onDepositTaskChange,
        }: IEarnStakeConfirmParams) => {
          onDepositTaskReady?.(handle);
          onDepositTaskChange?.(task);
          return false;
        },
      );
      const screen = render(
        <UniversalStake
          {...props}
          balance="5"
          tokenSymbol="ETH"
          tokenInfo={{
            token: nativeToken,
            balanceParsed: '5',
            price: '1',
            accountId: 'account',
            networkId: 'evm--1',
            provider: 'etherfi',
            vault: '0xvault',
          }}
          approveType={undefined}
          approveTarget={{ ...props.approveTarget, token: nativeToken }}
          postWrapApproveTarget={{
            spenderAddress: '0xspender',
            token: wrappedToken,
          }}
          stakeType="wrap"
          onConfirm={onConfirm}
        />,
      );
      const input = screen.getByLabelText('amount');
      fireEvent.change(input, { target: { value: '2' } });
      const button = await screen.findByRole('button', {
        name: 'Limit.native_token_no_sell_wrap',
      });
      await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false));
      fireEvent.click(button);
      await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
      const taskButton = await screen.findByRole('button', {
        name: hasTxid ? 'global.retry' : 'global.pending',
      });
      expect((input as HTMLInputElement).value).toBe('2');
      expect(input.hasAttribute('disabled')).toBe(true);
      expect(taskButton.hasAttribute('disabled')).toBe(!hasTxid);
      if (hasTxid) {
        fireEvent.click(taskButton);
        expect(retryStatus).toHaveBeenCalledTimes(1);
        expect(onConfirm).toHaveBeenCalledTimes(1);
        await act(async () => {
          task = reduceDepositTask(task, { ...event, type: 'retryStatus' });
          task = reduceDepositTask(task, { ...event, type: 'confirmed' });
          task = reduceDepositTask(task, { ...event, type: 'verified' });
          const depositEvent = {
            taskId: 'task',
            stepId: 'deposit',
            attemptId: 'deposit-attempt',
          };
          task = reduceDepositTask(task, { ...depositEvent, type: 'start' });
          task = reduceDepositTask(task, {
            ...depositEvent,
            type: 'confirmationOpened',
          });
          task = reduceDepositTask(task, {
            ...depositEvent,
            type: 'sendStarted',
          });
          task = reduceDepositTask(task, {
            ...depositEvent,
            type: 'submitted',
            txid: 'deposit-tx',
          });
          task = reduceDepositTask(task, { ...depositEvent, type: 'handoff' });
          task = {
            ...task,
            recording: { txid: 'deposit-tx', status: 'succeeded' },
          };
          onConfirm.mock.calls[0][0].onDepositTaskChange?.(task);
          await onConfirm.mock.calls[0][0].onDepositTaskSettled?.(
            'task',
            'deposit-tx',
          );
        });
        await waitFor(() => expect((input as HTMLInputElement).value).toBe(''));
        expect(input.hasAttribute('disabled')).toBe(false);
        expect(handle.dispose).toHaveBeenCalledTimes(1);
      }
    },
  );

  it.each([
    ['EtherFi submitted', 'etherfi', ['submitted'] as const, '2', 1],
    ['EtherFi unknown', 'etherfi', ['unknown'] as const, '2', 1],
    ['EtherFi failed', 'etherfi', ['submitted', 'failed'] as const, '2', 0],
    ['EtherFi not submitted', 'etherfi', [] as const, '2', 0],
    ['Native submitted', 'native', ['submitted'] as const, '', 1],
    ['Native unknown', 'native', ['unknown'] as const, '', 1],
    ['Native failed', 'native', ['submitted', 'failed'] as const, '2', 0],
    ['Native not submitted', 'native', [] as const, '2', 0],
  ])(
    'handles the interrupted wrap amount when the state is %s',
    async (
      _label,
      providerName,
      states,
      expectedAmount,
      expectedToastCount,
    ) => {
      const nativeToken = {
        ...token,
        symbol: 'ETH',
        name: 'ETH',
        address: '',
        isNative: true,
        decimals: 18,
      };
      const wrappedToken = {
        ...token,
        symbol: 'WETH',
        name: 'WETH',
        address: EthereumWETH,
        decimals: 18,
      };
      const onConfirm = jest.fn(async (params: IEarnStakeConfirmParams) => {
        if (providerName !== 'etherfi') {
          states.forEach((state) => params.onWrapStateChange?.(state));
        } else if (states.length) {
          let task = createDepositTask({
            taskId: 'task',
            identity: {
              accountId: 'account',
              accountAddress: '0xowner',
              networkId: 'evm--1',
              provider: 'etherfi',
              vault: '0xvault',
              inputTokenAddress: '',
              depositTokenAddress: EthereumWETH,
              amount: '2',
              spenderAddress: '0xspender',
            },
            steps: [
              { id: 'wrap', kind: 'wrap' },
              { id: 'approve', kind: 'approve' },
              { id: 'deposit', kind: 'deposit' },
            ],
          });
          const event = {
            taskId: 'task',
            stepId: 'wrap',
            attemptId: 'attempt',
          };
          task = reduceDepositTask(task, { ...event, type: 'start' });
          task = reduceDepositTask(task, {
            ...event,
            type: 'confirmationOpened',
          });
          task = reduceDepositTask(task, { ...event, type: 'sendStarted' });
          if (states[0] === 'submitted') {
            task = reduceDepositTask(task, {
              ...event,
              type: 'submitted',
              txid: 'wrap-tx',
            });
            if (states[1] === 'failed') {
              task = reduceDepositTask(task, { ...event, type: 'chainFailed' });
            } else {
              task = reduceDepositTask(task, { ...event, type: 'confirmed' });
              task = reduceDepositTask(task, { ...event, type: 'verified' });
            }
          } else {
            task = reduceDepositTask(task, { ...event, type: 'cancel' });
          }
          const handle: IDepositTaskHandle = {
            getTask: () => task,
            run: jest.fn(),
            retry: jest.fn(),
            retryStatus: jest.fn(),
            cancel: jest.fn(),
            dispose: jest.fn(),
          };
          params.onDepositTaskReady?.(handle);
          params.onDepositTaskChange?.(task);
          expect(params.onWrapStateChange).toBeUndefined();
          expect(params.onStepChange).toBeUndefined();
        }
        return false;
      });
      const screen = render(
        <UniversalStake
          {...props}
          providerName={providerName}
          preparationPolicy={
            providerName === 'etherfi'
              ? 'confirm-setup-before-deposit'
              : undefined
          }
          balance="5"
          tokenSymbol="ETH"
          tokenInfo={{
            token: nativeToken,
            balanceParsed: '5',
            price: '1',
            accountId: 'account',
            networkId: 'evm--1',
            provider: providerName,
            vault: '0xvault',
          }}
          approveType={undefined}
          approveTarget={{ ...props.approveTarget, token: nativeToken }}
          postWrapApproveTarget={{
            spenderAddress: '0xspender',
            token: wrappedToken,
          }}
          stakeType="wrap"
          onConfirm={onConfirm}
        />,
      );
      const input = screen.getByLabelText('amount');
      fireEvent.change(input, { target: { value: '2' } });
      const button = await screen.findByRole('button', {
        name: 'Limit.native_token_no_sell_wrap',
      });
      await waitFor(() => expect(mockCheck).toHaveBeenCalled(), {
        timeout: 5000,
      });
      await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false));
      fireEvent.click(button);
      await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect((input as HTMLInputElement).value).toBe(expectedAmount),
      );
      expect(mockToast).toHaveBeenCalledTimes(expectedToastCount);
    },
  );
});
