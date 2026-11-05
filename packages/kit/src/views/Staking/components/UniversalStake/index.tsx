import type { PropsWithChildren, ReactElement } from 'react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { Keyboard, StyleSheet } from 'react-native';
import { useDebouncedCallback } from 'use-debounce';

import type { IDialogInstance } from '@onekeyhq/components';
import {
  Accordion,
  Alert,
  Dialog,
  Divider,
  HeightTransition,
  Icon,
  IconButton,
  Image,
  Page,
  Popover,
  SizableText,
  Skeleton,
  Stack,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  ANIMATE_ONLY_OPACITY,
  ANIMATE_ONLY_TRANSFORM,
} from '@onekeyhq/components/src/utils/animationConstants';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IAmountInputFormItemProps } from '@onekeyhq/kit/src/components/AmountInput';
import {
  PercentageStageOnKeyboard,
  calcPercentBalance,
} from '@onekeyhq/kit/src/components/PercentageStageOnKeyboard';
import { useAmountInputFocus } from '@onekeyhq/kit/src/components/PercentageStageOnKeyboard/useAmountInputFocus';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { useBrowserAction } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { useEarnActions } from '@onekeyhq/kit/src/states/jotai/contexts/earn';
import { isAccountIdDeactivatedBotWallet } from '@onekeyhq/kit/src/utils/botWalletAccountUtils';
import { showBotWalletDeactivatedWarningDialog } from '@onekeyhq/kit/src/utils/botWalletWarningDialog';
import { validateAmountInputForStaking } from '@onekeyhq/kit/src/utils/validateAmountInput';
import { waitForTxFinalStatus } from '@onekeyhq/kit/src/utils/waitForTxFinalStatus';
import { EarnAprSuffixText } from '@onekeyhq/kit/src/views/Earn/components/EarnAprSuffixText';
import { ProtocolListContent } from '@onekeyhq/kit/src/views/Earn/components/showProtocolListDialog';
import { getEarnProtocol } from '@onekeyhq/kit/src/views/Earn/protocols';
import {
  getTaskAccountAddress,
  isTaskAccountAddress,
  isTaskAccountCurrent,
} from '@onekeyhq/kit/src/views/Earn/tasks/taskAccount';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { getEarnProviderDisplayName } from '@onekeyhq/shared/types/earn/earnProvider.constants';
import type { IFeeUTXO } from '@onekeyhq/shared/types/fee';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import type {
  ICheckAmountAlert,
  IEarnEstimateFeeResp,
  IEarnPermit2ApproveSignData,
  IEarnSelectField,
  IEarnStakeType,
  IEarnTokenInfo,
  IProtocolInfo,
  IStakeTransactionConfirmation,
} from '@onekeyhq/shared/types/staking';
import {
  EApproveType,
  ECheckAmountActionType,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import { getWrappedTaskInterruption } from '../../earnDepositTask/interruption';
import { createPermitStakeWorkflow } from '../../earnDepositTask/permitStakeWorkflow';
import {
  getPermitStakeWorkflowKey,
  permitStakeWorkflowRegistry,
} from '../../earnDepositTask/permitStakeWorkflowRegistry';
import { queryRetainedTaskStatus } from '../../earnDepositTask/queryRetainedTaskStatus';
import { isRetryableDepositRecordingStatus } from '../../earnDepositTask/state';
import { useDepositTask } from '../../earnDepositTask/useDepositTask';
import { getDepositTaskOwnerKey } from '../../earnDepositTask/useRetainedDepositTask';
import { useCommittedEarnScopeGuard } from '../../hooks/useCommittedEarnScopeGuard';
import { useEarnActionGuard } from '../../hooks/useEarnActionGuard';
import { useEarnPermitApprove } from '../../hooks/useEarnPermitApprove';
import { useEarnSignMessageWithoutVerify } from '../../hooks/useEarnSignMessageWithoutVerify';
import { usePendleLayoutState } from '../../hooks/usePendleLayoutState';
import { useQuoteRefresh } from '../../hooks/useQuoteRefresh';
import { useTrackTokenAllowance } from '../../hooks/useUtilsHooks';
import {
  countDecimalPlaces,
  getStakeTransactionConfirmationAction,
  isInvalidAmount,
  normalizeEarnActionAmountScope,
  resolveStakeSubmissionConfirmation,
  shouldShowStakingSummaryCard,
  validateWrapStake,
} from '../../utils/utils';
import { BtcFeeRateInput } from '../BtcFeeRateInput';
import { CalculationListItem } from '../CalculationList';
import { showEarnRiskWarningDialog } from '../EarnRiskWarningDialog';
import {
  EstimateNetworkFee,
  useShowStakeEstimateGasAlert,
  waitForStakeEstimateGasAlert,
} from '../EstimateNetworkFee';
import {
  type IManagePageV2ReceiveInputConfig,
  ManagePageV2ReceiveInput,
} from '../ManagePageV2ReceiveInput';
import { EarnActionIcon } from '../ProtocolDetails/EarnActionIcon';
import { EarnPlatformBonusSection } from '../ProtocolDetails/EarnPlatformBonusSection';
import { EarnText } from '../ProtocolDetails/EarnText';
import { EarnTooltip } from '../ProtocolDetails/EarnTooltip';
import { EarnValidatorSelect } from '../ProtocolDetails/EarnValidatorSelect';
import {
  PendleAccordionTriggerContent,
  PendleSummarySection,
} from '../ProtocolDetails/PendleSharedComponents';
import { ProtocolImage, formatTvl } from '../ProtocolDisplayShared';
import {
  calcPriceImpactInfo,
  showHighPriceImpactDialog,
} from '../showHighPriceImpactDialog';
import {
  EStakeProgressStep,
  StakeProgress,
  StakeTaskProgress,
} from '../StakeProgress';
import {
  StakingAmountInput,
  useOnBlurAmountValue,
} from '../StakingAmountInput';
import { StakingAmountInputSkeleton } from '../StakingAmountInput/StakingAmountInputSkeleton';
import StakingFormWrapper from '../StakingFormWrapper';
import { TradeOrBuy } from '../TradeOrBuy';
import { formatStakingDistanceToNowStrict } from '../utils';

import type { IDepositTaskState } from '../../earnDepositTask/state';
import type {
  IDirectDepositTaskConfig,
  IEarnStakeConfirmParams,
  IStakeWorkflowHandoff,
} from '../../earnDepositTask/types';
import type { IRetainedDepositTask } from '../../earnDepositTask/useRetainedDepositTask';
import type { IEarnActionGuard } from '../../hooks/useEarnActionGuard';
import type {
  IManagePositionFooterAction,
  IManagePositionProtocolSwitchConfig,
} from '../../pages/ManagePosition/components/ManagePositionContent';
import type { FontSizeTokens } from 'tamagui';

function withRewardUnit(text: string, rewardUnit: string): string {
  return /\s*(APY|APR)\s*$/i.test(text) ? text : `${text} ${rewardUnit}`;
}

function getProtocolAprDisplay({
  protocol,
  fallbackText,
}: {
  protocol?: IManagePositionProtocolSwitchConfig['currentProtocol'];
  fallbackText?: string;
}) {
  const rewardUnit = protocol?.provider.rewardUnit || 'APR';

  if (protocol?.aprInfo?.highlight?.text) {
    return {
      text: withRewardUnit(protocol.aprInfo.highlight.text, rewardUnit),
      color: (protocol.aprInfo.highlight.color || '$textSuccess') as string,
      textDecorationLine: 'none' as const,
    };
  }

  if (protocol?.aprInfo?.normal?.text) {
    return {
      text: withRewardUnit(protocol.aprInfo.normal.text, rewardUnit),
      color: (protocol.aprInfo.normal.color || '$text') as string,
      textDecorationLine: 'none' as const,
    };
  }

  if (protocol?.aprInfo?.deprecated?.text) {
    return {
      text: withRewardUnit(protocol.aprInfo.deprecated.text, rewardUnit),
      color: (protocol.aprInfo.deprecated.color || '$textSubdued') as string,
      textDecorationLine: 'line-through' as const,
    };
  }

  if (protocol) {
    return {
      text: `${protocol.provider.aprWithoutFee || '0'} ${rewardUnit}`,
      color: '$textSuccess',
      textDecorationLine: 'none' as const,
    };
  }

  if (fallbackText) {
    return {
      text: fallbackText,
      color: '$textSuccess',
      textDecorationLine: 'none' as const,
    };
  }

  return undefined;
}

function ProtocolSwitchTriggerRow({
  currentProtocol,
  fallbackProviderName,
  fallbackProviderLogoUri,
  fallbackAprText,
  isLoading,
  isSwitchEnabled,
  canSwitchProtocols,
  onPress,
}: {
  currentProtocol?: IManagePositionProtocolSwitchConfig['currentProtocol'];
  fallbackProviderName?: string;
  fallbackProviderLogoUri?: string;
  fallbackAprText?: string;
  isLoading?: boolean;
  /** Interactive right now — false while a tx is in flight (OK-58029) */
  isSwitchEnabled: boolean;
  /** Switchable in principle. Drives layout only, so a transient lock cannot
      change the rendered shape and remount the icon (OK-59957) */
  canSwitchProtocols: boolean;
  onPress: () => void;
}) {
  const providerName = getEarnProviderDisplayName(
    currentProtocol?.provider.name || fallbackProviderName || '',
  );
  const tvlText = formatTvl(currentProtocol?.provider.tvl);
  // Same layout as the quick-switcher dialog item (OK-58854): bottom-left
  // keeps only vaultName, TVL moves under APY/APR on the right
  const subtitle = currentProtocol?.provider.vaultName || '';
  const aprDisplay = getProtocolAprDisplay({
    protocol: currentProtocol,
    fallbackText: fallbackAprText,
  });
  // Presence follows canSwitchProtocols so locking the switcher mid-tx dims the
  // chevron instead of removing it (its removal reflowed the row) (OK-59957)
  const showChevron = canSwitchProtocols || isLoading;
  let aprElement = null;

  if (aprDisplay) {
    // Strikethrough case (deprecated) keeps the original rendering; the
    // regular case renders value + small APY/APR suffix
    aprElement =
      aprDisplay.textDecorationLine === 'line-through' ? (
        <SizableText
          size="$headingLg"
          color={aprDisplay.color}
          textDecorationLine={aprDisplay.textDecorationLine}
        >
          {aprDisplay.text}
        </SizableText>
      ) : (
        <EarnAprSuffixText
          text={aprDisplay.text}
          size="$headingLg"
          color={aprDisplay.color}
        />
      );
  } else if (isLoading) {
    aprElement = <Skeleton h="$5" w={72} borderRadius="$2" />;
  }

  return (
    <XStack
      testID="earn-protocol-switch-trigger"
      role={isSwitchEnabled ? 'button' : undefined}
      userSelect={isSwitchEnabled ? 'none' : undefined}
      alignItems="center"
      justifyContent="space-between"
      gap="$3"
      px="$3"
      py="$2"
      bg="$bgSubdued"
      borderRadius="$2"
      hoverStyle={isSwitchEnabled ? { bg: '$bgHover' } : undefined}
      pressStyle={isSwitchEnabled ? { bg: '$bgActive' } : undefined}
      onPress={isSwitchEnabled ? onPress : undefined}
    >
      <XStack flex={1} minWidth={0} gap="$3" alignItems="center">
        <ProtocolImage
          logoURI={currentProtocol?.provider.logoURI || fallbackProviderLogoUri}
          networkLogoURI={currentProtocol?.network.logoURI}
        />
        <YStack flex={1} minWidth={0} gap="$0.5">
          {isLoading && !providerName ? (
            <Skeleton h="$5" w={96} borderRadius="$2" />
          ) : (
            <SizableText size="$bodyLgMedium" numberOfLines={1} flex={1}>
              {providerName}
            </SizableText>
          )}
          {subtitle ? (
            <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
              {subtitle}
            </SizableText>
          ) : null}
        </YStack>
      </XStack>
      <XStack alignItems="center" gap="$1" flexShrink={0}>
        <YStack alignItems="flex-end" gap="$0.5">
          {aprElement}
          {tvlText ? (
            <SizableText size="$bodySm" color="$textSubdued">
              {`TVL ${tvlText}`}
            </SizableText>
          ) : null}
        </YStack>
        {showChevron ? (
          <Icon
            name="ChevronGrabberVerSolid"
            color={isSwitchEnabled ? '$iconSubdued' : '$iconDisabled'}
            size="$5"
          />
        ) : null}
      </XStack>
    </XStack>
  );
}

function ProtocolSwitcher({
  tokenSymbol,
  accountId,
  fallbackProviderName,
  fallbackProviderLogoUri,
  fallbackAprText,
  protocolSwitchConfig,
  disabled,
}: {
  tokenSymbol: string;
  accountId: string;
  fallbackProviderName?: string;
  fallbackProviderLogoUri?: string;
  fallbackAprText?: string;
  protocolSwitchConfig: IManagePositionProtocolSwitchConfig;
  // Lock the switcher while an approve/stake is in flight, so the protocol list
  // can't be opened over the in-flight tx confirm dialog (OK-58029).
  disabled?: boolean;
}) {
  const intl = useIntl();
  const {
    currentProtocol,
    indexedAccountId,
    isLoading,
    onProtocolSelect,
    protocols,
    selectedProtocol,
  } = protocolSwitchConfig;
  // Split structural from interactive (OK-59957). canSwitchProtocols decides
  // whether the Popover wrapper exists; disabled only removes interactivity.
  // Deriving the tree shape from `disabled` made pressing the stake button
  // swap <Popover renderTrigger={trigger}/> for a bare <trigger/>, which
  // unmounted and remounted the row — reloading the remote protocol image
  // (the visible flicker) and reflowing it as the chevron vanished.
  const canSwitchProtocols = protocols.length > 1;
  const isSwitchEnabled = canSwitchProtocols && !disabled;
  const renderProtocolListContent = useCallback(
    ({
      closePopover,
      isOpen,
    }: {
      closePopover: () => void;
      isOpen?: boolean;
    }) => (
      <ProtocolListContent
        variant="switcher"
        isOpen={isOpen}
        symbol={tokenSymbol}
        accountId={accountId}
        indexedAccountId={indexedAccountId}
        protocols={protocols}
        isLoading={isLoading}
        selectedProtocol={selectedProtocol}
        onProtocolSelect={async (protocol) => {
          await onProtocolSelect(protocol);
          closePopover();
        }}
      />
    ),
    [
      accountId,
      indexedAccountId,
      isLoading,
      onProtocolSelect,
      protocols,
      selectedProtocol,
      tokenSymbol,
    ],
  );
  // Always-controlled open state (OK-59957). Passing `open` only while locked
  // would flip Popover between controlled and uncontrolled: its internal
  // isOpen would stay true through the lock and the list would pop itself open
  // again when the tx finished.
  const [isProtocolListOpen, setIsProtocolListOpen] = useState(false);
  const handleProtocolListOpenChange = useCallback(
    (nextOpen: boolean) => {
      setIsProtocolListOpen(nextOpen && isSwitchEnabled);
    },
    [isSwitchEnabled],
  );
  useEffect(() => {
    if (!isSwitchEnabled) {
      setIsProtocolListOpen(false);
    }
  }, [isSwitchEnabled]);

  const trigger = (
    <ProtocolSwitchTriggerRow
      currentProtocol={currentProtocol}
      fallbackProviderName={fallbackProviderName}
      fallbackProviderLogoUri={fallbackProviderLogoUri}
      fallbackAprText={fallbackAprText}
      isLoading={isLoading}
      isSwitchEnabled={isSwitchEnabled}
      canSwitchProtocols={canSwitchProtocols}
      onPress={() => {}}
    />
  );

  // Only a genuinely single-protocol asset drops the Popover wrapper — that is
  // stable for the lifetime of the screen, so the trigger is never remounted
  // mid-interaction (OK-59957)
  if (!canSwitchProtocols) {
    return trigger;
  }

  return (
    <Popover
      title={intl.formatMessage({ id: ETranslations.defi_select_protocol })}
      placement="bottom-end"
      // Locked mid-tx (OK-58029) simply stays closed, rather than unmounting
      // the Popover and changing the tree shape (OK-59957)
      open={isProtocolListOpen}
      onOpenChange={handleProtocolListOpenChange}
      renderTrigger={trigger}
      floatingPanelProps={{
        w: 360,
        p: '$0',
      }}
      renderContent={renderProtocolListContent}
    />
  );
}

type IUniversalStakeProps = {
  accountId: string;
  networkId: string;
  balance: string;

  tokenImageUri?: string;
  /**
   * Token metadata still resolving and no image came in via route params —
   * skeleton the icon instead of flashing the placeholder coin (OK-59961)
   */
  tokenImageLoading?: boolean;
  tokenSymbol?: string;
  isStakeAssetLoading?: boolean;

  decimals?: number;

  providerName?: string;
  providerLogo?: string;

  minTransactionFee?: string;
  apr?: string;

  isDisabled?: boolean;

  estimateFeeUTXO?: Required<Pick<IFeeUTXO, 'feeRate'>>[];

  currentAllowance?: string;

  approveType?: EApproveType;
  // Resolves false when the flow never started (risk disclaimer rejected, a
  // pre-flight check failed), so the form keeps the amount the user typed.
  // Deliberately not `boolean | void`: a caller that forgets to return the
  // hook's result would silently reset the form.
  onConfirm?: (
    params: IEarnStakeConfirmParams,
    isActionCurrent?: () => boolean,
  ) => Promise<boolean>;
  onFeeRateChange?: (rate: string) => void;

  tokenInfo?: IEarnTokenInfo;
  protocolInfo?: IProtocolInfo;
  approveTarget: {
    accountId: string;
    networkId: string;
    spenderAddress: string;
    token?: IToken;
  };
  postWrapApproveTarget?: {
    spenderAddress: string;
    token?: IToken;
  };
  beforeFooter?: ReactElement | null;
  actionGuard?: IEarnActionGuard;
  // Setup transactions must settle before deposit is quoted and submitted.
  preparationPolicy?: 'confirm-setup-before-deposit';
  footerActionOverride?: IManagePositionFooterAction;
  protocolSwitchConfig?: IManagePositionProtocolSwitchConfig;
  showApyDetail?: boolean;
  suppressPlatformBonus?: boolean;
  isInModalContext?: boolean;
  showStandaloneKeyboardFooter?: boolean;
  ongoingValidator?: IEarnSelectField;
  receiveInputConfig?: IManagePageV2ReceiveInputConfig;
  transactionInputTokenAddress?: string;
  transactionOutputTokenAddress?: string;
  requestSymbol?: string;
  stakeType?: IEarnStakeType;
  inputTitle?: string;
  tokenSelectorTriggerProps?: Partial<
    NonNullable<IAmountInputFormItemProps['tokenSelectorTriggerProps']>
  >;
  isQuoteExpired?: boolean;
  onQuoteReset?: () => void;
  onTaskRecoveryComplete?: () => void;
  refreshKey?: number;
  onQuoteRefreshingChange?: (loading: boolean) => void;
  pendleSlippage?: number;
  retainedTask?: IRetainedDepositTask | null;
};

export function UniversalStake({
  accountId,
  networkId,
  balance,
  decimals,
  minTransactionFee = '0',
  tokenImageUri,
  tokenImageLoading,
  tokenSymbol,
  isStakeAssetLoading,
  providerName = '',
  providerLogo,
  estimateFeeUTXO,
  isDisabled,
  onConfirm,
  onFeeRateChange,
  protocolInfo,
  tokenInfo,
  approveType,
  approveTarget,
  postWrapApproveTarget,
  currentAllowance,
  beforeFooter,
  actionGuard,
  preparationPolicy: configuredPreparationPolicy,
  footerActionOverride,
  protocolSwitchConfig,
  showApyDetail = false,
  suppressPlatformBonus = false,
  isInModalContext = false,
  showStandaloneKeyboardFooter = false,
  ongoingValidator,
  receiveInputConfig,
  transactionInputTokenAddress,
  transactionOutputTokenAddress,
  requestSymbol,
  stakeType,
  inputTitle,
  tokenSelectorTriggerProps,
  isQuoteExpired,
  onQuoteReset,
  onTaskRecoveryComplete,
  refreshKey,
  onQuoteRefreshingChange,
  pendleSlippage,
  retainedTask,
}: PropsWithChildren<IUniversalStakeProps>) {
  const { isAmountFocused, onAmountFocusChange } = useAmountInputFocus();
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { handleOpenWebSite } = useBrowserAction().current;
  const showEstimateGasAlert = useShowStakeEstimateGasAlert();
  const [editableAmountValue, setAmountValue] = useState('');
  const amountValue = retainedTask?.task.identity.amount ?? editableAmountValue;
  const isRetainedTask = Boolean(retainedTask);
  const transactionConfirmationAmountRef = useRef(amountValue);
  const [approving, setApproving] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const submissionLockRef = useRef(false);
  const recordingFinishLockRef = useRef(false);
  const [selectedValidator, setSelectedValidator] = useState<
    string | undefined
  >(ongoingValidator?.select?.defaultValue);

  // Reset selectedValidator when accountId/networkId changes (manage-page re-fetches)
  useEffect(() => {
    setSelectedValidator(ongoingValidator?.select?.defaultValue);
  }, [ongoingValidator?.select?.defaultValue]);

  const shouldSendProtocolVault = useMemo(
    () => earnUtils.shouldSendEarnProtocolVault({ providerName }),
    [providerName],
  );
  const [
    {
      currencyInfo: { symbol: currencySymbol },
    },
  ] = useSettingsPersistAtom();

  const network = usePromiseResult(
    () =>
      backgroundApiProxy.serviceNetwork.getNetwork({
        networkId,
      }),
    [networkId],
  ).result;
  const networkLogoURI =
    protocolSwitchConfig?.currentProtocol?.network.logoURI ?? network?.logoURI;

  const [estimateFeeResp, setEstimateFeeResp] = useState<
    undefined | IEarnEstimateFeeResp
  >();

  const { getPermitSignature } = useEarnPermitApprove();
  const signPersonalMessage = useEarnSignMessageWithoutVerify();
  const { getPermitCache, updatePermitCache, removePermitCache } =
    useEarnActions().current;

  const earnProtocol = useMemo(
    () => getEarnProtocol(providerName),
    [providerName],
  );
  const stakePresentation = useMemo(
    () => earnProtocol.getStakePresentation(),
    [earnProtocol],
  );
  const stakePlan = earnProtocol.planStake({
    stakeType,
    preparationPolicy: configuredPreparationPolicy,
  });
  const { preparationPolicy, requiresCurrentQuote: requiresCurrentStakeQuote } =
    stakePlan;
  const actionSymbol = useMemo(
    () => requestSymbol || tokenInfo?.token.symbol || tokenSymbol || '',
    [requestSymbol, tokenInfo?.token.symbol, tokenSymbol],
  );
  const approvalScopeKey = JSON.stringify([
    accountId,
    protocolInfo?.earnAccount?.accountAddress,
    networkId,
    providerName,
    protocolInfo?.vault,
    actionSymbol,
    approveTarget.accountId,
    approveTarget.networkId,
    approveTarget.spenderAddress,
    approveTarget.token?.address,
    approveType,
    normalizeEarnActionAmountScope(amountValue),
    transactionInputTokenAddress,
    transactionOutputTokenAddress,
    stakeType,
    selectedValidator,
    pendleSlippage,
  ]);
  const recordingOwnerKey = getDepositTaskOwnerKey({
    accountId,
    accountAddress: protocolInfo?.earnAccount?.accountAddress,
    networkId,
    provider: providerName,
    vault: protocolInfo?.vault,
  });
  const taskAccountAddress =
    protocolInfo?.earnAccount?.accountId === accountId &&
    protocolInfo.earnAccount.networkId === networkId
      ? protocolInfo.earnAccount.accountAddress
      : undefined;
  const {
    task: activeDepositTask,
    getCurrentHandle: getCurrentDepositTaskHandle,
    getRecordingHandle,
    canFinishRestoredRecording,
    getRetainedTaskState,
    onTaskReady: onDepositTaskReady,
    onTaskChange: onDepositTaskChange,
    finishRecordingTask,
    clearTaskBeforeAnySend,
  } = useDepositTask(approvalScopeKey, recordingOwnerKey, retainedTask);
  const approvalScopeGuard = useCommittedEarnScopeGuard(approvalScopeKey);
  const permitWorkflowRef = useRef<
    { scope: string; cancel: () => void } | undefined
  >(undefined);
  useEffect(
    () => () => {
      if (permitWorkflowRef.current?.scope === approvalScopeKey)
        permitWorkflowRef.current.cancel();
    },
    [approvalScopeKey],
  );
  const recordingOwnerGuard = useCommittedEarnScopeGuard(recordingOwnerKey);
  const retainedQueryRef = useRef<AbortController | undefined>(undefined);
  useEffect(
    () => () => {
      retainedQueryRef.current?.abort();
    },
    [recordingOwnerKey],
  );
  const validatorStake = useMemo(() => {
    const selectedOption = ongoingValidator?.select?.options?.find(
      (option) => option.value === selectedValidator,
    );
    return earnProtocol.resolveValidatorStake({
      symbol: actionSymbol,
      selectedValidator,
      isCreateNewValidator:
        selectedOption?.extra?.isCreateNewValidator === true,
    });
  }, [
    earnProtocol,
    actionSymbol,
    selectedValidator,
    ongoingValidator?.select?.options,
  ]);
  const requiresValidatorSignature = validatorStake.mode === 'create';
  const stakefishPermitSignatureRef = useRef<string | undefined>(undefined);
  const stakefishPermitMessageRef = useRef<string | undefined>(undefined);
  const stakefishPermitAddressRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    stakefishPermitSignatureRef.current = undefined;
    stakefishPermitMessageRef.current = undefined;
    stakefishPermitAddressRef.current = undefined;
  }, [
    accountId,
    amountValue,
    actionSymbol,
    networkId,
    taskAccountAddress,
    providerName,
    selectedValidator,
  ]);

  const useApprove = useMemo(() => !!approveType, [approveType]);
  const usePermit2Approve = approveType === EApproveType.Permit;
  const permitSignatureRef = useRef<string | undefined>(undefined);
  const permit2DataRef = useRef<IEarnPermit2ApproveSignData | undefined>(
    undefined,
  );
  const allowanceAbortRef = useRef<AbortController | undefined>(undefined);
  const isFocus = useIsFocused();

  const {
    allowance,
    allowanceAvailable,
    allowanceError,
    loading: loadingAllowance,
    trackAllowance,
    retryAllowance,
    fetchAllowanceResponse,
  } = useTrackTokenAllowance({
    providerName,
    accountId: approveTarget.accountId,
    networkId: approveTarget.networkId,
    tokenAddress: approveTarget.token?.address || '',
    spenderAddress: approveTarget.spenderAddress,
    initialValue: currentAllowance ?? '0',
    retryTrackingOnError: Boolean(preparationPolicy),
    approveType,
  });
  const shouldApproveWhenFocused = useMemo(() => {
    if (!useApprove) {
      return false;
    }

    const amountValueBN = BigNumber(amountValue);
    const allowanceBN = new BigNumber(allowance);

    permitSignatureRef.current = undefined;
    permit2DataRef.current = undefined;
    if (usePermit2Approve) {
      // Check permit cache first
      const permitCache = getPermitCache({
        providerName,
        approveSpenderAddress: earnUtils.resolveEarnAllowanceSpenderAddress({
          providerName,
          networkId: approveTarget.networkId,
          approveType,
          approveSpenderAddress: approveTarget.spenderAddress,
        }),
        accountId: approveTarget.accountId,
        networkId: approveTarget.networkId,
        tokenAddress: approveTarget.token?.address || '',
        amount: amountValue,
      });
      if (
        permitCache?.accountAddress &&
        taskAccountAddress &&
        isTaskAccountAddress(
          { networkId, accountAddress: taskAccountAddress },
          permitCache.accountAddress,
        )
      ) {
        permitSignatureRef.current = permitCache.signature;
        permit2DataRef.current = permitCache.permit2Data;
        return false;
      }
    }

    return !amountValueBN.isNaN() && allowanceBN.lt(amountValue);
  }, [
    useApprove,
    amountValue,
    allowance,
    usePermit2Approve,
    getPermitCache,
    providerName,
    approveType,
    approveTarget.spenderAddress,
    approveTarget.accountId,
    approveTarget.networkId,
    approveTarget.token?.address,
    taskAccountAddress,
    networkId,
  ]);
  const lastFocusedShouldApproveRef = useRef(shouldApproveWhenFocused);
  if (isFocus) {
    lastFocusedShouldApproveRef.current = shouldApproveWhenFocused;
  }
  const shouldApprove = isFocus
    ? shouldApproveWhenFocused
    : useApprove && lastFocusedShouldApproveRef.current;
  const isWrapStake = stakePlan.execution === 'wrappedTask';
  const confirmationAction = getStakeTransactionConfirmationAction({
    stakeType,
    shouldApprove,
    usePermitApprove: usePermit2Approve,
  });
  const isPreparationStep = isWrapStake || confirmationAction === 'approve';
  const isPreparationQuoteDeferred = Boolean(
    preparationPolicy && isPreparationStep,
  );
  const estimateFeeScope = useCommittedEarnScopeGuard(
    JSON.stringify([
      accountId,
      protocolInfo?.earnAccount?.accountAddress,
      networkId,
      providerName,
      protocolInfo?.vault,
      tokenInfo?.token.address,
      actionSymbol,
      transactionInputTokenAddress,
      transactionOutputTokenAddress,
      stakeType,
      approveTarget.spenderAddress,
      approveType,
      amountValue,
      allowance,
      confirmationAction,
      preparationPolicy,
    ]),
  );
  const hideYieldPreview = Boolean(
    preparationPolicy && (isPreparationStep || shouldApprove),
  );

  const [transactionConfirmation, setTransactionConfirmation] = useState<
    IStakeTransactionConfirmation | undefined
  >();
  const validatorIdentity = validatorStake.identity;

  const fetchTransactionConfirmation = useCallback(
    async (
      amount: string,
      depositTokenAddress = transactionInputTokenAddress,
    ) => {
      if (isDisabled) {
        return undefined;
      }
      const resp =
        await backgroundApiProxy.serviceStaking.getTransactionConfirmation({
          networkId,
          provider: providerName,
          symbol: actionSymbol,
          vault: shouldSendProtocolVault ? protocolInfo?.vault || '' : '',
          accountAddress: protocolInfo?.earnAccount?.accountAddress || '',
          action: ECheckAmountActionType.STAKING,
          amount,
          identity: validatorIdentity,
          inputTokenAddress: depositTokenAddress,
          outputTokenAddress: transactionOutputTokenAddress,
          slippage: pendleSlippage,
        });
      return resp;
    },
    [
      isDisabled,
      networkId,
      providerName,
      actionSymbol,
      shouldSendProtocolVault,
      protocolInfo?.vault,
      protocolInfo?.earnAccount?.accountAddress,
      validatorIdentity,
      transactionInputTokenAddress,
      transactionOutputTokenAddress,
      pendleSlippage,
    ],
  );

  const transactionConfirmationScopeRef = useRef({
    fetchConfirmation: fetchTransactionConfirmation,
    isPreparationQuoteDeferred,
    amount: amountValue,
    generation: 0,
  });
  useLayoutEffect(() => {
    transactionConfirmationAmountRef.current = amountValue;
    if (
      transactionConfirmationScopeRef.current.fetchConfirmation !==
        fetchTransactionConfirmation ||
      transactionConfirmationScopeRef.current.isPreparationQuoteDeferred !==
        isPreparationQuoteDeferred ||
      transactionConfirmationScopeRef.current.amount !== amountValue
    ) {
      transactionConfirmationScopeRef.current = {
        fetchConfirmation: fetchTransactionConfirmation,
        isPreparationQuoteDeferred,
        amount: amountValue,
        generation: transactionConfirmationScopeRef.current.generation + 1,
      };
    }
  }, [amountValue, fetchTransactionConfirmation, isPreparationQuoteDeferred]);
  useLayoutEffect(
    () => () => {
      transactionConfirmationScopeRef.current.generation += 1;
    },
    [],
  );
  const transactionConfirmationDataScopeRef = useRef<
    | { fetchConfirmation: typeof fetchTransactionConfirmation; amount: string }
    | undefined
  >(undefined);
  const updateTransactionConfirmation = useCallback(
    (
      response: IStakeTransactionConfirmation | undefined,
      amount = amountValue,
    ) => {
      transactionConfirmationDataScopeRef.current = {
        fetchConfirmation: fetchTransactionConfirmation,
        amount,
      };
      setTransactionConfirmation(response);
    },
    [fetchTransactionConfirmation, amountValue],
  );

  const [transactionConfirmationLoading, setTransactionConfirmationLoading] =
    useState(false);
  // Whether getTransactionConfirmation has settled at least once (success OR
  // failure). The summary placeholder below is restricted to this first-load
  // window: protocols whose response carries no summary would otherwise pulse
  // the skeleton on every amount edit, and a failed first request would leave
  // the skeleton stuck forever.
  const [transactionConfirmationSettled, setTransactionConfirmationSettled] =
    useState(false);

  const debouncedFetchTransactionConfirmation = useDebouncedCallback(
    async (amount?: string) => {
      const fetchConfirmation = fetchTransactionConfirmation;
      const generation = transactionConfirmationScopeRef.current.generation;
      const isCurrentRequest = () =>
        transactionConfirmationAmountRef.current === amount &&
        transactionConfirmationScopeRef.current.generation === generation;
      setTransactionConfirmationLoading(true);
      try {
        const resp = await fetchConfirmation(amount || '0');
        if (!isCurrentRequest()) {
          return;
        }
        updateTransactionConfirmation(resp, amount);
        if (
          resp &&
          amount &&
          Number(amount) > 0 &&
          !isPreparationQuoteDeferred
        ) {
          onQuoteReset?.();
        }
      } catch {
        // keep stale state
      } finally {
        if (isCurrentRequest()) {
          setTransactionConfirmationSettled(true);
          setTransactionConfirmationLoading(false);
        }
      }
    },
    350,
  );

  useEffect(() => {
    // Switching ETH/WETH can keep the same amount, but the old quote describes a different action.
    transactionConfirmationDataScopeRef.current = undefined;
    setTransactionConfirmation(undefined);
    setTransactionConfirmationLoading(false);
    setTransactionConfirmationSettled(false);
  }, [fetchTransactionConfirmation, isPreparationQuoteDeferred]);

  const protocolVault = shouldSendProtocolVault
    ? protocolInfo?.vault || ''
    : undefined;

  const fetchEstimateFeeResp = useCallback(
    async (
      amount?: string,
      action = confirmationAction,
      deposit?: { inputTokenAddress: string; stakeType: IEarnStakeType },
    ) => {
      if (!amount) {
        return undefined;
      }
      const amountNumber = BigNumber(amount);
      if (amountNumber.isZero() || amountNumber.isNaN()) {
        return undefined;
      }

      const needsAllowance = amountNumber.gt(allowance);
      // The estimate endpoint does not accept the signed Permit payload.
      if (usePermit2Approve && needsAllowance) {
        return undefined;
      }
      const permitParams: {
        approveType?: EApproveType.Permit;
      } = usePermit2Approve ? { approveType: EApproveType.Permit } : {};

      const account = await backgroundApiProxy.serviceAccount.getAccount({
        accountId,
        networkId,
      });
      const resp = await backgroundApiProxy.serviceStaking.estimateFee({
        networkId,
        provider: providerName,
        symbol: actionSymbol,
        action,
        amount: amountNumber.toFixed(),
        protocolVault,
        accountAddress: account?.address,
        inputTokenAddress:
          deposit?.inputTokenAddress ?? transactionInputTokenAddress,
        outputTokenAddress: transactionOutputTokenAddress,
        stakeType: deposit?.stakeType ?? stakeType,
        ...permitParams,
      });
      return resp;
    },
    [
      accountId,
      allowance,
      networkId,
      protocolVault,
      providerName,
      confirmationAction,
      actionSymbol,
      transactionInputTokenAddress,
      transactionOutputTokenAddress,
      stakeType,
      usePermit2Approve,
    ],
  );

  const estimateFeeRequestIdRef = useRef(0);
  const debouncedFetchEstimateFeeResp = useDebouncedCallback(
    async (amount?: string) => {
      estimateFeeRequestIdRef.current += 1;
      const requestId = estimateFeeRequestIdRef.current;
      const isCurrentScope = estimateFeeScope.capture();
      if (!isCurrentScope()) return;
      const amountNumber = new BigNumber(amount || '0');
      const allowanceNumber = new BigNumber(allowance);
      if (
        preparationPolicy &&
        confirmationAction === 'approve' &&
        tokenInfo?.token &&
        earnUtils.isUSDTonETHNetwork(tokenInfo.token) &&
        allowanceNumber.isFinite() &&
        allowanceNumber.gt(0) &&
        amountNumber.isFinite() &&
        amountNumber.gt(allowanceNumber)
      ) {
        setEstimateFeeResp(undefined);
        return;
      }
      try {
        const resp = await fetchEstimateFeeResp(amount);
        if (isCurrentScope() && requestId === estimateFeeRequestIdRef.current) {
          setEstimateFeeResp(resp);
        }
      } catch (error) {
        if (!isCurrentScope() || requestId !== estimateFeeRequestIdRef.current)
          return;
        throw error;
      }
    },
    350,
  );

  useLayoutEffect(() => {
    estimateFeeRequestIdRef.current += 1;
    setEstimateFeeResp(undefined);
    debouncedFetchEstimateFeeResp.cancel();
    const amount = new BigNumber(amountValue);
    if (!isRetainedTask && amount.isFinite() && amount.gt(0)) {
      void debouncedFetchEstimateFeeResp(amountValue);
    }
    return () => debouncedFetchEstimateFeeResp.cancel();
  }, [
    estimateFeeScope,
    preparationPolicy,
    amountValue,
    debouncedFetchEstimateFeeResp,
    isRetainedTask,
  ]);

  const checkEstimateGasAlert = useCallback(
    async (
      onNext: () => Promise<void> | undefined,
      action = confirmationAction,
      isCurrent: () => boolean = () => true,
    ) => {
      if (!isCurrent()) return;
      if (usePermit2Approve) {
        return onNext();
      }

      setApproving(true);

      const response = await fetchEstimateFeeResp(amountValue, action);

      if (!isCurrent()) return;
      setApproving(false);
      if (!response) {
        return onNext();
      }
      const daySpent = Number(response?.coverFeeSeconds || 0) / 3600 / 24;

      if (!daySpent || daySpent <= 5) {
        return onNext();
      }

      showEstimateGasAlert({
        daysConsumed: formatStakingDistanceToNowStrict(
          response.coverFeeSeconds,
        ),
        estFiatValue: response.feeFiatValue,
        onConfirm: async (dialogInstance: IDialogInstance) => {
          await dialogInstance.close();
          if (isCurrent()) await onNext();
        },
      });
    },
    [
      usePermit2Approve,
      fetchEstimateFeeResp,
      amountValue,
      showEstimateGasAlert,
      confirmationAction,
    ],
  );

  const wrapStakeLabel = useMemo(
    () =>
      intl.formatMessage(
        { id: ETranslations.Limit_native_token_no_sell_wrap },
        {
          token:
            (preparationPolicy && postWrapApproveTarget?.token?.symbol) ||
            actionSymbol ||
            tokenInfo?.token.symbol ||
            tokenSymbol ||
            '',
        },
      ),
    [
      actionSymbol,
      intl,
      preparationPolicy,
      postWrapApproveTarget?.token?.symbol,
      tokenInfo?.token.symbol,
      tokenSymbol,
    ],
  );

  const fetchPostWrapAllowance = useCallback(async () => {
    if (
      !isWrapStake ||
      !postWrapApproveTarget?.token?.address ||
      !postWrapApproveTarget.spenderAddress
    ) {
      return undefined;
    }

    const allowanceInfo =
      await backgroundApiProxy.serviceStaking.fetchTokenAllowance({
        accountId,
        networkId,
        spenderAddress: postWrapApproveTarget.spenderAddress,
        tokenAddress: postWrapApproveTarget.token.address,
      });

    return allowanceInfo.allowanceParsed;
  }, [
    accountId,
    isWrapStake,
    networkId,
    postWrapApproveTarget?.spenderAddress,
    postWrapApproveTarget?.token?.address,
  ]);

  const getShouldShowPostWrapApproveStep = useCallback(
    (allowanceValue?: string) => {
      if (!isWrapStake) {
        return false;
      }

      const amountBN = new BigNumber(amountValue);
      if (amountBN.isNaN() || amountBN.lte(0)) {
        return false;
      }

      if (
        !postWrapApproveTarget?.token?.address ||
        !postWrapApproveTarget.spenderAddress
      ) {
        return true;
      }

      if (!allowanceValue?.trim()) return true;
      const allowanceBN = new BigNumber(allowanceValue);
      return (
        !allowanceBN.isFinite() ||
        allowanceBN.isNegative() ||
        allowanceBN.lt(amountBN)
      );
    },
    [
      amountValue,
      isWrapStake,
      postWrapApproveTarget?.spenderAddress,
      postWrapApproveTarget?.token?.address,
    ],
  );

  const postWrapAllowanceScope = useMemo(
    () => ({ accountId, networkId, fetchPostWrapAllowance }),
    [accountId, networkId, fetchPostWrapAllowance],
  );
  const { result: postWrapAllowanceResult } = usePromiseResult(
    async () => ({
      scope: postWrapAllowanceScope,
      allowance: await fetchPostWrapAllowance(),
    }),
    [fetchPostWrapAllowance, postWrapAllowanceScope],
    {
      undefinedResultIfReRun: true,
      undefinedResultIfError: true,
      keepResultIfError: true,
    },
  );

  const estimatedShouldShowPostWrapApproveStep = useMemo(
    () =>
      getShouldShowPostWrapApproveStep(
        postWrapAllowanceResult?.scope === postWrapAllowanceScope
          ? postWrapAllowanceResult.allowance
          : undefined,
      ),
    [
      getShouldShowPostWrapApproveStep,
      postWrapAllowanceResult,
      postWrapAllowanceScope,
    ],
  );
  const [
    shouldShowPostWrapApproveStepOverride,
    setShouldShowPostWrapApproveStepOverride,
  ] = useState<boolean | undefined>(undefined);
  const taskApproval = activeDepositTask?.steps.find(
    (step) => step.kind === 'approve',
  );
  const shouldShowPostWrapApproveStep =
    taskApproval?.status.type === 'skipped'
      ? false
      : (shouldShowPostWrapApproveStepOverride ??
        estimatedShouldShowPostWrapApproveStep);

  const stakeProgressStep2LabelId = useMemo(() => {
    if (shouldShowPostWrapApproveStep) {
      return ETranslations.global_approve;
    }
    return stakePresentation.action === 'swap'
      ? ETranslations.global_swap
      : undefined;
  }, [stakePresentation.action, shouldShowPostWrapApproveStep]);

  const stakeProgressStep3LabelId = shouldShowPostWrapApproveStep
    ? ETranslations.earn_deposit
    : undefined;

  useEffect(() => {
    if (isRetainedTask) {
      debouncedFetchEstimateFeeResp.cancel();
      debouncedFetchTransactionConfirmation.cancel();
      setTransactionConfirmation(undefined);
      setTransactionConfirmationLoading(false);
      return;
    }
    const amountValueBN = new BigNumber(amountValue);
    if (
      !isPreparationQuoteDeferred &&
      !isInvalidAmount(amountValue) &&
      amountValueBN.isGreaterThan(0)
    ) {
      void debouncedFetchTransactionConfirmation(amountValue);
    } else {
      debouncedFetchTransactionConfirmation.cancel();
      setTransactionConfirmation(undefined);
      setTransactionConfirmationLoading(false);
    }
    return () => {
      debouncedFetchTransactionConfirmation.cancel();
    };
  }, [
    shouldApprove,
    amountValue,
    debouncedFetchEstimateFeeResp,
    debouncedFetchTransactionConfirmation,
    fetchTransactionConfirmation,
    validatorIdentity,
    isPreparationQuoteDeferred,
    isRetainedTask,
  ]);

  const { quoteRefreshing, handleLocalRefreshQuote } = useQuoteRefresh({
    enabled: stakePresentation.quoteRefresh === 'periodic' && !isRetainedTask,
    refreshKey,
    amountValue,
    fetchTransactionConfirmation,
    setTransactionConfirmation: updateTransactionConfirmation,
    onQuoteReset,
    onQuoteRefreshingChange,
  });

  useEffect(
    () => () => {
      allowanceAbortRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    allowanceAbortRef.current?.abort();
    setApproving(false);
  }, [approvalScopeKey]);

  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId: approveTarget.accountId,
    networkId: approveTarget.networkId,
  });

  const [amountValidation, setAmountValidation] = useState<{
    message: string;
    alerts: ICheckAmountAlert[];
  }>({ message: '', alerts: [] });
  const amountValidationRef = useRef(amountValidation);
  const updateAmountValidation = useCallback(
    (next: { message: string; alerts: ICheckAmountAlert[] }) => {
      amountValidationRef.current = next;
      setAmountValidation(next);
    },
    [],
  );
  const { message: checkAmountMessage, alerts: checkAmountAlerts } =
    amountValidation;
  const [checkAmountLoading, setCheckAmountLoading] = useState(false);
  const checkAmountLoadingRef = useRef(false);
  const updateCheckAmountLoading = useCallback((loading: boolean) => {
    checkAmountLoadingRef.current = loading;
    setCheckAmountLoading(loading);
  }, []);
  const checkAmountRequestIdRef = useRef(0);
  const wrapValidationAttemptRef = useRef(0);

  const quoteLoading = checkAmountLoading || transactionConfirmationLoading;

  const requestCheckAmount = useCallback(
    (
      amount: string,
      identity?: string,
      deposit?: { inputTokenAddress: string; stakeType: IEarnStakeType },
    ) =>
      backgroundApiProxy.serviceStaking.checkAmount({
        accountId,
        networkId,
        symbol: actionSymbol,
        provider: providerName,
        action: identity
          ? ECheckAmountActionType.RESTAKE
          : ECheckAmountActionType.STAKING,
        amount,
        protocolVault,
        withdrawAll: false,
        identity,
        inputTokenAddress:
          deposit?.inputTokenAddress ?? transactionInputTokenAddress,
        outputTokenAddress: transactionOutputTokenAddress,
        slippage: pendleSlippage,
        stakeType: deposit?.stakeType ?? stakeType,
      }),
    [
      accountId,
      networkId,
      actionSymbol,
      providerName,
      protocolVault,
      transactionInputTokenAddress,
      transactionOutputTokenAddress,
      pendleSlippage,
      stakeType,
    ],
  );

  const checkAmount = useDebouncedCallback(
    async ({
      amount,
      identity,
      requestId,
    }: {
      amount: string;
      identity?: string;
      requestId: number;
    }) => {
      if (
        requestId !== checkAmountRequestIdRef.current ||
        isInvalidAmount(amount)
      ) {
        return;
      }
      // An empty form is represented as "0" by the initial effect. Treat it as
      // not entered yet so the disabled CTA does not flash a loading spinner.
      if (new BigNumber(amount).isLessThanOrEqualTo(0)) {
        return;
      }
      updateCheckAmountLoading(true);
      try {
        const response = await requestCheckAmount(amount, identity);
        if (requestId !== checkAmountRequestIdRef.current) {
          return;
        }

        if (Number(response.code) === 0) {
          updateAmountValidation({
            message: '',
            alerts: response.data?.alerts || [],
          });
        } else {
          updateAmountValidation({ message: response.message, alerts: [] });
        }
      } catch (error) {
        if (!preparationPolicy || !isWrapStake) throw error;
        if (requestId === checkAmountRequestIdRef.current) {
          errorToastUtils.toastIfError(error);
          errorToastUtils.showToastOfError(error);
        }
      } finally {
        if (requestId === checkAmountRequestIdRef.current) {
          updateCheckAmountLoading(false);
        }
      }
    },
    300,
  );

  useEffect(() => {
    checkAmount.cancel();
    checkAmountRequestIdRef.current += 1;
    const requestId = checkAmountRequestIdRef.current;
    const amount = amountValue || '0';
    const cleanup = () => {
      checkAmount.cancel();
      if (requestId === checkAmountRequestIdRef.current) {
        checkAmountRequestIdRef.current += 1;
      }
    };

    if (isRetainedTask) {
      updateAmountValidation({ message: '', alerts: [] });
      updateCheckAmountLoading(false);
      return cleanup;
    }

    if (isInvalidAmount(amount)) {
      updateCheckAmountLoading(false);
      return cleanup;
    }

    if (new BigNumber(amount).isLessThanOrEqualTo(0)) {
      updateAmountValidation({ message: '', alerts: [] });
      updateCheckAmountLoading(false);
      return cleanup;
    }

    void checkAmount({ amount, identity: validatorIdentity, requestId });
    return cleanup;
  }, [
    checkAmount,
    validatorIdentity,
    amountValue,
    updateAmountValidation,
    updateCheckAmountLoading,
    isRetainedTask,
  ]);

  const onChangeAmountValue = useCallback(
    (value: string) => {
      if (
        submitting ||
        submissionLockRef.current ||
        activeDepositTask ||
        getCurrentDepositTaskHandle()
      )
        return;
      if (!validateAmountInputForStaking(value, decimals)) {
        return;
      }
      estimateFeeRequestIdRef.current += 1;
      const valueBN = new BigNumber(value);
      if (valueBN.isNaN()) {
        if (value === '') {
          setAmountValue('');
          updateAmountValidation({ message: '', alerts: [] });
          void debouncedFetchEstimateFeeResp();
        }
        return;
      }
      const isOverflowDecimals = Boolean(
        decimals &&
        Number(decimals) > 0 &&
        countDecimalPlaces(value) > decimals,
      );
      if (!isOverflowDecimals) {
        setAmountValue(value);
        void debouncedFetchEstimateFeeResp(value);
      }
    },
    [
      decimals,
      debouncedFetchEstimateFeeResp,
      submitting,
      updateAmountValidation,
      getCurrentDepositTaskHandle,
      activeDepositTask,
    ],
  );

  const onBlurAmountValue = useOnBlurAmountValue(amountValue, setAmountValue);
  const [stakeProgressStep, setStakeProgressStep] = useState(
    EStakeProgressStep.approve,
  );
  const handleStakeProgressChange = useCallback(
    (step: number, options?: { shouldShowPostWrapApproveStep?: boolean }) => {
      if (options?.shouldShowPostWrapApproveStep !== undefined) {
        setShouldShowPostWrapApproveStepOverride(
          options.shouldShowPostWrapApproveStep,
        );
      }
      setStakeProgressStep(step);
    },
    [],
  );

  useEffect(() => {
    setShouldShowPostWrapApproveStepOverride(undefined);
    setStakeProgressStep(EStakeProgressStep.approve);
  }, [
    accountId,
    amountValue,
    networkId,
    postWrapApproveTarget?.spenderAddress,
    postWrapApproveTarget?.token?.address,
    stakeType,
  ]);

  const maxAmountValue = useMemo(() => {
    const balanceBN = new BigNumber(balance);
    if (balanceBN.isNaN()) {
      return balance;
    }

    const maxAmountBN = tokenInfo?.token?.isNative
      ? BigNumber.max(0, balanceBN.minus(minTransactionFee))
      : balanceBN;

    return typeof decimals === 'number'
      ? maxAmountBN.decimalPlaces(decimals, BigNumber.ROUND_DOWN).toFixed()
      : maxAmountBN.toFixed();
  }, [balance, decimals, minTransactionFee, tokenInfo?.token?.isNative]);

  const reserveGasFormatter: INumberFormatProps = useMemo(
    () => ({
      formatter: 'balance',
      formatterOptions: {
        tokenSymbol: tokenSymbol || tokenInfo?.token.symbol,
      },
    }),
    [tokenInfo?.token.symbol, tokenSymbol],
  );

  const showNativeTokenMaxToast = useCallback(() => {
    if (!tokenInfo?.token?.isNative) {
      return;
    }

    const reserveFeeBN = new BigNumber(minTransactionFee || 0);
    const reserveFeeFormatted =
      reserveFeeBN.gt(0) && !reserveFeeBN.isNaN()
        ? numberFormat(reserveFeeBN.toFixed(), reserveGasFormatter)
        : undefined;

    const message = intl.formatMessage(
      {
        id: reserveFeeFormatted
          ? ETranslations.swap_native_token_max_tip_already
          : ETranslations.swap_native_token_max_tip,
      },
      {
        num_token: reserveFeeFormatted,
      },
    );

    Toast.message({
      title: message,
    });
  }, [
    intl,
    minTransactionFee,
    reserveGasFormatter,
    tokenInfo?.token?.isNative,
  ]);

  const onMax = useCallback(() => {
    showNativeTokenMaxToast();
    onChangeAmountValue(maxAmountValue);
  }, [maxAmountValue, onChangeAmountValue, showNativeTokenMaxToast]);

  const onSelectPercentageStage = useCallback(
    (percent: number) => {
      if (percent === 100) {
        onMax();
        return;
      }
      onChangeAmountValue(
        calcPercentBalance({
          balance,
          percent,
          decimals,
        }),
      );
    },
    [balance, decimals, onChangeAmountValue, onMax],
  );

  const currentValue = useMemo<string | undefined>(() => {
    if (Number(amountValue) > 0 && Number(tokenInfo?.price) > 0) {
      const amountValueBn = new BigNumber(amountValue);
      return amountValueBn.multipliedBy(tokenInfo?.price ?? '0').toFixed();
    }
    return undefined;
  }, [amountValue, tokenInfo?.price]);

  const isInsufficientBalance = useMemo<boolean>(
    () => new BigNumber(amountValue).gt(balance),
    [amountValue, balance],
  );

  const isStakingCapFull = useMemo(() => {
    if (!protocolInfo?.remainingCap) {
      return false;
    }
    const remainingCapBN = new BigNumber(protocolInfo.remainingCap);
    return !remainingCapBN.isNaN() && remainingCapBN.isEqualTo(0);
  }, [protocolInfo?.remainingCap]);

  const isCheckAmountMessageError =
    amountValue?.length > 0 && !!checkAmountMessage;

  const amountInputDisabled = useMemo(() => {
    return (
      isDisabled || isStakingCapFull || submitting || Boolean(activeDepositTask)
    );
  }, [activeDepositTask, isDisabled, isStakingCapFull, submitting]);

  const isDisable = useMemo(() => {
    const amountValueBN = BigNumber(amountValue);
    return (
      amountValueBN.isNaN() ||
      amountValueBN.isLessThanOrEqualTo(0) ||
      isInsufficientBalance ||
      isCheckAmountMessageError ||
      checkAmountAlerts.length > 0 ||
      isStakingCapFull ||
      checkAmountLoading
    );
  }, [
    amountValue,
    isCheckAmountMessageError,
    checkAmountAlerts.length,
    isInsufficientBalance,
    isStakingCapFull,
    checkAmountLoading,
  ]);

  const daysSpent = useMemo(() => {
    if (estimateFeeResp?.coverFeeSeconds) {
      return formatStakingDistanceToNowStrict(estimateFeeResp.coverFeeSeconds);
    }
  }, [estimateFeeResp?.coverFeeSeconds]);

  const resetActionStateRef = useRef({
    actionGuard,
    footerActionOverride,
    isDisabled,
    isStakeAssetLoading,
    isInvalid: isDisable,
    isInvalidWithoutValidation: false,
    isInvalidAfterWrapWithoutValidation: false,
  });
  const resetActionState = useMemo(
    () => ({
      actionGuard,
      footerActionOverride,
      isDisabled,
      isStakeAssetLoading,
      isInvalid: isDisable,
      isInvalidWithoutValidation:
        !new BigNumber(amountValue).isFinite() ||
        new BigNumber(amountValue).lte(0) ||
        isInsufficientBalance ||
        isStakingCapFull,
      isInvalidAfterWrapWithoutValidation:
        !new BigNumber(amountValue).isFinite() ||
        new BigNumber(amountValue).lte(0) ||
        isStakingCapFull,
    }),
    [
      actionGuard,
      footerActionOverride,
      isDisabled,
      isStakeAssetLoading,
      isDisable,
      amountValue,
      isInsufficientBalance,
      isStakingCapFull,
    ],
  );
  useLayoutEffect(() => {
    resetActionStateRef.current = resetActionState;
  }, [resetActionState]);
  const verifyPreparedAction = useCallback(async (isCurrent: () => boolean) => {
    const actionState = resetActionStateRef.current;
    if (
      !isCurrent() ||
      actionState.isDisabled ||
      actionState.isStakeAssetLoading ||
      actionState.isInvalid ||
      actionState.footerActionOverride ||
      actionState.actionGuard?.action ||
      (actionState.actionGuard?.isActionAllowed
        ? !actionState.actionGuard.isActionAllowed()
        : actionState.actionGuard?.blocked)
    ) {
      return false;
    }
    const verify = actionState.actionGuard?.verifyBeforeAction;
    if (verify && !(await verify())) return false;
    const current = resetActionStateRef.current;
    return Boolean(
      isCurrent() &&
      !current.isDisabled &&
      !current.isStakeAssetLoading &&
      !current.isInvalid &&
      !current.footerActionOverride &&
      !current.actionGuard?.action &&
      (current.actionGuard?.isActionAllowed
        ? current.actionGuard.isActionAllowed()
        : !current.actionGuard?.blocked) &&
      current.actionGuard?.verifyBeforeAction === verify,
    );
  }, []);

  const canSendDepositTask = useCallback(
    (
      isCurrent: () => boolean,
      step: 'wrap' | 'resetApproval' | 'approve' | 'deposit',
    ) => {
      const state = resetActionStateRef.current;
      return Boolean(
        isCurrent() &&
        !state.isDisabled &&
        !state.isStakeAssetLoading &&
        !checkAmountLoadingRef.current &&
        (isWrapStake && step !== 'wrap'
          ? !state.isInvalidAfterWrapWithoutValidation
          : !state.isInvalidWithoutValidation) &&
        !amountValidationRef.current.message &&
        amountValidationRef.current.alerts.length === 0 &&
        !state.footerActionOverride &&
        !state.actionGuard?.action &&
        (state.actionGuard?.isActionAllowed
          ? state.actionGuard.isActionAllowed()
          : !state.actionGuard?.blocked),
      );
    },
    [isWrapStake],
  );

  const verifyDepositTaskSend = useCallback(
    async (
      isCurrent: () => boolean,
      step: 'wrap' | 'resetApproval' | 'approve' | 'deposit',
    ) => {
      if (!canSendDepositTask(isCurrent, step)) return false;
      const verify =
        resetActionStateRef.current.actionGuard?.verifyBeforeAction;
      if (verify && !(await verify({ allowRevoke: false }))) return false;
      return Boolean(
        canSendDepositTask(isCurrent, step) &&
        resetActionStateRef.current.actionGuard?.verifyBeforeAction === verify,
      );
    },
    [canSendDepositTask],
  );

  const prepareDepositTask = useCallback(
    async (
      signal: AbortSignal,
      isCurrent: () => boolean,
      inputTokenAddress: string,
    ): ReturnType<IDirectDepositTaskConfig['prepareDeposit']> => {
      const deposit = { inputTokenAddress, stakeType: 'normal' as const };
      if (signal.aborted || !isCurrent()) return { type: 'cancelled' };
      checkAmount.cancel();
      checkAmountRequestIdRef.current += 1;
      updateCheckAmountLoading(false);
      const validation = await requestCheckAmount(
        amountValue,
        undefined,
        deposit,
      );
      if (signal.aborted || !isCurrent()) return { type: 'cancelled' };
      const alerts = validation.data?.alerts || [];
      const valid = String(validation.code) === '0';
      if (!valid || alerts.length > 0) {
        updateAmountValidation({
          message: valid
            ? ''
            : validation.message ||
              intl.formatMessage({
                id: ETranslations.global_an_error_occurred,
              }),
          alerts,
        });
        return { type: 'cancelled' };
      }
      updateAmountValidation({ message: '', alerts: [] });
      const confirmation = await fetchTransactionConfirmation(
        amountValue,
        deposit.inputTokenAddress,
      );
      if (signal.aborted || !isCurrent()) return { type: 'cancelled' };
      const deactivated = await isAccountIdDeactivatedBotWallet({
        accountId,
      });
      if (signal.aborted || !isCurrent()) return { type: 'cancelled' };
      if (deactivated) {
        const accepted = await showBotWalletDeactivatedWarningDialog(signal);
        if (!accepted || signal.aborted || !isCurrent())
          return { type: 'cancelled' };
      }
      const fee = await fetchEstimateFeeResp(
        amountValue,
        ECheckAmountActionType.STAKING,
        deposit,
      );
      if (signal.aborted || !isCurrent()) return { type: 'cancelled' };
      estimateFeeRequestIdRef.current += 1;
      debouncedFetchEstimateFeeResp.cancel();
      setEstimateFeeResp(fee);
      const daySpent = Number(fee?.coverFeeSeconds || 0) / 3600 / 24;
      if (fee && daySpent > 5) {
        const accepted = await waitForStakeEstimateGasAlert({
          showAlert: showEstimateGasAlert,
          daysConsumed: formatStakingDistanceToNowStrict(fee.coverFeeSeconds),
          estFiatValue: fee.feeFiatValue,
          signal,
        });
        if (!accepted || signal.aborted || !isCurrent())
          return { type: 'cancelled' };
      }
      if (
        signal.aborted ||
        !(await verifyDepositTaskSend(isCurrent, 'deposit'))
      ) {
        return { type: 'cancelled' };
      }
      return {
        type: 'confirm',
        effectiveApy: confirmation?.effectiveApy,
      };
    },
    [
      amountValue,
      requestCheckAmount,
      intl,
      fetchTransactionConfirmation,
      accountId,
      fetchEstimateFeeResp,
      debouncedFetchEstimateFeeResp,
      showEstimateGasAlert,
      verifyDepositTaskSend,
      checkAmount,
      updateCheckAmountLoading,
      updateAmountValidation,
    ],
  );

  const onApproveRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const onSubmit = useCallback(
    async (
      freshFee?: IEarnEstimateFeeResp,
      isApprovalCurrent?: () => boolean,
      signedPermit?: {
        signature: string;
        unsignedMessage?: IEarnPermit2ApproveSignData;
      },
      workflowHandoff?: IStakeWorkflowHandoff,
    ) => {
      const isCurrent = isApprovalCurrent ?? approvalScopeGuard.capture();
      if (!isCurrent()) return;
      if (usePermit2Approve && !workflowHandoff) {
        try {
          const address = await getTaskAccountAddress({
            accountId: approveTarget.accountId,
            networkId: approveTarget.networkId,
          });
          if (!isCurrent()) return;
          if (
            taskAccountAddress &&
            !isTaskAccountAddress(
              { networkId, accountAddress: taskAccountAddress },
              address,
            )
          )
            throw new OneKeyLocalError('Task account changed before stake');
          const ownerKey = getPermitStakeWorkflowKey({
            networkId: approveTarget.networkId,
            accountAddress: address,
            provider: providerName,
            vault: protocolVault,
          });
          if (
            permitStakeWorkflowRegistry.find(ownerKey, approveTarget.accountId)
          ) {
            if (preparationPolicy)
              Toast.message({
                title: intl.formatMessage({ id: ETranslations.global_pending }),
              });
            else await onApproveRef.current?.();
            return;
          }
        } catch (error) {
          if (isCurrent()) {
            errorToastUtils.toastIfError(error);
            errorToastUtils.showToastOfError(error);
          }
          return;
        }
      }
      Keyboard.dismiss();

      if (preparationPolicy && isWrapStake) {
        wrapValidationAttemptRef.current += 1;
        const attempt = wrapValidationAttemptRef.current;
        try {
          const validation = await validateWrapStake({
            check: () => requestCheckAmount(amountValue, validatorIdentity),
            isCurrent: () =>
              isCurrent() && attempt === wrapValidationAttemptRef.current,
          });
          if (validation.status === 'stale') return;
          if (validation.status === 'invalid') {
            updateAmountValidation({
              message:
                validation.message ||
                (validation.alerts.length
                  ? ''
                  : intl.formatMessage({
                      id: ETranslations.global_an_error_occurred,
                    })),
              alerts: validation.alerts,
            });
            return;
          }
        } catch (error) {
          if (isCurrent() && attempt === wrapValidationAttemptRef.current) {
            errorToastUtils.toastIfError(error);
            errorToastUtils.showToastOfError(error);
          }
          return;
        }
      }

      let depositConfirmation = transactionConfirmation;
      if (preparationPolicy || requiresCurrentStakeQuote) {
        try {
          depositConfirmation = await resolveStakeSubmissionConfirmation({
            deferredSetupQuote: Boolean(preparationPolicy),
            isWrapStake,
            requiresCurrentQuote: requiresCurrentStakeQuote,
            shouldApprove,
            confirmation: transactionConfirmation,
            isCurrentConfirmation:
              transactionConfirmationDataScopeRef.current?.fetchConfirmation ===
                fetchTransactionConfirmation &&
              transactionConfirmationDataScopeRef.current?.amount ===
                amountValue,
            fetchConfirmation: () => fetchTransactionConfirmation(amountValue),
          });
        } catch (error) {
          if (isCurrent()) {
            errorToastUtils.toastIfError(error);
            errorToastUtils.showToastOfError(error);
          }
          return;
        }
      }
      if (!isCurrent()) return;
      // A successful empty preview is valid for legacy protocols; only request failures block submission.
      // Bot Wallet deactivated warning
      const isDeactivatedBot = await isAccountIdDeactivatedBotWallet({
        accountId,
      });
      if (!isCurrent()) return;
      if (isDeactivatedBot) {
        const confirmed = await showBotWalletDeactivatedWarningDialog();
        if (!confirmed || !isCurrent()) {
          return;
        }
      }

      // OK-59196: Stakefish signs a provider-facing message before any hook runs,
      // so the disclaimer has to gate this pre-transaction step. Not a duplicate
      // of the gate inside useUniversalStake — that one only covers the transaction
      // itself, and once accepted this call resolves immediately. Only create-new
      // validator stakes sign, so a top up never reaches this dialog.
      if (requiresValidatorSignature && !stakefishPermitSignatureRef.current) {
        const riskAcceptedBeforeSigning = await showEarnRiskWarningDialog({
          provider: providerName,
          symbol: actionSymbol,
          networkId,
          title: intl.formatMessage({ id: ETranslations.global_warning }),
        });
        if (!riskAcceptedBeforeSigning || !isCurrent()) {
          return;
        }
      }

      // A permit explicitly obtained for this action remains bound to it even
      // if allowance has changed since the last render.
      // Stakefish only attaches it for a new validator; a top up must stay
      // signature-free so the Earn API routes it by publicKey.
      let finalPermitSignature: string | undefined;
      let finalMessage: string | undefined;
      let finalUnsignedMessage: IEarnPermit2ApproveSignData | undefined;
      if (
        usePermit2Approve &&
        (signedPermit || new BigNumber(amountValue).gt(allowance))
      ) {
        finalPermitSignature =
          signedPermit?.signature ?? permitSignatureRef.current;
        finalUnsignedMessage =
          signedPermit?.unsignedMessage ?? permit2DataRef.current;
      } else if (requiresValidatorSignature) {
        finalPermitSignature = stakefishPermitSignatureRef.current;
        finalMessage = stakefishPermitMessageRef.current;
      }

      const permitSignatureParams = finalPermitSignature
        ? {
            approveType: usePermit2Approve ? approveType : undefined,
            permitSignature: finalPermitSignature,
            unsignedMessage: finalUnsignedMessage,
            message: finalMessage,
          }
        : undefined;

      const validatorParams =
        validatorStake.mode === 'existing' && selectedValidator
          ? { validatorPubkey: selectedValidator }
          : undefined;

      const resetAmount = () => {
        setAmountValue('');
        updateAmountValidation({ message: '', alerts: [] });
        // Reset stakefish permit signature and message
        stakefishPermitSignatureRef.current = undefined;
        stakefishPermitMessageRef.current = undefined;
        stakefishPermitAddressRef.current = undefined;
      };
      const confirmationFee =
        usePermit2Approve && new BigNumber(amountValue).gt(allowance)
          ? freshFee
          : (freshFee ?? estimateFeeResp);
      const handleConfirm = async () => {
        if (!isCurrent() || submissionLockRef.current) return;
        submissionLockRef.current = true;
        setSubmitting(true);
        let taskSettled = false;
        const canRecoverDepositRecording = recordingOwnerGuard.isCurrent;
        const handleInterruptedWrap = () => {
          if (!isWrapStake || !isCurrent()) return;
          const interruption = getWrappedTaskInterruption(
            getCurrentDepositTaskHandle()?.getTask(),
          );
          if (interruption !== 'submitted' && interruption !== 'unknown')
            return;
          if (!getCurrentDepositTaskHandle()) resetAmount();
          Toast.message({
            title: intl.formatMessage({
              id:
                interruption === 'submitted'
                  ? ETranslations.feedback_transaction_submitted
                  : ETranslations.global_unknown,
            }),
            message: postWrapApproveTarget?.token?.symbol
              ? `${intl.formatMessage({ id: ETranslations.global_wallet_balance })}: ${postWrapApproveTarget.token.symbol}`
              : intl.formatMessage({ id: ETranslations.global_wallet_balance }),
          });
        };
        try {
          if (
            preparationPolicy &&
            isApprovalCurrent &&
            !(await verifyPreparedAction(isCurrent))
          ) {
            return;
          }
          const started = await onConfirm?.(
            {
              amount: amountValue,
              effectiveApy: depositConfirmation?.effectiveApy,
              stakeType,
              taskMode: isWrapStake ? 'deposit' : undefined,
              taskAccountAddress:
                workflowHandoff?.accountAddress ?? taskAccountAddress,
              isSendCurrent: recordingOwnerGuard.capture(),
              workflowHandoff,
              workflowSpenderAddress: workflowHandoff
                ? approveTarget.spenderAddress
                : undefined,
              stakefishSignTask: requiresValidatorSignature
                ? {
                    isResultCurrent: recordingOwnerGuard.capture(),
                    sign: async (accountAddress) => {
                      if (
                        stakefishPermitSignatureRef.current &&
                        stakefishPermitMessageRef.current &&
                        stakefishPermitAddressRef.current &&
                        isTaskAccountAddress(
                          {
                            networkId,
                            accountAddress: stakefishPermitAddressRef.current,
                          },
                          accountAddress,
                        )
                      )
                        return {
                          signature: stakefishPermitSignatureRef.current,
                          message: stakefishPermitMessageRef.current,
                        };
                      setApproving(true);
                      try {
                        const signed = await signPersonalMessage({
                          networkId,
                          accountId,
                          provider: providerName,
                          symbol: actionSymbol,
                          amount: new BigNumber(amountValue).toFixed(),
                          action: 'stake',
                          expectedAccountAddress: accountAddress,
                        });
                        if (!isCurrent())
                          throw new OneKeyLocalError(
                            'Stakefish action expired',
                          );
                        stakefishPermitSignatureRef.current = signed.signature;
                        stakefishPermitMessageRef.current = signed.message;
                        stakefishPermitAddressRef.current = accountAddress;
                        return signed;
                      } catch (error) {
                        if (isCurrent())
                          console.error('Stakefish permit sign error:', error);
                        return undefined;
                      } finally {
                        if (isCurrent()) setApproving(false);
                      }
                    },
                    beforeDeposit: async (signal) => {
                      let fee = confirmationFee;
                      if (
                        !fee ||
                        Number(fee.coverFeeSeconds || 0) / 3600 / 24 <= 5
                      ) {
                        setApproving(true);
                        try {
                          fee = await fetchEstimateFeeResp(
                            amountValue,
                            ECheckAmountActionType.STAKING,
                          );
                        } finally {
                          if (isCurrent()) setApproving(false);
                        }
                      }
                      if (signal.aborted || !isCurrent()) return false;
                      const days =
                        Number(fee?.coverFeeSeconds || 0) / 3600 / 24;
                      if (fee && days > 5)
                        return waitForStakeEstimateGasAlert({
                          showAlert: showEstimateGasAlert,
                          daysConsumed: formatStakingDistanceToNowStrict(
                            fee.coverFeeSeconds,
                          ),
                          estFiatValue: fee.feeFiatValue,
                          signal,
                        });
                      return true;
                    },
                  }
                : undefined,
              beforeDepositTaskSend: isWrapStake
                ? (step) => verifyDepositTaskSend(isCurrent, step)
                : undefined,
              prepareWrappedDeposit:
                preparationPolicy && isWrapStake && postWrapApproveTarget?.token
                  ? (signal) =>
                      prepareDepositTask(
                        signal,
                        isCurrent,
                        postWrapApproveTarget.token?.address ?? '',
                      )
                  : undefined,
              canSendDepositTask: isWrapStake
                ? (step) => canSendDepositTask(isCurrent, step)
                : undefined,
              onDepositTaskReady: isWrapStake ? onDepositTaskReady : undefined,
              onDepositTaskChange: isWrapStake
                ? onDepositTaskChange
                : undefined,
              canRecoverDepositRecording: isWrapStake
                ? canRecoverDepositRecording
                : undefined,
              onDepositTaskSettled: isWrapStake
                ? async (taskId, txid) => {
                    if (
                      !canRecoverDepositRecording() ||
                      !isCurrent() ||
                      !(await finishRecordingTask(taskId, txid, isCurrent)) ||
                      !canRecoverDepositRecording()
                    )
                      return;
                    taskSettled = true;
                    if (isCurrent()) {
                      resetAmount();
                      onQuoteReset?.();
                    }
                  }
                : undefined,
              onStepChange: isWrapStake ? undefined : handleStakeProgressChange,
              ...permitSignatureParams,
              ...validatorParams,
            },
            isCurrent,
          );
          if (started === false) {
            if (!clearTaskBeforeAnySend()) handleInterruptedWrap();
            return;
          }
          if (!isCurrent()) return;
          if (!taskSettled && !isWrapStake) {
            resetAmount();
            // Auto-refresh quote countdown after swap completes
            onQuoteReset?.();
          }
        } catch (error) {
          if (!clearTaskBeforeAnySend()) handleInterruptedWrap();
          if (!isCurrent()) return;
          // Closing the fee dialog settles its promise before transaction building finishes.
          errorToastUtils.toastIfError(error);
          errorToastUtils.showToastOfError(error);
        } finally {
          submissionLockRef.current = false;
          setSubmitting(false);
        }
      };

      if (stakePresentation.priceImpact === 'confirm') {
        const payFiatValue =
          Number(amountValue) > 0 && Number(tokenInfo?.price) > 0
            ? new BigNumber(amountValue)
                .multipliedBy(tokenInfo?.price ?? '0')
                .toFixed()
            : undefined;
        const impactInfo = calcPriceImpactInfo({
          payFiatValue,
          receiveConfig: receiveInputConfig,
          receiveDescription: depositConfirmation?.receive,
        });
        if (impactInfo) {
          const userConfirmed = await showHighPriceImpactDialog(intl, {
            percent: impactInfo.percent,
            lossAmount: `${currencySymbol}${impactInfo.lossAmount}`,
          });
          if (!userConfirmed || !isCurrent()) return;
        }
      }

      if (requiresValidatorSignature) {
        await handleConfirm();
        return;
      }
      if (confirmationFee) {
        const daySpent =
          Number(confirmationFee.coverFeeSeconds || 0) / 3600 / 24;

        if (daySpent && daySpent > 5) {
          if (workflowHandoff) {
            const accepted = await waitForStakeEstimateGasAlert({
              showAlert: showEstimateGasAlert,
              daysConsumed: formatStakingDistanceToNowStrict(
                confirmationFee.coverFeeSeconds,
              ),
              estFiatValue: confirmationFee.feeFiatValue,
              signal: workflowHandoff.signal,
            });
            if (accepted && isCurrent()) await handleConfirm();
            return;
          }
          showEstimateGasAlert({
            daysConsumed: formatStakingDistanceToNowStrict(
              confirmationFee.coverFeeSeconds,
            ),
            estFiatValue: confirmationFee.feeFiatValue,
            onConfirm: async (dialogInstance: IDialogInstance) => {
              await dialogInstance.close();
              await handleConfirm();
            },
          });
          return;
        }
      }

      if (!usePermit2Approve || (usePermit2Approve && !shouldApprove)) {
        await checkEstimateGasAlert(
          handleConfirm,
          ECheckAmountActionType.STAKING,
          isCurrent,
        );
        return;
      }

      await handleConfirm();
    },
    [
      usePermit2Approve,
      approvalScopeGuard,
      approveType,
      allowance,
      estimateFeeResp,
      shouldApprove,
      onConfirm,
      approveTarget.accountId,
      approveTarget.networkId,
      approveTarget.spenderAddress,
      amountValue,
      showEstimateGasAlert,
      checkEstimateGasAlert,
      fetchEstimateFeeResp,
      stakePresentation.priceImpact,
      validatorStake.mode,
      requiresCurrentStakeQuote,
      selectedValidator,
      requiresValidatorSignature,
      signPersonalMessage,
      networkId,
      accountId,
      taskAccountAddress,
      actionSymbol,
      providerName,
      protocolVault,
      onQuoteReset,
      intl,
      currencySymbol,
      tokenInfo?.price,
      receiveInputConfig,
      transactionConfirmation,
      fetchTransactionConfirmation,
      preparationPolicy,
      requestCheckAmount,
      validatorIdentity,
      stakeType,
      isWrapStake,
      postWrapApproveTarget?.token,
      handleStakeProgressChange,
      onDepositTaskReady,
      onDepositTaskChange,
      clearTaskBeforeAnySend,
      finishRecordingTask,
      recordingOwnerGuard,
      getCurrentDepositTaskHandle,
      verifyPreparedAction,
      verifyDepositTaskSend,
      canSendDepositTask,
      prepareDepositTask,
      updateAmountValidation,
    ],
  );

  const startDirectDepositTask = useCallback(
    async (resumeTaskState?: IDepositTaskState) => {
      const isCurrent = approvalScopeGuard.capture();
      const canRecoverDepositRecording = recordingOwnerGuard.isCurrent;
      const token = approveTarget.token;
      if (
        !isCurrent() ||
        submissionLockRef.current ||
        !onConfirm ||
        !token ||
        token.isNative ||
        !token.address ||
        !approveTarget.spenderAddress ||
        approveTarget.accountId !== accountId ||
        approveTarget.networkId !== networkId ||
        transactionInputTokenAddress?.toLowerCase() !==
          token.address.toLowerCase()
      ) {
        return;
      }
      Keyboard.dismiss();
      submissionLockRef.current = true;
      setSubmitting(true);
      try {
        const started = await onConfirm(
          {
            amount: amountValue,
            stakeType: 'normal',
            taskMode: 'deposit',
            taskAccountAddress,
            resumeTaskState,
            beforeDepositTaskSend: (step) =>
              verifyDepositTaskSend(isCurrent, step),
            canSendDepositTask: (step) => canSendDepositTask(isCurrent, step),
            onDepositTaskReady,
            onDepositTaskChange,
            canRecoverDepositRecording,
            onDepositTaskSettled: async (taskId, txid) => {
              if (
                !canRecoverDepositRecording() ||
                !isCurrent() ||
                !(await finishRecordingTask(taskId, txid, isCurrent)) ||
                !canRecoverDepositRecording()
              )
                return;
              if (isCurrent()) {
                setAmountValue('');
                updateAmountValidation({ message: '', alerts: [] });
                onQuoteReset?.();
              }
            },
            directDepositTask: {
              token,
              spenderAddress: approveTarget.spenderAddress,
              requiresAllowanceReset: earnUtils.isUSDTonETHNetwork({
                networkId,
                symbol: token.symbol,
              }),
              allowanceVerificationMode: preparationPolicy
                ? undefined
                : 'legacy',
              confirmReset: (signal) =>
                new Promise<boolean>((resolve, reject) => {
                  if (signal.aborted || !isCurrent()) {
                    resolve(false);
                    return;
                  }
                  let settled = false;
                  let confirming = false;
                  const dialogRef: {
                    current?: ReturnType<typeof Dialog.show>;
                  } = {};
                  function finish(confirmed: boolean) {
                    if (settled) return;
                    settled = true;
                    signal.removeEventListener('abort', abort);
                    resolve(confirmed);
                  }
                  function abort() {
                    finish(false);
                    if (dialogRef.current && !confirming) {
                      void Promise.resolve()
                        .then(() => dialogRef.current?.close())
                        .catch(errorToastUtils.showToastOfError);
                    }
                  }
                  signal.addEventListener('abort', abort, { once: true });
                  try {
                    dialogRef.current = Dialog.show({
                      onConfirmText: intl.formatMessage({
                        id: ETranslations.global_continue,
                      }),
                      showExitButton: false,
                      dismissOnOverlayPress: false,
                      onCancel: () => finish(false),
                      onClose: () => {
                        if (!confirming) finish(false);
                      },
                      onConfirm: async (instance) => {
                        confirming = true;
                        try {
                          await instance.close();
                          finish(!signal.aborted && isCurrent());
                        } catch (error) {
                          if (!settled) {
                            settled = true;
                            signal.removeEventListener('abort', abort);
                            reject(error);
                          }
                        }
                      },
                      title: intl.formatMessage({
                        id: ETranslations.swap_page_provider_approve_usdt_dialog_title,
                      }),
                      description: intl.formatMessage({
                        id: ETranslations.swap_page_provider_approve_usdt_dialog_content,
                      }),
                      icon: 'ErrorOutline',
                    });
                    if (signal.aborted) abort();
                  } catch (error) {
                    signal.removeEventListener('abort', abort);
                    reject(error);
                  }
                }),
              prepareDeposit: (signal) =>
                prepareDepositTask(signal, isCurrent, token.address),
            },
          },
          isCurrent,
        );
        if (!started) clearTaskBeforeAnySend();
      } catch (error) {
        clearTaskBeforeAnySend();
        if (isCurrent()) {
          errorToastUtils.toastIfError(error);
          errorToastUtils.showToastOfError(error);
        }
      } finally {
        submissionLockRef.current = false;
        setSubmitting(false);
      }
    },
    [
      approvalScopeGuard,
      approveTarget,
      onConfirm,
      accountId,
      taskAccountAddress,
      networkId,
      transactionInputTokenAddress,
      amountValue,
      verifyDepositTaskSend,
      canSendDepositTask,
      onDepositTaskReady,
      onDepositTaskChange,
      finishRecordingTask,
      recordingOwnerGuard,
      onQuoteReset,
      intl,
      prepareDepositTask,
      clearTaskBeforeAnySend,
      preparationPolicy,
      updateAmountValidation,
    ],
  );

  const resumeRetainedDepositTask = useCallback(async () => {
    const state = getRetainedTaskState();
    if (
      !state ||
      !retainedTask ||
      state !== retainedTask.state ||
      submissionLockRef.current
    )
      return;
    const current = state.getTask();
    const currentStep = current.steps[current.currentStepIndex];
    if (
      currentStep?.status.type === 'unknown' ||
      currentStep?.status.type === 'confirming' ||
      currentStep?.status.type === 'verifying'
    ) {
      const controller = new AbortController();
      retainedQueryRef.current = controller;
      const isOwnerCurrent = recordingOwnerGuard.capture();
      submissionLockRef.current = true;
      setSubmitting(true);
      try {
        await queryRetainedTaskStatus({
          state,
          signal: controller.signal,
          isCurrent: () => isOwnerCurrent() && getRetainedTaskState() === state,
        });
      } catch (error) {
        if (isOwnerCurrent()) errorToastUtils.showToastOfError(error);
      } finally {
        if (retainedQueryRef.current === controller)
          retainedQueryRef.current = undefined;
        submissionLockRef.current = false;
        setSubmitting(false);
      }
      return;
    }
    if (!onConfirm) return;
    if (!current.steps.some((step) => step.kind === 'wrap')) {
      await startDirectDepositTask(state);
      return;
    }
    const wrappedToken = postWrapApproveTarget?.token;
    const isCurrent = approvalScopeGuard.capture();
    if (
      !isCurrent() ||
      !isWrapStake ||
      !wrappedToken ||
      submissionLockRef.current
    )
      return;
    submissionLockRef.current = true;
    setSubmitting(true);
    try {
      await onConfirm(
        {
          amount: current.identity.amount,
          stakeType: 'wrap',
          taskMode: 'deposit',
          taskAccountAddress,
          resumeTaskState: state,
          beforeDepositTaskSend: (step) =>
            verifyDepositTaskSend(isCurrent, step),
          canSendDepositTask: (step) => canSendDepositTask(isCurrent, step),
          prepareWrappedDeposit: preparationPolicy
            ? (signal) =>
                prepareDepositTask(signal, isCurrent, wrappedToken.address)
            : undefined,
          onDepositTaskReady,
          onDepositTaskChange,
          canRecoverDepositRecording: recordingOwnerGuard.isCurrent,
          onDepositTaskSettled: async (taskId, txid) => {
            if (
              isCurrent() &&
              (await finishRecordingTask(taskId, txid, isCurrent)) &&
              recordingOwnerGuard.isCurrent()
            ) {
              setAmountValue('');
              updateAmountValidation({ message: '', alerts: [] });
              onQuoteReset?.();
              onTaskRecoveryComplete?.();
            }
          },
        },
        isCurrent,
      );
    } catch (error) {
      if (isCurrent()) {
        errorToastUtils.toastIfError(error);
        errorToastUtils.showToastOfError(error);
      }
    } finally {
      submissionLockRef.current = false;
      setSubmitting(false);
    }
  }, [
    getRetainedTaskState,
    retainedTask,
    onConfirm,
    startDirectDepositTask,
    postWrapApproveTarget,
    approvalScopeGuard,
    isWrapStake,
    taskAccountAddress,
    verifyDepositTaskSend,
    canSendDepositTask,
    prepareDepositTask,
    preparationPolicy,
    onDepositTaskReady,
    onDepositTaskChange,
    recordingOwnerGuard,
    finishRecordingTask,
    updateAmountValidation,
    onQuoteReset,
    onTaskRecoveryComplete,
  ]);

  const showStakeProgressRef = useRef<Record<string, boolean>>({});

  // Holds the latest onApprove so the USDT reset flow (defined before onApprove)
  // can re-enter the approve step once the allowance has been reset to 0.
  const permitAttemptRef = useRef<symbol | undefined>(undefined);
  useLayoutEffect(() => {
    permitAttemptRef.current = undefined;
  }, [approvalScopeKey]);
  // Whitelist flag for the deliberate USDT-reset re-entry (OK-58027): that
  // flow re-enters onApprove while approving === true, so the reentry guard
  // must let it through (review P0). A ref (not a param) keeps onApprove
  // zero-arg — it is passed directly to the footer button's onPress, where a
  // press event would otherwise land in the options slot.
  const usdtResetReentryRef = useRef(false);

  const resetUSDTApproveValue = useCallback(
    async (isCurrent: () => boolean) => {
      if (!isCurrent()) return;
      const account = await backgroundApiProxy.serviceAccount.getAccount({
        accountId: approveTarget.accountId,
        networkId: approveTarget.networkId,
      });
      if (!isCurrent()) return;
      const approveResetInfo: IApproveInfo = {
        owner: account.address,
        spender: approveTarget.spenderAddress,
        amount: '0',
        isMax: false,
        tokenInfo: {
          ...tokenInfo?.token,
          address: tokenInfo?.token.address ?? '',
          symbol: tokenInfo?.token.symbol ?? '',
          decimals: tokenInfo?.token.decimals ?? 0,
          isNative: !!tokenInfo?.token.isNative,
          name: tokenInfo?.token.name ?? (tokenInfo?.token.symbol || ''),
        },
      };
      const approvesInfo = [approveResetInfo];
      await navigationToTxConfirm({
        approvesInfo,
        isNavigationCurrent: isCurrent,
        onSuccess(data) {
          if (!isCurrent()) return;
          // Poll for allowance updates until it becomes 0
          const pollAllowanceUntilZero = () => {
            let attempts = 0;
            const maxAttempts = 10; // Prevent infinite polling
            const pollInterval = 3000; // 3 seconds between polls

            async function checkAllowance() {
              try {
                if (!isCurrent()) return;
                // Fetch latest allowance
                const allowanceInfo = await fetchAllowanceResponse();
                if (!isCurrent()) return;

                if (allowanceInfo) {
                  // Allowance is now 0: the USDT reset landed on-chain. Re-enter
                  // the approve step to continue the flow (approve the new amount
                  // then submit the stake). onApprove re-reads the allowance, sees
                  // 0, and skips the reset branch — no loop. Without this the flow
                  // dead-ended right after the reset tx, so the stake never fired
                  // (OK-58027). Keep approving=true; onApprove owns the state from
                  // here — but observe rejections: onApprove awaits getAccount /
                  // navigationToTxConfirm outside any try/catch, and a swallowed
                  // reject would leave the confirm button stuck loading+disabled.
                  if (BigNumber(allowanceInfo.allowanceParsed).isZero()) {
                    if (preparationPolicy) {
                      if (!(await verifyPreparedAction(isCurrent))) {
                        if (isCurrent()) setApproving(false);
                        return;
                      }
                    }
                    // Bypass the approving-reentry guard: this deliberate
                    // re-entry runs with approving === true (OK-58027)
                    usdtResetReentryRef.current = true;
                    void onApproveRef.current?.().catch((e) => {
                      console.error(
                        'Re-enter approve after USDT reset failed:',
                        e,
                      );
                      if (isCurrent()) setApproving(false);
                    });
                    return;
                  }
                }

                attempts += 1;

                if (attempts < maxAttempts) {
                  scheduleCheck();
                } else {
                  if (isCurrent()) setApproving(false);
                }
              } catch (error) {
                console.error('Error polling for allowance:', error);
                if (isCurrent()) setApproving(false);
              }
            }
            function scheduleCheck() {
              setTimeout(() => {
                void checkAllowance();
              }, pollInterval);
            }
            scheduleCheck();
          };

          if (!preparationPolicy) {
            pollAllowanceUntilZero();
            return;
          }

          const txid =
            data[0]?.signedTx?.txid?.trim() || data[0]?.decodedTx?.txid?.trim();
          if (!txid) {
            Toast.message({
              title: intl.formatMessage({ id: ETranslations.global_pending }),
            });
            return;
          }
          allowanceAbortRef.current?.abort();
          const controller = new AbortController();
          allowanceAbortRef.current = controller;
          void (async () => {
            try {
              const status = await waitForTxFinalStatus({
                accountId: approveTarget.accountId,
                networkId: approveTarget.networkId,
                txid,
                signal: controller.signal,
              });
              if (!isCurrent() || controller.signal.aborted) return;
              if (status === EOnChainHistoryTxStatus.Success) {
                pollAllowanceUntilZero();
                return;
              }
              const failed = status === EOnChainHistoryTxStatus.Failed;
              const notify = failed ? Toast.error : Toast.message;
              notify({
                title: intl.formatMessage({
                  id: failed
                    ? ETranslations.global_failed
                    : ETranslations.global_pending,
                }),
              });
              if (failed) setApproving(false);
            } catch {
              if (isCurrent() && !controller.signal.aborted) {
                Toast.message({
                  title: intl.formatMessage({
                    id: ETranslations.global_pending,
                  }),
                });
              }
            }
          })();
        },
        onFail() {
          if (isCurrent()) setApproving(false);
        },
        onCancel() {
          if (isCurrent()) setApproving(false);
        },
      });
    },
    [
      approveTarget.accountId,
      approveTarget.networkId,
      approveTarget.spenderAddress,
      fetchAllowanceResponse,
      navigationToTxConfirm,
      preparationPolicy,
      verifyPreparedAction,
      intl,
      tokenInfo?.token,
    ],
  );

  const showResetUSDTApproveValueDialog = useCallback(
    (isCurrent: () => boolean) => {
      Dialog.show({
        onConfirmText: intl.formatMessage({
          id: ETranslations.global_continue,
        }),
        showExitButton: false,
        dismissOnOverlayPress: false,
        onCancel: () => {
          if (isCurrent()) setApproving(false);
        },
        onConfirm: () => {
          void resetUSDTApproveValue(isCurrent).catch((error: unknown) => {
            if (isCurrent()) {
              errorToastUtils.toastIfError(error);
              errorToastUtils.showToastOfError(error);
              setApproving(false);
            }
          });
        },
        title: intl.formatMessage({
          id: ETranslations.swap_page_provider_approve_usdt_dialog_title,
        }),
        description: intl.formatMessage({
          id: ETranslations.swap_page_provider_approve_usdt_dialog_content,
        }),
        icon: 'ErrorOutline',
      });
    },
    [intl, resetUSDTApproveValue],
  );

  const waitForAllowanceAfterApprove = useCallback(
    async ({
      requiredAmount,
      maxAttempts = 15,
      intervalMs = 2000,
      signal,
    }: {
      requiredAmount: string;
      maxAttempts?: number;
      intervalMs?: number;
      signal?: AbortSignal;
    }) => {
      if (
        !useApprove ||
        usePermit2Approve ||
        tokenInfo?.token?.isNative ||
        !requiredAmount
      ) {
        return true;
      }

      const requiredAmountBN = new BigNumber(requiredAmount);
      if (requiredAmountBN.isNaN() || requiredAmountBN.lte(0)) {
        return true;
      }

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (signal?.aborted) {
          return false;
        }
        try {
          const allowanceInfo = await fetchAllowanceResponse();
          const allowanceBN = new BigNumber(
            allowanceInfo.allowanceParsed || '0',
          );
          if (!allowanceBN.isNaN() && allowanceBN.gte(requiredAmountBN)) {
            return true;
          }
        } catch (error) {
          defaultLogger.staking.page.permitSignError({
            error: error instanceof Error ? error.message : String(error),
          });
        }

        if (attempt < maxAttempts - 1) {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, intervalMs);
          });
        }
      }

      return false;
    },
    [
      useApprove,
      usePermit2Approve,
      tokenInfo?.token?.isNative,
      fetchAllowanceResponse,
    ],
  );

  const onApprove = useCallback(async () => {
    if (usePermit2Approve && permitAttemptRef.current) return;
    const permitAttempt = usePermit2Approve
      ? Symbol('permit-attempt')
      : undefined;
    if (permitAttempt) permitAttemptRef.current = permitAttempt;
    try {
      Keyboard.dismiss();
      const isCurrent = approvalScopeGuard.capture();
      // Take the approving lock synchronously BEFORE any await (review P1):
      // the confirm button's loading derives from `approving`, so awaiting
      // first would leave a double-tap window as wide as one bg IPC roundtrip.
      // The USDT reset flow (OK-58027) re-enters deliberately with
      // approving === true, so it is whitelisted via usdtResetReentryRef —
      // blocking it would dead-end the flow with the button stuck loading
      // (review P0)
      const isUsdtResetReentry = usdtResetReentryRef.current;
      usdtResetReentryRef.current = false;
      if (approving && !isUsdtResetReentry) {
        return;
      }
      setApproving(true);
      // OK-59196: the approve step is the user's first on-chain action in the
      // two-step flow and bypasses useUniversalStake, so the one-time risk
      // disclaimer must gate here too (once accepted it resolves immediately)
      const riskConfirmed = await showEarnRiskWarningDialog({
        provider: providerName,
        symbol: actionSymbol,
        networkId: approveTarget.networkId,
        title: intl.formatMessage({ id: ETranslations.global_warning }),
      });
      if (!isCurrent()) return;
      if (!riskConfirmed) {
        setApproving(false);
        return;
      }
      let approveAllowance = allowance;
      try {
        const allowanceInfo = await fetchAllowanceResponse();
        approveAllowance = allowanceInfo.allowanceParsed;
      } catch (e) {
        if (preparationPolicy && isCurrent()) {
          errorToastUtils.toastIfError(e);
          errorToastUtils.showToastOfError(e);
          setApproving(false);
          return;
        }
        console.error(e);
      }
      if (!isCurrent()) return;
      permitSignatureRef.current = undefined;
      permit2DataRef.current = undefined;
      showStakeProgressRef.current[amountValue] = true;

      const allowanceBN = BigNumber(approveAllowance);
      const amountBN = BigNumber(amountValue);

      if (
        preparationPolicy &&
        (!allowanceBN.isFinite() || allowanceBN.isNegative())
      ) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.global_an_error_occurred,
          }),
        });
        setApproving(false);
        return;
      }

      if (tokenInfo?.token && earnUtils.isUSDTonETHNetwork(tokenInfo?.token)) {
        if (allowanceBN.gt(0) && amountBN.gt(allowanceBN)) {
          showResetUSDTApproveValueDialog(isCurrent);
          return;
        }
      }

      if (preparationPolicy && usePermit2Approve && amountBN.lte(allowanceBN)) {
        setApproving(false);
        await onSubmit(undefined, isCurrent);
        return;
      }

      if (preparationPolicy && amountBN.lte(allowanceBN)) {
        retryAllowance();
        setApproving(false);
        return;
      }

      if (usePermit2Approve) {
        const handlePermit2Approve = async () => {
          try {
            const frozenAddress = await getTaskAccountAddress({
              accountId: approveTarget.accountId,
              networkId: approveTarget.networkId,
            });
            if (!isCurrent()) return;
            if (
              !frozenAddress ||
              (taskAccountAddress &&
                !isTaskAccountAddress(
                  { networkId, accountAddress: taskAccountAddress },
                  frozenAddress,
                ))
            ) {
              throw new OneKeyLocalError('Task account changed before Permit');
            }
            const permitOwnerKey = getPermitStakeWorkflowKey({
              networkId: approveTarget.networkId,
              accountAddress: frozenAddress,
              provider: providerName,
              vault: protocolVault,
            });
            const existing = permitStakeWorkflowRegistry.find(
              permitOwnerKey,
              approveTarget.accountId,
            );
            if (existing) {
              let recoveryStatus: 'pending' | 'confirmed' | 'failed' =
                'pending';
              const task =
                existing.kind === 'owned'
                  ? existing.controller.getTask()
                  : undefined;
              const step = task?.steps[task.currentStepIndex];
              if (
                existing.kind === 'owned' &&
                step?.kind === 'deposit' &&
                step.status.type === 'unknown' &&
                step.status.txid &&
                !step.status.txidConflict &&
                step.attemptId
              ) {
                const lease = permitStakeWorkflowRegistry.acquireRecovery(
                  permitOwnerKey,
                  approveTarget.accountId,
                  existing.token,
                );
                if (lease) {
                  try {
                    const status = await waitForTxFinalStatus({
                      accountId: approveTarget.accountId,
                      networkId: approveTarget.networkId,
                      txid: step.status.txid,
                      expectedAccountAddress: frozenAddress,
                    });
                    if (
                      isCurrent() &&
                      (await isTaskAccountCurrent({
                        accountId: approveTarget.accountId,
                        networkId: approveTarget.networkId,
                        accountAddress: frozenAddress,
                      })) &&
                      isCurrent() &&
                      (status === EOnChainHistoryTxStatus.Success ||
                        status === EOnChainHistoryTxStatus.Failed) &&
                      existing.controller.recordRecovery({
                        stepId: step.id,
                        attemptId: step.attemptId,
                        txid: step.status.txid,
                        status:
                          status === EOnChainHistoryTxStatus.Success
                            ? 'confirmed'
                            : 'failed',
                      })
                    ) {
                      const released = permitStakeWorkflowRegistry.release(
                        permitOwnerKey,
                        approveTarget.accountId,
                        existing.token,
                      );
                      if (released)
                        recoveryStatus =
                          status === EOnChainHistoryTxStatus.Success
                            ? 'confirmed'
                            : 'failed';
                    }
                  } finally {
                    permitStakeWorkflowRegistry.releaseRecovery(
                      permitOwnerKey,
                      approveTarget.accountId,
                      existing.token,
                      lease,
                    );
                  }
                }
              }
              if (isCurrent()) {
                let message = ETranslations.global_pending;
                if (recoveryStatus === 'confirmed')
                  message = ETranslations.global_done;
                else if (recoveryStatus === 'failed')
                  message = ETranslations.global_failed;
                Toast.message({
                  title: intl.formatMessage({ id: message }),
                });
                setApproving(false);
              }
              return;
            }
            const cacheKey = {
              providerName,
              approveSpenderAddress:
                earnUtils.resolveEarnAllowanceSpenderAddress({
                  providerName,
                  networkId: approveTarget.networkId,
                  approveType,
                  approveSpenderAddress: approveTarget.spenderAddress,
                }),
              accountId: approveTarget.accountId,
              networkId: approveTarget.networkId,
              tokenAddress: tokenInfo?.token?.address ?? '',
              amount: amountValue,
            };
            const resultCurrent = recordingOwnerGuard.capture();
            const workflow = createPermitStakeWorkflow<{
              signature: string;
              unsignedMessage?: IEarnPermit2ApproveSignData;
              fee: IEarnEstimateFeeResp | undefined;
            }>({
              taskId: generateUUID(),
              identity: {
                accountId: approveTarget.accountId,
                networkId: approveTarget.networkId,
                accountAddress: frozenAddress,
                provider: providerName,
                action: 'stake',
                intent: {
                  amount: amountValue,
                  symbol: actionSymbol,
                  inputTokenAddress: transactionInputTokenAddress ?? '',
                  protocolVault: protocolVault ?? '',
                  spenderAddress: approveTarget.spenderAddress,
                },
              },
              isCurrent,
              isResultCurrent: resultCurrent,
              onSubmitted: (signed) =>
                removePermitCache({
                  ...cacheKey,
                  expectedSignature: signed.signature,
                  expectedAccountAddress: frozenAddress,
                }),
              onAsyncError: (error) => {
                if (isCurrent()) errorToastUtils.showToastOfError(error);
              },
              sign: async (signal) => {
                const cached = getPermitCache(cacheKey);
                let signed: {
                  signature: string;
                  unsignedMessage?: IEarnPermit2ApproveSignData;
                };
                if (
                  cached?.accountAddress &&
                  isTaskAccountAddress(
                    { networkId, accountAddress: frozenAddress },
                    cached.accountAddress,
                  )
                ) {
                  signed = {
                    signature: cached.signature,
                    unsignedMessage: cached.permit2Data,
                  };
                } else {
                  const result = await getPermitSignature({
                    networkId: approveTarget.networkId,
                    accountId: approveTarget.accountId,
                    token: tokenInfo?.token as IToken,
                    amountValue,
                    providerName,
                    vaultAddress: protocolVault || '',
                    expectedAccountAddress: frozenAddress,
                  });
                  if (signal.aborted || !isCurrent()) return undefined;
                  signed = result;
                  updatePermitCache({
                    ...cacheKey,
                    accountAddress: frozenAddress,
                    signature: result.signature,
                    permit2Data: result.unsignedMessage,
                    expiredAt: Date.now() + 24 * 60 * 60 * 1000,
                  });
                }
                if (signal.aborted || !isCurrent()) return undefined;
                permitSignatureRef.current = signed.signature;
                permit2DataRef.current = signed.unsignedMessage;
                const fee = await fetchEstimateFeeResp(amountValue);
                if (signal.aborted || !isCurrent()) return undefined;
                setEstimateFeeResp(fee);
                return { ...signed, fee };
              },
              submit: async (signed, handoff) => {
                await onSubmit(
                  signed.fee,
                  isCurrent,
                  {
                    signature: signed.signature,
                    unsignedMessage: signed.unsignedMessage,
                  },
                  handoff,
                );
              },
            });
            const reservation = permitStakeWorkflowRegistry.reserve(
              permitOwnerKey,
              approveTarget.accountId,
              workflow,
            );
            if (!reservation) {
              Toast.message({
                title: intl.formatMessage({ id: ETranslations.global_pending }),
              });
              setApproving(false);
              return;
            }
            const unsubscribe = workflow.subscribe(() => {
              const task = workflow.getTask();
              const step = task.steps[task.currentStepIndex];
              const terminal =
                step?.status.type === 'cancelled' ||
                (step?.status.type === 'failed' &&
                  (step.kind === 'sign' ||
                    step.kind === 'wait' ||
                    step.kind === 'external' ||
                    step.status.stage === 'beforeSend')) ||
                (task.steps.at(-1)?.kind === 'deposit' &&
                  task.steps.at(-1)?.status.type === 'handedOff');
              if (
                terminal &&
                permitStakeWorkflowRegistry.release(
                  permitOwnerKey,
                  approveTarget.accountId,
                  reservation,
                )
              )
                unsubscribe();
            });
            permitWorkflowRef.current = {
              scope: approvalScopeKey,
              cancel: workflow.cancel,
            };
            try {
              await workflow.run();
            } finally {
              if (permitWorkflowRef.current?.cancel === workflow.cancel)
                permitWorkflowRef.current = undefined;
            }
            if (isCurrent()) setApproving(false);
          } catch (error: unknown) {
            if (isCurrent()) {
              errorToastUtils.toastIfError(error);
              errorToastUtils.showToastOfError(error);
              console.error('Permit sign error:', error);
              defaultLogger.staking.page.permitSignError({
                error: error instanceof Error ? error.message : String(error),
              });
              setApproving(false);
            }
          }
        };
        await checkEstimateGasAlert(handlePermit2Approve, undefined, isCurrent);
        return;
      }

      const account = await backgroundApiProxy.serviceAccount.getAccount({
        accountId: approveTarget.accountId,
        networkId: approveTarget.networkId,
      });
      if (!isCurrent()) return;
      if (
        preparationPolicy &&
        isUsdtResetReentry &&
        !(await verifyPreparedAction(isCurrent))
      ) {
        if (isCurrent()) setApproving(false);
        return;
      }

      await navigationToTxConfirm({
        approvesInfo: [
          {
            owner: account.address,
            spender: approveTarget.spenderAddress,
            amount: amountValue,
            tokenInfo: approveTarget.token,
          },
        ],
        isNavigationCurrent: isCurrent,
        onSuccess(data) {
          if (!isCurrent()) return;
          const txid =
            data[0]?.signedTx?.txid?.trim() || data[0]?.decodedTx?.txid?.trim();
          if (!txid && preparationPolicy) {
            Toast.message({
              title: intl.formatMessage({ id: ETranslations.global_pending }),
            });
            return;
          }
          trackAllowance(txid || data[0].decodedTx.txid);
          allowanceAbortRef.current?.abort();
          const abortController = new AbortController();
          allowanceAbortRef.current = abortController;
          void (async () => {
            try {
              if (preparationPolicy) {
                const status = await waitForTxFinalStatus({
                  accountId: approveTarget.accountId,
                  networkId: approveTarget.networkId,
                  txid: txid || data[0].decodedTx.txid,
                  signal: abortController.signal,
                });
                if (
                  status !== EOnChainHistoryTxStatus.Success ||
                  !isCurrent()
                ) {
                  return;
                }
              }
              const allowanceReady = await waitForAllowanceAfterApprove({
                requiredAmount: amountValue,
                signal: abortController.signal,
              });
              if (!allowanceReady || !isCurrent()) {
                return;
              }
              const freshFee = await fetchEstimateFeeResp(
                amountValue,
                ECheckAmountActionType.STAKING,
              );
              if (!isCurrent()) return;
              setEstimateFeeResp(freshFee);
              await onSubmit(freshFee, isCurrent);
            } catch (error) {
              if (isCurrent()) {
                errorToastUtils.toastIfError(error);
                errorToastUtils.showToastOfError(error);
              }
            } finally {
              if (isCurrent()) {
                setApproving(false);
              }
            }
          })();
        },
        onFail() {
          if (isCurrent()) setApproving(false);
        },
        onCancel() {
          if (isCurrent()) setApproving(false);
        },
      });
    } finally {
      if (permitAttempt && permitAttemptRef.current === permitAttempt)
        permitAttemptRef.current = undefined;
    }
  }, [
    approvalScopeGuard,
    approvalScopeKey,
    recordingOwnerGuard,
    taskAccountAddress,
    networkId,
    approving,
    allowance,
    amountValue,
    tokenInfo?.token,
    usePermit2Approve,
    preparationPolicy,
    verifyPreparedAction,
    approveTarget.accountId,
    approveTarget.networkId,
    approveTarget.spenderAddress,
    approveTarget.token,
    navigationToTxConfirm,
    fetchAllowanceResponse,
    showResetUSDTApproveValueDialog,
    checkEstimateGasAlert,
    getPermitCache,
    getPermitSignature,
    approveType,
    protocolVault,
    providerName,
    actionSymbol,
    updatePermitCache,
    removePermitCache,
    transactionInputTokenAddress,
    onSubmit,
    waitForAllowanceAfterApprove,
    fetchEstimateFeeResp,
    retryAllowance,
    trackAllowance,
    intl,
  ]);

  // Keep the ref pointing at the latest onApprove so the earlier-defined USDT
  // reset flow can re-enter it after the allowance is zeroed.
  useEffect(() => {
    onApproveRef.current = onApprove;
  }, [onApprove]);

  const {
    isPendleLikeLayout,
    pendleAccordionItems,
    pendleRewardRows,
    usePendleSummaryLayout,
    transactionDetailsTriggerText,
    apyDetail,
    showApyHeader,
    hasSummarySection,
    pendleTipText,
    showPendleTransactionSection,
    showExpiredRefresh,
    showReceiveInput,
    effectiveReceiveInputConfig,
    receiveArrowOverlayStyle,
  } = usePendleLayoutState({
    transactionLayout: stakePresentation.transactionLayout,
    transactionConfirmation,
    amountValue,
    showApyDetail,
    stakeType: preparationPolicy ? stakeType : undefined,
    action: preparationPolicy ? confirmationAction : undefined,
    hideYieldPreview,
    receiveInputConfig,
    networkLogoURI,
    isQuoteExpired,
    loading: quoteLoading,
  });

  // During approve/submit flow, don't show expired refresh — the transaction is in progress.
  // After swap completes, onQuoteReset will restart the countdown.
  const isTransacting = approving || submitting;
  const effectiveShowExpiredRefresh = showExpiredRefresh && !isTransacting;

  const accordionContent = useMemo(() => {
    const items: ReactElement[] = [];
    if (Number(amountValue) <= 0) {
      return items;
    }

    if (isPendleLikeLayout) {
      return pendleAccordionItems;
    }

    if (!isPreparationQuoteDeferred && transactionConfirmation?.receive) {
      items.push(
        <CalculationListItem key="receive">
          <CalculationListItem.Label
            size={transactionConfirmation.receive.title.size || '$bodyMd'}
            color={transactionConfirmation.receive.title.color}
            tooltip={
              transactionConfirmation.receive.tooltip?.type === 'text'
                ? transactionConfirmation.receive.tooltip.data?.title?.text
                : undefined
            }
          >
            {transactionConfirmation.receive.title.text}
          </CalculationListItem.Label>
          <EarnText
            text={transactionConfirmation.receive.description}
            size="$bodyMdMedium"
          />
        </CalculationListItem>,
      );
    }
    if (estimateFeeResp) {
      items.push(
        <EstimateNetworkFee
          key="network-fee"
          isVisible
          estimateFeeResp={estimateFeeResp}
          onPress={() => {
            showEstimateGasAlert({
              daysConsumed: daysSpent,
              estFiatValue: estimateFeeResp.feeFiatValue,
            });
          }}
        />,
      );
    }

    if (stakePresentation.feeInput === 'utxo' && estimateFeeUTXO) {
      items.push(
        <BtcFeeRateInput
          key="btc-fee-rate-input"
          estimateFeeUTXO={estimateFeeUTXO}
          onFeeRateChange={onFeeRateChange}
        />,
      );
    }
    return items;
  }, [
    amountValue,
    daysSpent,
    estimateFeeResp,
    estimateFeeUTXO,
    isPendleLikeLayout,
    isPreparationQuoteDeferred,
    onFeeRateChange,
    pendleAccordionItems,
    stakePresentation.feeInput,
    showEstimateGasAlert,
    transactionConfirmation?.receive,
  ]);
  const isAccordionTriggerDisabled = !amountValue;
  const isPositiveAmount = useMemo(() => {
    const amountBN = new BigNumber(amountValue);
    return !amountBN.isNaN() && amountBN.gt(0);
  }, [amountValue]);
  const isShowStakeProgress =
    Boolean(activeDepositTask) ||
    (isPositiveAmount &&
      (isWrapStake ||
        (useApprove &&
          (shouldApprove || showStakeProgressRef.current[amountValue]))));
  const currentDepositTaskStep =
    activeDepositTask?.steps[activeDepositTask.currentStepIndex];
  const depositTaskStatus = currentDepositTaskStep?.status;
  const depositRecording = activeDepositTask?.recording;
  const hasRecordingHandle = Boolean(getRecordingHandle());
  const depositRecordingCanRetry =
    hasRecordingHandle &&
    isRetryableDepositRecordingStatus(depositRecording?.status);
  const depositRecordingCanFinish =
    (hasRecordingHandle || canFinishRestoredRecording) &&
    (depositRecording?.status === 'succeeded' ||
      depositRecording?.status === 'superseded' ||
      depositRecording?.status === 'notTracked' ||
      depositRecording?.status === 'remoteUnknown');
  const isRecoveryOnly = Boolean(
    activeDepositTask && !getCurrentDepositTaskHandle(),
  );
  const canResumeRetainedTask = Boolean(
    isRecoveryOnly &&
    retainedTask &&
    (depositTaskStatus?.type === 'ready' ||
      depositTaskStatus?.type === 'cancelled' ||
      depositTaskStatus?.type === 'failed' ||
      (depositTaskStatus?.type === 'unknown' &&
        depositTaskStatus.txid &&
        !depositTaskStatus.txidConflict) ||
      depositTaskStatus?.type === 'confirming' ||
      depositTaskStatus?.type === 'verifying'),
  );
  const depositTaskCanQuery =
    (!isRecoveryOnly || canResumeRetainedTask) &&
    Boolean(
      (depositTaskStatus?.type === 'unknown' &&
        depositTaskStatus.txid &&
        !depositTaskStatus.txidConflict) ||
      (isRecoveryOnly &&
        (depositTaskStatus?.type === 'confirming' ||
          depositTaskStatus?.type === 'verifying')),
    );
  const depositTaskCanAct = Boolean(
    canResumeRetainedTask ||
    (!isRecoveryOnly &&
      (depositTaskStatus?.type === 'ready' ||
        depositTaskStatus?.type === 'failed' ||
        depositTaskStatus?.type === 'cancelled')) ||
    depositRecordingCanRetry ||
    depositRecordingCanFinish ||
    depositTaskCanQuery,
  );
  const depositTaskLoading = Boolean(
    (!isRecoveryOnly &&
      (depositTaskStatus?.type === 'preparing' ||
        depositTaskStatus?.type === 'awaitingUser' ||
        depositTaskStatus?.type === 'sending' ||
        depositTaskStatus?.type === 'confirming' ||
        depositTaskStatus?.type === 'verifying')) ||
    depositRecording?.status === 'pending',
  );
  const stakeProgressCurrentStep = useMemo(() => {
    if (activeDepositTask && isWrapStake) {
      if (currentDepositTaskStep?.kind === 'wrap')
        return EStakeProgressStep.approve;
      if (currentDepositTaskStep?.kind === 'approve')
        return EStakeProgressStep.deposit;
      return shouldShowPostWrapApproveStep
        ? EStakeProgressStep.unstake
        : EStakeProgressStep.deposit;
    }
    if (isWrapStake) return stakeProgressStep;
    if (isDisable || shouldApprove) return EStakeProgressStep.approve;
    return EStakeProgressStep.deposit;
  }, [
    activeDepositTask,
    currentDepositTaskStep?.kind,
    isDisable,
    isWrapStake,
    shouldApprove,
    shouldShowPostWrapApproveStep,
    stakeProgressStep,
  ]);

  const taskProgressSteps = activeDepositTask?.steps
    .filter((step) => step.status.type !== 'skipped')
    .map((step) => {
      let label = intl.formatMessage({ id: ETranslations.earn_deposit });
      if (step.kind === 'wrap') label = wrapStakeLabel;
      else if (step.kind === 'resetApproval')
        label = intl.formatMessage(
          { id: ETranslations.global_revoke_approve },
          { symbol: tokenInfo?.token.symbol || '' },
        );
      else if (step.kind === 'approve')
        label = intl.formatMessage({ id: ETranslations.global_approve });
      let status: 'waiting' | 'current' | 'completed' | 'submitted' = 'waiting';
      if (
        step.status.type === 'succeeded' ||
        step.status.type === 'allowanceSatisfied'
      )
        status = 'completed';
      else if (step.status.type === 'handedOff') status = 'submitted';
      else if (
        activeDepositTask.steps.indexOf(step) ===
        activeDepositTask.currentStepIndex
      )
        status = 'current';
      return { id: step.id, label, status };
    });
  const stakeProgress = taskProgressSteps ? (
    <StakeTaskProgress steps={taskProgressSteps} />
  ) : (
    <StakeProgress
      approveType={approveType}
      currentStep={stakeProgressCurrentStep}
      step1Label={isWrapStake ? wrapStakeLabel : undefined}
      step2LabelId={stakeProgressStep2LabelId}
      step3LabelId={stakeProgressStep3LabelId}
    />
  );

  const onConfirmText = useMemo(() => {
    if (activeDepositTask) {
      if (depositRecordingCanFinish)
        return intl.formatMessage({ id: ETranslations.global_done });
      if (depositRecording?.status === 'remoteUnknown')
        return intl.formatMessage({ id: ETranslations.global_pending });
      if (isRecoveryOnly && !canResumeRetainedTask && !depositRecordingCanRetry)
        return intl.formatMessage({ id: ETranslations.global_pending });
      if (
        depositRecordingCanRetry ||
        depositTaskCanQuery ||
        (canResumeRetainedTask &&
          (depositTaskStatus?.type === 'confirming' ||
            depositTaskStatus?.type === 'verifying')) ||
        depositTaskStatus?.type === 'cancelled' ||
        depositTaskStatus?.type === 'failed'
      ) {
        return intl.formatMessage({ id: ETranslations.global_retry });
      }
      if (depositTaskStatus?.type === 'ready')
        return intl.formatMessage({ id: ETranslations.global_continue });
      if (depositTaskStatus?.type === 'unknown')
        return intl.formatMessage({ id: ETranslations.global_pending });
      if (!depositTaskStatus)
        return intl.formatMessage({
          id: ETranslations.feedback_transaction_submitted,
        });
    }
    if (effectiveShowExpiredRefresh) {
      return intl.formatMessage({ id: ETranslations.global_refresh });
    }
    if (!useApprove) {
      if (isWrapStake) {
        return wrapStakeLabel;
      }
      return intl.formatMessage({
        id:
          stakePresentation.action === 'swap'
            ? ETranslations.global_swap
            : ETranslations.global_continue,
      });
    }
    if (shouldApprove) {
      return intl.formatMessage(
        {
          id: usePermit2Approve
            ? ETranslations.earn_approve_deposit
            : ETranslations.global_approve,
        },
        { amount: amountValue, symbol: tokenInfo?.token.symbol || '' },
      );
    }
    return intl.formatMessage({
      id:
        stakePresentation.action === 'swap'
          ? ETranslations.global_swap
          : ETranslations.earn_deposit,
    });
  }, [
    activeDepositTask,
    depositRecordingCanFinish,
    depositRecording?.status,
    isRecoveryOnly,
    canResumeRetainedTask,
    depositRecordingCanRetry,
    depositTaskCanQuery,
    depositTaskStatus,
    effectiveShowExpiredRefresh,
    useApprove,
    shouldApprove,
    intl,
    isWrapStake,
    wrapStakeLabel,
    usePermit2Approve,
    amountValue,
    tokenInfo?.token.symbol,
    stakePresentation.action,
  ]);

  const confirmOnPress = useMemo(() => {
    if (activeDepositTask) {
      return () => {
        if (depositRecordingCanFinish && depositRecording?.txid) {
          if (recordingFinishLockRef.current) return;
          recordingFinishLockRef.current = true;
          void finishRecordingTask(
            activeDepositTask.taskId,
            depositRecording.txid,
            undefined,
            depositRecording.status === 'remoteUnknown',
          )
            .then((finished) => {
              if (!recordingOwnerGuard.isCurrent()) return;
              if (finished) {
                setAmountValue('');
                updateAmountValidation({ message: '', alerts: [] });
                onQuoteReset?.();
                onTaskRecoveryComplete?.();
              } else {
                Toast.message({
                  title: intl.formatMessage({
                    id:
                      depositRecording.status === 'remoteUnknown'
                        ? ETranslations.global_pending
                        : ETranslations.global_an_error_occurred,
                  }),
                });
              }
            })
            .catch((error: unknown) => {
              if (recordingOwnerGuard.isCurrent())
                errorToastUtils.showToastOfError(error);
            })
            .finally(() => {
              recordingFinishLockRef.current = false;
            });
          return;
        }
        if (depositRecordingCanRetry) {
          const recovery = getRecordingHandle();
          if (recovery) {
            void recovery
              .retryRecording()
              .then((started) => {
                if (!started && recordingOwnerGuard.isCurrent()) {
                  Toast.message({
                    title: intl.formatMessage({
                      id: ETranslations.global_an_error_occurred,
                    }),
                  });
                }
              })
              .catch((error: unknown) => {
                if (recordingOwnerGuard.isCurrent())
                  errorToastUtils.showToastOfError(error);
              });
          }
          return;
        }
        if (canResumeRetainedTask) {
          void resumeRetainedDepositTask();
          return;
        }
        const handle = getCurrentDepositTaskHandle();
        if (!handle) return;
        if (depositTaskStatus?.type === 'unknown') void handle.retryStatus();
        else if (
          depositTaskStatus?.type === 'cancelled' ||
          depositTaskStatus?.type === 'failed'
        ) {
          void handle.retry().then(() => clearTaskBeforeAnySend());
        } else if (depositTaskStatus?.type === 'ready') void handle.run();
      };
    }
    if (effectiveShowExpiredRefresh) return handleLocalRefreshQuote;
    if (
      (preparationPolicy || shouldApprove) &&
      useApprove &&
      !usePermit2Approve &&
      !isWrapStake
    )
      return () => void startDirectDepositTask();
    if (shouldApprove) return onApprove;
    if (
      usePermit2Approve &&
      permitSignatureRef.current &&
      new BigNumber(amountValue).gt(allowance)
    )
      return onApprove;
    return () => onSubmit();
  }, [
    activeDepositTask,
    depositRecording,
    depositRecordingCanFinish,
    depositRecordingCanRetry,
    depositTaskStatus,
    canResumeRetainedTask,
    resumeRetainedDepositTask,
    effectiveShowExpiredRefresh,
    preparationPolicy,
    useApprove,
    usePermit2Approve,
    amountValue,
    allowance,
    isWrapStake,
    startDirectDepositTask,
    clearTaskBeforeAnySend,
    getCurrentDepositTaskHandle,
    getRecordingHandle,
    recordingOwnerGuard,
    intl,
    finishRecordingTask,
    shouldApprove,
    handleLocalRefreshQuote,
    onApprove,
    onSubmit,
    updateAmountValidation,
    onQuoteReset,
    onTaskRecoveryComplete,
  ]);

  const actionIdentity = [
    accountId,
    protocolInfo?.earnAccount?.accountAddress,
    networkId,
    providerName,
    protocolInfo?.vault,
    amountValue,
    transactionInputTokenAddress,
    transactionOutputTokenAddress,
    stakeType,
    approveType,
  ].join('|');
  const runConfirmOnPress = useCallback(() => {
    if (!submissionLockRef.current) confirmOnPress();
  }, [confirmOnPress]);
  let baseConfirmLoading =
    loadingAllowance || approving || submitting || checkAmountLoading;
  let baseConfirmDisabled = Boolean(
    isDisabled ||
    isDisable ||
    (preparationPolicy && useApprove && !allowanceAvailable),
  );
  if (activeDepositTask) {
    baseConfirmLoading = depositTaskLoading || submitting;
    baseConfirmDisabled =
      !depositTaskCanAct ||
      Boolean(
        isDisabled &&
        !depositTaskCanQuery &&
        !depositRecordingCanRetry &&
        !depositRecordingCanFinish,
      );
  } else if (effectiveShowExpiredRefresh) {
    baseConfirmLoading = quoteRefreshing;
    baseConfirmDisabled = false;
  }
  const guardedAction = useEarnActionGuard({
    action: {
      text: onConfirmText,
      onPress: runConfirmOnPress,
      loading: baseConfirmLoading,
      disabled: Boolean(
        baseConfirmDisabled ||
        submitting ||
        (isStakeAssetLoading &&
          !depositTaskCanQuery &&
          !depositRecordingCanRetry &&
          !depositRecordingCanFinish),
      ),
    },
    override:
      isRecoveryOnly || depositRecordingCanRetry || depositRecordingCanFinish
        ? undefined
        : footerActionOverride,
    guard:
      isRecoveryOnly ||
      depositTaskCanQuery ||
      depositRecordingCanRetry ||
      depositRecordingCanFinish
        ? undefined
        : actionGuard,
    identity: actionIdentity,
  });
  const effectiveOnConfirmText =
    isStakeAssetLoading &&
    !depositTaskCanQuery &&
    !depositRecordingCanRetry &&
    !depositRecordingCanFinish
      ? ''
      : guardedAction.text;
  const effectiveConfirmOnPress = guardedAction.onPress;
  const effectiveConfirmLoading = Boolean(
    (isStakeAssetLoading &&
      !depositRecordingCanRetry &&
      !depositRecordingCanFinish) ||
    guardedAction.loading,
  );
  const effectiveConfirmDisabled = Boolean(
    submitting ||
    (isStakeAssetLoading &&
      !depositRecordingCanRetry &&
      !depositRecordingCanFinish) ||
    guardedAction.disabled,
  );

  const footerContent = (
    <YStack bg="$bgApp" gap="$5">
      {isShowStakeProgress ? <Stack>{stakeProgress}</Stack> : null}
      <Page.FooterActions
        p={0}
        onConfirmText={effectiveOnConfirmText}
        buttonContainerProps={{
          $gtMd: {
            ml: '0',
          },
          w: '100%',
        }}
        confirmButtonProps={{
          onPress: effectiveConfirmOnPress,
          loading: effectiveConfirmLoading,
          disabled: effectiveConfirmDisabled,
          w: '100%',
        }}
      />
    </YStack>
  );

  const summaryContent = useMemo(() => {
    if (!hasSummarySection) return null;
    if (usePendleSummaryLayout) {
      return (
        <PendleSummarySection
          rewardRows={pendleRewardRows}
          tipText={pendleTipText}
          loading={quoteLoading}
        />
      );
    }

    // When entering from trending list (protocolSwitchConfig present),
    // only show info-style rewards (those with title.color).
    // For details page and Position Manage modal, show the full content
    // including the "Est. annual rewards" title and all reward rows.
    const isFromTrending = !!protocolSwitchConfig;

    if (isFromTrending) {
      const infoRewards = transactionConfirmation?.rewards?.filter(
        (reward) => !!reward.title.color,
      );
      if (!infoRewards?.length) return null;
      return (
        <YStack gap="$2">
          {infoRewards.map((reward) => {
            const hasTooltip = reward.tooltip?.type === 'text';
            let descriptionTextSize = (
              hasTooltip ? '$bodyMd' : '$bodyLgMedium'
            ) as FontSizeTokens;
            if (reward.description.size) {
              descriptionTextSize = reward.description.size;
            }
            return (
              <XStack
                key={reward.title.text}
                gap="$1"
                ai="flex-start"
                mt="$1.5"
                flexWrap="wrap"
              >
                <XStack gap="$1" flex={1} flexWrap="wrap" ai="center">
                  <EarnText
                    text={reward.title}
                    color={reward.title.color}
                    size={reward.title.size}
                  />
                  <XStack gap="$1" flex={1} flexWrap="wrap" ai="center">
                    <EarnText
                      text={reward.description}
                      size={descriptionTextSize}
                      color={reward.description.color ?? '$textSubdued'}
                      flexShrink={1}
                    />
                    {hasTooltip ? (
                      <EarnTooltip
                        title={reward.title.text}
                        tooltip={reward.tooltip}
                      />
                    ) : null}
                  </XStack>
                </XStack>
              </XStack>
            );
          })}
        </YStack>
      );
    }

    // Full content for details page and Position Manage modal
    return (
      <YStack gap="$1.5">
        <XStack ai="center" gap="$1">
          <EarnText
            text={transactionConfirmation?.title}
            color="$textSubdued"
            size="$bodyMd"
            boldTextProps={{
              size: '$bodyMdMedium',
            }}
          />
          {transactionConfirmation?.tooltip ? (
            <EarnTooltip
              title={transactionConfirmation?.title?.text}
              tooltip={transactionConfirmation?.tooltip}
            />
          ) : null}
        </XStack>
        {transactionConfirmation?.rewards?.map((reward) => {
          const hasTooltip = reward.tooltip?.type === 'text';
          let descriptionTextSize = (
            hasTooltip ? '$bodyMd' : '$bodyLgMedium'
          ) as FontSizeTokens;
          if (reward.description.size) {
            descriptionTextSize = reward.description.size;
          }
          return (
            <XStack
              key={reward.title.text}
              gap="$1"
              ai="flex-start"
              flexWrap="wrap"
            >
              <XStack gap="$1" flex={1} flexWrap="wrap" ai="center">
                <EarnText
                  text={reward.title}
                  color={reward.title.color}
                  size={reward.title.size}
                />
                <XStack gap="$1" flex={1} flexWrap="wrap" ai="center">
                  <EarnText
                    text={reward.description}
                    size={descriptionTextSize}
                    color={reward.description.color ?? '$textSubdued'}
                    flexShrink={1}
                  />
                  {hasTooltip ? (
                    <EarnTooltip
                      title={reward.title.text}
                      tooltip={reward.tooltip}
                    />
                  ) : null}
                </XStack>
              </XStack>
            </XStack>
          );
        })}
      </YStack>
    );
  }, [
    hasSummarySection,
    usePendleSummaryLayout,
    pendleRewardRows,
    pendleTipText,
    transactionConfirmation,
    quoteLoading,
    protocolSwitchConfig,
  ]);

  const shouldShowSummaryCard = shouldShowStakingSummaryCard({
    isDisabled,
    usesMarketLayout: stakePresentation.transactionLayout === 'market',
    amountValue,
    hasSummarySection,
    showPendleTransactionSection,
  });

  let tradeOrBuyContent: ReactElement | null = null;
  if (stakePresentation.transactionLayout !== 'market') {
    tradeOrBuyContent = isStakeAssetLoading ? (
      <XStack h="$8" />
    ) : (
      <TradeOrBuy
        token={tokenInfo?.token as IToken}
        accountId={accountId}
        networkId={networkId}
        containerStyle={{
          pt: '$0',
        }}
      />
    );
  }

  const platformBonus =
    suppressPlatformBonus || hideYieldPreview
      ? undefined
      : transactionConfirmation?.platformBonus;
  const shouldShowPlatformBonus = Boolean(platformBonus);

  const platformBonusContent = platformBonus ? (
    <EarnPlatformBonusSection
      platformBonus={platformBonus}
      protocolInfo={protocolInfo}
      tokenInfo={tokenInfo}
      footer={tradeOrBuyContent}
    />
  ) : null;

  // The "Est. annual rewards" summary depends on a second request
  // (getTransactionConfirmation) that resolves after managePageData. Without a
  // placeholder it pops in on the second stage and shoves the rest of the card
  // down. Reserve its space with a skeleton, but only during the first-load
  // window: once the quote settles (success or failure) never show it again,
  // so no-summary protocols don't pulse on amount edits and a failed request
  // doesn't leave the skeleton stuck.
  // Stakefish's trending entry uses a compact colored "earn starts" row instead
  // of the full title/value summary, so reserve the height of that row as well.
  const shouldReserveCompactSummary =
    Boolean(protocolSwitchConfig) && stakePresentation.summary === 'validator';
  const summaryPending =
    !hideYieldPreview &&
    !hasSummarySection &&
    !isPendleLikeLayout &&
    (!protocolSwitchConfig || shouldReserveCompactSummary) &&
    !isDisabled &&
    isPositiveAmount &&
    !transactionConfirmationSettled;

  const summaryLoadingContent = useMemo(() => {
    if (!summaryPending) {
      return null;
    }
    if (shouldReserveCompactSummary) {
      return (
        <YStack mt="$1.5">
          <Skeleton.BodyLg w={160} />
        </YStack>
      );
    }
    return (
      <YStack gap="$1.5">
        <Skeleton.BodyMd w={96} />
        <Skeleton.BodyLg w={140} />
      </YStack>
    );
  }, [shouldReserveCompactSummary, summaryPending]);

  // When entering from the trending list, the protocol selector is rendered as a
  // standalone (border-less) card above the summary card. The bordered summary
  // card should then only render when it actually has body content, otherwise it
  // would show up as an empty bordered box.
  const summaryCardHasBodyContent = Boolean(
    summaryContent ||
    summaryLoadingContent ||
    ongoingValidator ||
    (!shouldShowPlatformBonus && tradeOrBuyContent),
  );

  return (
    <StakingFormWrapper>
      <Stack position="relative">
        <YStack gap="$2">
          {isStakeAssetLoading ? (
            <StakingAmountInputSkeleton
              title={
                inputTitle ||
                intl.formatMessage({ id: ETranslations.earn_deposit })
              }
            />
          ) : (
            <Stack position="relative" opacity={amountInputDisabled ? 0.7 : 1}>
              <StakingAmountInput
                title={
                  inputTitle ||
                  intl.formatMessage({ id: ETranslations.earn_deposit })
                }
                disabled={amountInputDisabled}
                hasError={isInsufficientBalance || isCheckAmountMessageError}
                value={amountValue}
                onChange={onChangeAmountValue}
                onBlur={onBlurAmountValue}
                tokenSelectorTriggerProps={{
                  selectedTokenImageUri: tokenImageUri,
                  selectedTokenImageLoading: tokenImageLoading,
                  selectedTokenSymbol: tokenSymbol,
                  selectedNetworkImageUri: networkLogoURI,
                  ...tokenSelectorTriggerProps,
                  disabled:
                    amountInputDisabled || tokenSelectorTriggerProps?.disabled,
                }}
                balanceProps={{
                  value: balance,
                  onPress: onMax,
                  // During a protocol switch the on-screen balance still belongs
                  // to the previous protocol/network — show the built-in balance
                  // skeleton instead of a stale value that jumps on load.
                  loading: Boolean(footerActionOverride?.loading),
                }}
                inputProps={{
                  placeholder: '0',
                  autoFocus: !amountInputDisabled,
                }}
                valueProps={{
                  value: currentValue,
                  currency: currentValue ? currencySymbol : undefined,
                }}
                enableMaxAmount
                usePercentageKeyboardAccessory
                onAmountFocusChange={onAmountFocusChange}
                onSelectPercentageStage={onSelectPercentageStage}
              />
              {amountInputDisabled ? (
                <Stack position="absolute" w="100%" h="100%" zIndex={1} />
              ) : null}
            </Stack>
          )}
          <ManagePageV2ReceiveInput
            receive={
              isPreparationQuoteDeferred
                ? undefined
                : transactionConfirmation?.receive
            }
            config={effectiveReceiveInputConfig}
            fiatSymbol={currencySymbol}
            payFiatValue={currentValue}
            loading={quoteLoading}
          />
        </YStack>
        {showReceiveInput ? (
          <Stack
            ai="center"
            position="absolute"
            top="50%"
            left="50%"
            zIndex={2}
            pointerEvents="none"
            style={receiveArrowOverlayStyle}
          >
            <IconButton
              testID="staking-icon-btn"
              alignSelf="center"
              bg="$bgApp"
              variant="tertiary"
              icon="ArrowBottomOutline"
              iconProps={{
                color: '$icon',
              }}
              size="small"
              disabled
              opacity={1}
            />
          </Stack>
        ) : null}
      </Stack>
      {isCheckAmountMessageError ? (
        <Alert
          icon="InfoCircleOutline"
          type="critical"
          title={checkAmountMessage}
        />
      ) : null}
      {checkAmountAlerts.length > 0 ? (
        <>
          {checkAmountAlerts.map((alert, index) => (
            <Alert
              key={index}
              type="warning"
              renderTitle={() => {
                return <EarnText text={alert.text} size="$bodyMdMedium" />;
              }}
              action={
                alert.button
                  ? {
                      primary: alert.button.text.text,
                      onPrimaryPress: () => {
                        if (alert.button?.data?.link) {
                          handleOpenWebSite({
                            navigation,
                            useCurrentWindow: false,
                            webSite: {
                              url: alert.button.data.link,
                              title: alert.button.data.link,
                              logo: undefined,
                              sortIndex: undefined,
                            },
                          });
                        }
                      },
                    }
                  : undefined
              }
            />
          ))}
        </>
      ) : null}

      {protocolSwitchConfig ? (
        <ProtocolSwitcher
          tokenSymbol={actionSymbol}
          accountId={accountId}
          fallbackProviderName={providerName}
          fallbackProviderLogoUri={providerLogo}
          fallbackAprText={apyDetail?.description?.text}
          protocolSwitchConfig={protocolSwitchConfig}
          disabled={approving || submitting || Boolean(activeDepositTask)}
        />
      ) : null}

      {shouldShowSummaryCard &&
      (!protocolSwitchConfig || summaryCardHasBodyContent) ? (
        <YStack
          p="$3.5"
          // The larger top padding exists to breathe above the summary heading
          // (est. rewards / APY / validator). When the card only holds the
          // trade-or-buy row (trending entry), keep the padding symmetric.
          pt={
            (showApyHeader && apyDetail && !protocolSwitchConfig) ||
            summaryContent ||
            summaryLoadingContent ||
            ongoingValidator
              ? '$5'
              : '$3.5'
          }
          borderRadius="$3"
          borderWidth={StyleSheet.hairlineWidth}
          borderColor="$borderSubdued"
        >
          {showApyHeader && apyDetail && !protocolSwitchConfig ? (
            <XStack gap="$1" ai="center" mb="$3.5">
              <EarnText
                text={apyDetail.description}
                size="$headingLg"
                color="$textSuccess"
              />
              <EarnActionIcon
                title={apyDetail.title.text}
                actionIcon={apyDetail.button}
              />
            </XStack>
          ) : null}
          <HeightTransition>
            {summaryContent || summaryLoadingContent ? (
              <>
                {summaryContent}
                {summaryLoadingContent}
                <Divider my="$5" />
              </>
            ) : null}
          </HeightTransition>
          <YStack gap="$5">
            {ongoingValidator ? (
              <EarnValidatorSelect
                field={ongoingValidator}
                value={selectedValidator}
                onChange={setSelectedValidator}
                disabled={amountInputDisabled}
              />
            ) : null}
            {showPendleTransactionSection && !protocolSwitchConfig ? (
              <Accordion
                overflow="hidden"
                width="100%"
                type="single"
                collapsible
                defaultValue=""
              >
                <Accordion.Item value="staking-accordion-content">
                  <Accordion.Trigger
                    unstyled
                    flexDirection="row"
                    alignItems="center"
                    alignSelf="flex-start"
                    px="$1"
                    mx="$-1"
                    width="100%"
                    justifyContent="space-between"
                    borderWidth={0}
                    bg="$transparent"
                    userSelect="none"
                    borderRadius="$1"
                    cursor={
                      isAccordionTriggerDisabled ? 'not-allowed' : 'pointer'
                    }
                    disabled={isAccordionTriggerDisabled}
                  >
                    {({ open }: { open: boolean }) => (
                      <>
                        {isPendleLikeLayout ? (
                          <PendleAccordionTriggerContent
                            open={open}
                            triggerText={transactionDetailsTriggerText?.text}
                            isDisabled={isAccordionTriggerDisabled}
                          />
                        ) : (
                          <>
                            <XStack gap="$1.5" alignItems="center">
                              <Image
                                width="$5"
                                height="$5"
                                src={providerLogo}
                                borderRadius="$2"
                              />
                              <SizableText size="$bodyMd">
                                {getEarnProviderDisplayName(providerName || '')}
                              </SizableText>
                            </XStack>
                            <YStack
                              transition="quick"
                              animateOnly={ANIMATE_ONLY_TRANSFORM}
                              rotate={
                                open && !isAccordionTriggerDisabled
                                  ? '180deg'
                                  : '0deg'
                              }
                              left="$2"
                            >
                              <Icon
                                name="ChevronDownSmallOutline"
                                color={
                                  isAccordionTriggerDisabled
                                    ? '$iconDisabled'
                                    : '$iconSubdued'
                                }
                                size="$5"
                              />
                            </YStack>
                          </>
                        )}
                      </>
                    )}
                  </Accordion.Trigger>
                  <Accordion.HeightAnimator transition="quick">
                    <Accordion.Content
                      transition="quick"
                      animateOnly={ANIMATE_ONLY_OPACITY}
                      exitStyle={{ opacity: 0 }}
                      px={0}
                      pb={0}
                      pt="$3.5"
                      gap="$2.5"
                    >
                      {accordionContent}
                    </Accordion.Content>
                  </Accordion.HeightAnimator>
                </Accordion.Item>
              </Accordion>
            ) : null}
            {shouldShowPlatformBonus ? null : tradeOrBuyContent}
          </YStack>
        </YStack>
      ) : null}
      {platformBonusContent}
      {preparationPolicy && useApprove && allowanceError ? (
        <Alert
          type="critical"
          title={intl.formatMessage({
            id: ETranslations.global_an_error_occurred,
          })}
          action={{
            primary: intl.formatMessage({ id: ETranslations.global_retry }),
            onPrimaryPress: retryAllowance,
          }}
        />
      ) : null}
      {depositRecording?.status === 'remoteUnknown' ? (
        <Alert
          type="warning"
          title={intl.formatMessage({ id: ETranslations.global_sync_error })}
          description={intl.formatMessage({
            id: ETranslations.wallet_transaction_maybe_already_submitted_check_activity__msg,
          })}
        />
      ) : null}
      {beforeFooter}
      {isInModalContext ? (
        <Page.Footer>
          <Stack
            bg="$bgApp"
            flexDirection="column"
            $gtMd={{
              flexDirection: 'row',
              alignItems: 'center',
              jc: 'space-between',
            }}
          >
            <Stack pl="$5" $md={{ pt: '$5' }}>
              {isShowStakeProgress ? stakeProgress : null}
            </Stack>

            <Page.FooterActions
              onConfirmText={effectiveOnConfirmText}
              confirmButtonProps={{
                onPress: effectiveConfirmOnPress,
                loading: effectiveConfirmLoading,
                disabled: effectiveConfirmDisabled,
              }}
            />
          </Stack>
          {platformEnv.isNativeIOSPhone ? null : (
            <PercentageStageOnKeyboard
              isAmountFocused={isAmountFocused && !amountInputDisabled}
              onSelectPercentageStage={
                amountInputDisabled ? undefined : onSelectPercentageStage
              }
              reserveSpaceUntilKeyboardShown={!amountInputDisabled}
            />
          )}
        </Page.Footer>
      ) : (
        <>
          <YStack>{footerContent}</YStack>
          {platformEnv.isNative &&
          !platformEnv.isNativeIOSPhone &&
          showStandaloneKeyboardFooter ? (
            <Page.Footer>
              <PercentageStageOnKeyboard
                isAmountFocused={isAmountFocused && !amountInputDisabled}
                onSelectPercentageStage={
                  amountInputDisabled ? undefined : onSelectPercentageStage
                }
              />
            </Page.Footer>
          ) : null}
        </>
      )}
    </StakingFormWrapper>
  );
}
