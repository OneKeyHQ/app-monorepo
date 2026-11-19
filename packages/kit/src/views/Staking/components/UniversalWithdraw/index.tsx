import type { PropsWithChildren, ReactElement, ReactNode } from 'react';
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
import { Keyboard } from 'react-native';
import { useDebouncedCallback } from 'use-debounce';

import {
  Alert,
  Dialog,
  HeightTransition,
  Icon,
  IconButton,
  SizableText,
  Skeleton,
  Stack,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IAlertType } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
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
import {
  fillLeadingZero,
  validateAmountInputForStaking,
} from '@onekeyhq/kit/src/utils/validateAmountInput';
import { waitForTxFinalStatus } from '@onekeyhq/kit/src/utils/waitForTxFinalStatus';
import { useEarnDesktopHomeCopy } from '@onekeyhq/kit/src/views/Earn/components/desktopHome/earnDesktopHomeCopy';
import { buildKeyboardPressProps } from '@onekeyhq/kit/src/views/Earn/components/desktopHome/earnDesktopPressable';
import {
  buildWaysOutFirstFrameKey,
  readFirstFrame,
} from '@onekeyhq/kit/src/views/Earn/pages/EarnRouter/earnFirstFrameCache';
import { getEarnProtocol } from '@onekeyhq/kit/src/views/Earn/protocols';
import { createEarnConfirmationTaskAdapter } from '@onekeyhq/kit/src/views/Earn/tasks/confirmationTaskAdapter';
import { createEarnWithdrawApprovalTask } from '@onekeyhq/kit/src/views/Earn/tasks/earnWithdrawApprovalTask';
import { normalizeTaskAccountAddress } from '@onekeyhq/kit/src/views/Earn/tasks/taskAddress';
import { useEarnRiskWarningGate } from '@onekeyhq/kit/src/views/Staking/components/EarnRiskWarningDialog';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import {
  EApproveType,
  ECheckAmountActionType,
  EClaimType,
  EStakingActionType,
} from '@onekeyhq/shared/types/staking';
import type {
  ICheckAmountAlert,
  IEarnActionIcon,
  IEarnAmountUnit,
  IEarnEstimateFeeResp,
  IEarnText,
  IEarnTokenInfo,
  IEarnTransactionTip,
  IEarnWithdrawType,
  IProtocolInfo,
  IStakeTransactionConfirmation,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { getUniversalWithdrawProtocolPlan } from '../../earnWithdrawTask/types';
import { useCommittedEarnScopeGuard } from '../../hooks/useCommittedEarnScopeGuard';
import { useEarnActionGuard } from '../../hooks/useEarnActionGuard';
import { usePendleLayoutState } from '../../hooks/usePendleLayoutState';
import { useQuoteRefresh } from '../../hooks/useQuoteRefresh';
import { useTrackTokenAllowance } from '../../hooks/useUtilsHooks';
import { useHandleWithdraw } from '../../pages/ProtocolDetails/useHandleActions';
import {
  EARN_EMPTIED_HOLD_MS,
  countDecimalPlaces,
  getTypedAmountValue,
  isInvalidAmount,
} from '../../utils/utils';
import { CalculationListItem } from '../CalculationList';
import { EarnFormFooter } from '../EarnFormFooter';
import { EstimateNetworkFee } from '../EstimateNetworkFee';
import {
  type IManagePageV2ReceiveInputConfig,
  ManagePageV2ReceiveInput,
} from '../ManagePageV2ReceiveInput';
import {
  ActionPopupContent,
  EarnActionIcon,
} from '../ProtocolDetails/EarnActionIcon';
import { EarnText } from '../ProtocolDetails/EarnText';
import { usePendleTransactionDetails } from '../ProtocolDetails/PendleSharedComponents';
import {
  calcPriceImpactInfo,
  showHighPriceImpactDialog,
} from '../showHighPriceImpactDialog';
import { EStakeProgressStep, StakeProgress } from '../StakeProgress';
import {
  StakingAmountInput,
  useOnBlurAmountValue,
} from '../StakingAmountInput';
import StakingFormWrapper from '../StakingFormWrapper';
import {
  EarnFormRow,
  EarnFormSummary,
  buildRewardNoteRows,
  buildRewardsOutcome,
} from '../UniversalStake/EarnFormSummary';

import {
  getCheckAmountRequestKey,
  isLatestCheckAmountRequest,
} from './checkAmountRequestUtils';
import {
  getFreshWithdrawPathPreview,
  getWithdrawFormTips,
  getWithdrawPathPreviewKey,
  isLatestTransactionConfirmationRequest,
  selectCurrentTransactionConfirmation,
} from './transactionConfirmationRequestUtils';
import { keepWithdrawWaysOutShape } from './warmWithdrawWaysOut';
import {
  canContinueWithdrawalAfterApproval,
  getWithdrawApproveAmount,
  getWithdrawEstimateStep,
} from './withdrawAmountUtils';

import type {
  IUniversalWithdrawContext,
  IUniversalWithdrawPrepared,
} from '../../../Earn/protocols/withdrawProtocolRuntime';
import type { IEarnWithdrawApprovalIdentity } from '../../../Earn/tasks/earnWithdrawApprovalTask';
import type { IEarnWorkflowTaskStep } from '../../../Earn/tasks/earnWorkflowTaskState';
import type { IUniversalWithdrawWorkflowHandoff } from '../../earnWithdrawTask/types';
import type { IEarnActionGuard } from '../../hooks/useEarnActionGuard';
import type {
  IEarnOutcome,
  IEarnOutcomeValue,
} from '../UniversalStake/EarnFormSummary';

type IFooterActionOverride = {
  text: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

type IUniversalWithdrawProps = {
  accountAddress: string;
  balance: string;
  price: string;

  accountId?: string;
  networkId?: string;

  providerLogo?: string;
  providerName?: string;

  decimals?: number;

  initialAmount?: string;
  tokenImageUri?: string;
  tokenSymbol?: string;
  requestSymbol?: string;

  minAmount?: string;

  estimateFeeResp?: IEarnEstimateFeeResp;

  protocolVault?: string;

  identity?: string;

  isDisabled?: boolean;

  inputTitle?: string;
  offerSwitch?: ReactNode;
  actionLabel?: string;

  onConfirm?: ({
    amount,
    withdrawAll,
    signature,
    message,
    isTaskIntentCurrent,
    effectiveApy,
    useEthenaCooldown,
    resumeEthenaCooldownUnstake,
    onStepChange,
    onEthenaCooldownUnstakeReady,
    withdrawType,
    isActionCurrent,
    isSendCurrent,
    isResultCurrent,
    taskAccountAddress,
    workflowHandoff,
  }: {
    amount: string;
    withdrawAll: boolean;
    // Stakefish: signature and message for withdraw all
    signature?: string;
    message?: string;
    isTaskIntentCurrent?: () => boolean;
    effectiveApy?: string | number;
    // Pendle: Ethena cooldown path vs instant swap
    useEthenaCooldown?: boolean;
    resumeEthenaCooldownUnstake?: boolean;
    // Pendle Ethena: step change callback for multi-step progress
    onStepChange?: (step: number) => void;
    onEthenaCooldownUnstakeReady?: () => void;
    withdrawType?: IEarnWithdrawType;
    isActionCurrent?: () => boolean;
    isSendCurrent?: () => boolean;
    isResultCurrent?: () => boolean;
    taskAccountAddress?: string;
    workflowHandoff?: IUniversalWithdrawWorkflowHandoff;
    // Resolves false when the flow never started (risk disclaimer rejected), so
    // the form keeps the amount the user typed. Deliberately not
    // `boolean | void`: a caller that forgets to return the hook's result would
    // silently reset the form, which is how this shipped half-wired once.
  }) => Promise<boolean>;
  beforeFooter?: ReactElement | null;
  actionGuard?: IEarnActionGuard;
  footerActionOverride?: IFooterActionOverride;
  showApyDetail?: boolean;
  isInModalContext?: boolean;
  receiveInputConfig?: IManagePageV2ReceiveInputConfig;
  transactionInputTokenAddress?: string;
  transactionOutputTokenAddress?: string;
  isQuoteExpired?: boolean;
  onQuoteReset?: () => void;
  refreshKey?: number;
  onQuoteRefreshingChange?: (loading: boolean) => void;
  approveTarget?: {
    accountId: string;
    networkId: string;
    spenderAddress: string;
    token?: IToken;
  };
  currentAllowance?: string;
  approveType?: EApproveType;
  pendleSlippage?: number;
  initialWithdrawType?: IEarnWithdrawType;
  receiptTokenRate?: string;
  amountUnit?: IEarnAmountUnit;
  withdrawalSafetyPolicy?: 'confirm-and-revalidate';
  maxWithdrawAmountMode?: 'fixed';
  withdrawAssetsReady?: boolean;
  withdrawAssetsStatus?: 'error' | 'empty' | 'ready';
  onRetryWithdrawAssets?: () => void;
  showSingleWithdrawPath?: boolean;
  protocolInfo?: IProtocolInfo;
  tokenInfo?: IEarnTokenInfo;
};

type IWithdrawPathBox = {
  title: IEarnText;
  description: IEarnText;
  subtitle?: IEarnText;
  subtitleDescription?: IEarnText;
  withdrawType?: IEarnWithdrawType;
  disabled?: boolean;
  tip?: IEarnTransactionTip;
};

function WithdrawPathCards({
  boxes,
  selectedIndex,
  onSelect,
  disabled,
}: {
  boxes: IWithdrawPathBox[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  disabled?: boolean;
}) {
  return (
    <XStack role="radiogroup" gap="$2" flexWrap="wrap">
      {boxes.map((box, index) => {
        const isSelected = index === selectedIndex;
        const isDisabled = Boolean(box.disabled) || Boolean(disabled);
        const handlePress = () => {
          if (!isDisabled) {
            onSelect(index);
          }
        };
        return (
          <YStack
            key={`${box.withdrawType ?? ''}-${index}`}
            testID={`earn-withdraw-path-${box.withdrawType ?? index}`}
            role="radio"
            aria-checked={isSelected}
            aria-disabled={isDisabled}
            flexGrow={1}
            flexBasis={0}
            minWidth="$36"
            gap="$1"
            pl="$3"
            // The check's glyph has its own inner space, so less padding on
            // its side looks even and leaves a server title such as "Queued
            // withdrawal" its one line in a 171 px card (390 px phone)
            pr="$2"
            py="$3"
            bg={isSelected ? '$bgActive' : '$bgSubdued'}
            borderRadius="$3"
            borderCurve="continuous"
            userSelect="none"
            cursor={isDisabled ? 'not-allowed' : 'pointer'}
            opacity={box.disabled ? 0.5 : 1}
            hoverStyle={
              !isDisabled && !isSelected ? { bg: '$bgHover' } : undefined
            }
            pressStyle={!isDisabled ? { bg: '$bgActive' } : undefined}
            onPress={isDisabled ? undefined : handlePress}
            {...(isDisabled ? undefined : buildKeyboardPressProps(handlePress))}
          >
            <XStack ai="center" gap="$0.5">
              <SizableText size="$bodyMdMedium" flex={1}>
                {box.title.text}
              </SizableText>
              <Icon
                name={
                  isSelected ? 'CheckRadioSolid' : 'CirclePlaceholderOnOutline'
                }
                color={isSelected ? '$iconSuccess' : '$iconSubdued'}
                size="$4"
                flexShrink={0}
              />
            </XStack>
            {box.subtitle?.text ? (
              <SizableText size="$bodySm" color="$textSubdued">
                {box.subtitle.text}
              </SizableText>
            ) : null}
            {box.subtitleDescription?.text ? (
              <SizableText
                size="$bodySm"
                color={box.subtitleDescription.color || '$textSubdued'}
              >
                {box.subtitleDescription.text}
              </SizableText>
            ) : null}
          </YStack>
        );
      })}
    </XStack>
  );
}

function WithdrawPathCardsPlaceholder({
  boxes,
}: {
  boxes: IWithdrawPathBox[];
}) {
  return (
    <XStack gap="$2" flexWrap="wrap" aria-hidden>
      {boxes.map((box, index) => (
        <YStack
          key={index}
          flexGrow={1}
          flexBasis={0}
          minWidth="$36"
          gap="$1"
          pl="$3"
          pr="$2"
          py="$3"
          bg="$bgSubdued"
          borderRadius="$3"
          borderCurve="continuous"
        >
          <YStack h="$5" jc="center">
            <Skeleton w={96} h="$3" borderRadius="$1" />
          </YStack>
          {box.subtitle?.text ? (
            <YStack h="$4" jc="center">
              <Skeleton w={72} h="$2.5" borderRadius="$1" />
            </YStack>
          ) : null}
          {box.subtitleDescription?.text ? (
            <YStack h="$4" jc="center">
              <Skeleton w={112} h="$2.5" borderRadius="$1" />
            </YStack>
          ) : null}
        </YStack>
      ))}
    </XStack>
  );
}

const EARN_ALERT_TYPES = new Set<IAlertType>([
  'info',
  'warning',
  'critical',
  'success',
  'default',
  'danger',
  'caution',
]);

// Server-driven tip/alert color: map the string `type` (EAlertType, e.g.
// Spark's info banner for a liquidity request vs warning for the blocked range)
// onto the Alert component's IAlertType. Falls back to 'warning' for legacy tips
// that don't set a type.
function resolveEarnAlertType(type?: string): IAlertType {
  return EARN_ALERT_TYPES.has(type as IAlertType)
    ? (type as IAlertType)
    : 'warning';
}

export function UniversalWithdraw({
  accountAddress,
  balance,
  price: inputPrice,
  accountId,
  networkId,
  tokenImageUri,
  tokenSymbol,
  requestSymbol,
  providerName,
  initialAmount,
  minAmount = '0',
  decimals,
  protocolVault,
  identity,
  isDisabled,
  inputTitle,
  offerSwitch,
  actionLabel,

  onConfirm,
  beforeFooter,
  actionGuard,
  footerActionOverride,
  showApyDetail = false,
  isInModalContext = false,
  receiveInputConfig,
  transactionInputTokenAddress,
  transactionOutputTokenAddress,
  isQuoteExpired,
  onQuoteReset,
  refreshKey,
  onQuoteRefreshingChange,
  approveTarget,
  currentAllowance,
  approveType = EApproveType.Legacy,
  pendleSlippage,
  initialWithdrawType,
  receiptTokenRate,
  amountUnit,
  withdrawalSafetyPolicy,
  maxWithdrawAmountMode,
  withdrawAssetsReady,
  withdrawAssetsStatus,
  onRetryWithdrawAssets,
  showSingleWithdrawPath,
  protocolInfo,
  tokenInfo,
}: PropsWithChildren<IUniversalWithdrawProps>) {
  const intl = useIntl();
  const copy = useEarnDesktopHomeCopy();
  const pendleSellTitlesQuote = useMemo<IStakeTransactionConfirmation>(
    () => ({
      rewards: copy.pendleSellRowTitles.map((title) => ({
        title: { text: title },
        description: { text: '–' },
      })),
      transactionDetails: {
        type: 'view',
        data: {
          transactionDetails: copy.pendleSellDetailTitles.map((title) => ({
            title: { text: title },
            description: { text: '–' },
          })),
        },
      },
      tip: { type: 'info', text: { text: copy.pendleSellNote } },
    }),
    [copy],
  );
  const { isAmountFocused, onAmountFocusChange } = useAmountInputFocus();
  const navigation = useAppNavigation();
  const handleWithdrawAction = useHandleWithdraw(
    JSON.stringify([
      accountId,
      accountAddress,
      networkId,
      providerName,
      protocolVault,
    ]),
  );
  const { handleOpenWebSite } = useBrowserAction().current;
  const withdrawInputToken =
    amountUnit === 'shares'
      ? undefined
      : protocolInfo?.withdrawApprove?.inputToken;
  const inputSymbol = withdrawInputToken?.symbol ?? tokenSymbol;
  const tokenPrice = withdrawInputToken?.price ?? inputPrice;
  const price = Number(tokenPrice) > 0 ? tokenPrice : '0';
  const [loading, setLoading] = useState<boolean>(false);
  const withdrawAllRef = useRef(false);
  const [isWithdrawAll, setIsWithdrawAll] = useState(false);
  const shouldUseLiveBalanceForMax = maxWithdrawAmountMode !== 'fixed';
  const isCancelWithdrawal = initialWithdrawType === 'cancel';
  const requiresConfirmedWithdrawal = Boolean(withdrawalSafetyPolicy);
  const areWithdrawAssetsReady =
    isCancelWithdrawal ||
    amountUnit !== 'shares' ||
    (!!withdrawAssetsReady &&
      !!transactionInputTokenAddress &&
      transactionInputTokenAddress.toLowerCase() ===
        protocolInfo?.withdrawApprove?.tokenAddress?.toLowerCase());
  const [typedAmountValue, setAmountValue] = useState(
    isCancelWithdrawal ? '0' : (initialAmount ?? ''),
  );
  const amountValue = getTypedAmountValue(typedAmountValue);
  const [isEmptyHold, setIsEmptyHold] = useState(false);
  useEffect(() => {
    if (!isEmptyHold) return undefined;
    const timer = setTimeout(() => setIsEmptyHold(false), EARN_EMPTIED_HOLD_MS);
    return () => clearTimeout(timer);
  }, [isEmptyHold, typedAmountValue]);
  const amountForRequest = useMemo(() => {
    if (maxWithdrawAmountMode !== 'fixed' || isInvalidAmount(amountValue)) {
      return amountValue;
    }
    const amount = new BigNumber(amountValue);
    return amount.isFinite() ? amount.toFixed() : amountValue;
  }, [amountValue, maxWithdrawAmountMode]);
  const [selectedWithdrawPathIndex, setSelectedWithdrawPathIndex] = useState(0);
  const [claimRefreshKey, setClaimRefreshKey] = useState(0);
  // Tracks the withdraw type the user explicitly picked in the path selector.
  // Default selection always prefers the first enabled option (instant); this
  // ref lets an explicit manual choice (e.g. queued in the overlap range) win,
  // but only while a box of that type is still enabled.
  const manualWithdrawTypeRef = useRef<IEarnWithdrawType | undefined>(
    undefined,
  );
  const [withdrawProgressStep, setWithdrawProgressStep] = useState(
    EStakeProgressStep.approve,
  );
  // Keep the host page from re-entering the pre-approve state mid flow.
  const [ignoreAllowanceCheck, setIgnoreAllowanceCheck] = useState(false);
  const [pendingEthenaCooldownUnstake, setPendingEthenaCooldownUnstake] =
    useState(false);
  const ethenaCooldownCompletedRef = useRef(false);
  const [transactionConfirmationSnapshot, setTransactionConfirmation] =
    useState<IStakeTransactionConfirmation | undefined>();
  const [resolvedTransactionConfirmationRequestKey, setResolvedRequestKey] =
    useState<string>();
  const [resolvedQuoteScope, setResolvedQuoteScope] = useState<string>();
  const checkAmountRequestIdRef = useRef(0);
  const checkAmountRequestKeyRef = useRef('');
  const transactionConfirmationRequestIdRef = useRef(0);
  const transactionConfirmationRequestKeyRef = useRef('');

  const earnProtocol = useMemo(
    () => getEarnProtocol(providerName ?? ''),
    [providerName],
  );
  const {
    allowNonQueuedApproval,
    requireCurrentQuoteAfterApproval,
    enableQuoteRefresh,
    confirmPriceImpact: requiresPriceImpactConfirmation,
    action: withdrawalAction,
    transactionLayout,
  } = useMemo(() => earnProtocol.getWithdrawUiPolicy(), [earnProtocol]);
  const { skipEstimate: skipWithdrawFeeEstimate, includeTransactionIdentity } =
    useMemo(() => earnProtocol.getWithdrawFeePolicy(), [earnProtocol]);
  const isProtocolExecutedWithdraw = useMemo(
    () =>
      earnUtils.isProtocolExecutedWithdraw({
        providerName: providerName ?? '',
      }),
    [providerName],
  );
  const requiresEarnWithdrawPath = useMemo(
    () =>
      requiresConfirmedWithdrawal ||
      earnUtils.requiresEarnWithdrawPath({
        providerName: providerName ?? '',
      }),
    [requiresConfirmedWithdrawal, providerName],
  );
  const shouldSendProtocolVault = useMemo(
    () =>
      earnUtils.shouldSendEarnProtocolVault({
        providerName: providerName ?? '',
      }),
    [providerName],
  );

  const withdrawPathConfirmBoxes = useMemo(() => {
    return (
      transactionConfirmationSnapshot?.withdrawPath?.data?.confirmBoxes ?? []
    );
  }, [transactionConfirmationSnapshot?.withdrawPath?.data?.confirmBoxes]);

  const effectiveSelectedWithdrawPathIndex = useMemo(() => {
    if (withdrawPathConfirmBoxes.length <= 1) return 0;
    // Respect an explicit manual choice as long as a box of that withdraw type
    // is still enabled (keeps the selector meaningful, e.g. a user opting into
    // the queued path in the instant/queued overlap range).
    const manualType = manualWithdrawTypeRef.current;
    if (manualType) {
      const manualIndex = withdrawPathConfirmBoxes.findIndex(
        (box) => box.withdrawType === manualType && !box.disabled,
      );
      if (manualIndex >= 0) return manualIndex;
    }
    // Default: always prefer the first available option. Instant is index 0, so
    // instant wins whenever it is enabled (even when both are selectable);
    // queued is only auto-selected when instant is unavailable. Fall back to a
    // clamped index only if every option is disabled (to still show its tip).
    const firstEnabledIndex = withdrawPathConfirmBoxes.findIndex(
      (box) => !box.disabled,
    );
    if (firstEnabledIndex >= 0) return firstEnabledIndex;
    return Math.min(
      Math.max(selectedWithdrawPathIndex, 0),
      withdrawPathConfirmBoxes.length - 1,
    );
  }, [selectedWithdrawPathIndex, withdrawPathConfirmBoxes]);
  const shouldUseEthenaCooldown = earnProtocol.shouldUseEthenaCooldown({
    networkId,
    pathCount: withdrawPathConfirmBoxes.length,
    selectedPathIndex: effectiveSelectedWithdrawPathIndex,
  });

  useEffect(() => {
    if (selectedWithdrawPathIndex !== effectiveSelectedWithdrawPathIndex) {
      setSelectedWithdrawPathIndex(effectiveSelectedWithdrawPathIndex);
    }
  }, [effectiveSelectedWithdrawPathIndex, selectedWithdrawPathIndex]);

  const selectedWithdrawPath = useMemo(() => {
    if (!withdrawPathConfirmBoxes.length) return undefined;
    return (
      withdrawPathConfirmBoxes[effectiveSelectedWithdrawPathIndex] ??
      withdrawPathConfirmBoxes[0]
    );
  }, [withdrawPathConfirmBoxes, effectiveSelectedWithdrawPathIndex]);

  const selectedWithdrawType = useMemo<IEarnWithdrawType | undefined>(() => {
    if (isCancelWithdrawal) return 'cancel';
    return selectedWithdrawPath?.withdrawType;
  }, [isCancelWithdrawal, selectedWithdrawPath?.withdrawType]);

  const transactionConfirmationRequestParams = useMemo(
    () => ({
      accountId,
      accountAddress,
      actionSymbol: requestSymbol || tokenSymbol || '',
      amount: amountForRequest,
      amountUnit,
      areWithdrawAssetsReady,
      claimRefreshKey,
      identity,
      inputTokenAddress: transactionInputTokenAddress,
      isDisabled,
      networkId: networkId || '',
      outputTokenAddress: transactionOutputTokenAddress,
      provider: providerName || '',
      slippage: pendleSlippage,
      vault: shouldSendProtocolVault ? protocolVault || '' : '',
      withdrawType: selectedWithdrawType,
    }),
    [
      accountId,
      accountAddress,
      amountForRequest,
      amountUnit,
      areWithdrawAssetsReady,
      claimRefreshKey,
      identity,
      isDisabled,
      networkId,
      pendleSlippage,
      protocolVault,
      providerName,
      requestSymbol,
      selectedWithdrawType,
      shouldSendProtocolVault,
      tokenSymbol,
      transactionInputTokenAddress,
      transactionOutputTokenAddress,
    ],
  );
  const transactionConfirmationRequestKey = getWithdrawPathPreviewKey(
    transactionConfirmationRequestParams,
    selectedWithdrawType,
  );
  useLayoutEffect(() => {
    transactionConfirmationRequestKeyRef.current =
      transactionConfirmationRequestKey;
  }, [transactionConfirmationRequestKey]);

  const isEtherFiShareWithdrawal =
    amountUnit === 'shares' &&
    earnUtils.isEtherFiProvider({ providerName: providerName ?? '' });
  const quoteScope = JSON.stringify([
    accountId,
    accountAddress,
    networkId,
    providerName,
    requestSymbol || tokenSymbol || '',
    protocolVault,
    identity,
    transactionInputTokenAddress,
  ]);
  const [quoteSettlement, setQuoteSettlement] = useState<{
    key: string;
    status: 'pending' | 'succeeded' | 'failed';
  }>({ key: transactionConfirmationRequestKey, status: 'pending' });
  if (quoteSettlement.key !== transactionConfirmationRequestKey) {
    setQuoteSettlement({
      key: transactionConfirmationRequestKey,
      status: 'pending',
    });
  }
  const isTransactionConfirmationCurrent =
    resolvedTransactionConfirmationRequestKey ===
      transactionConfirmationRequestKey &&
    (!isEtherFiShareWithdrawal ||
      (quoteSettlement.key === transactionConfirmationRequestKey &&
        quoteSettlement.status === 'succeeded'));
  // Preserve the last response only to retain the selected path while loading.
  // Stale data is never rendered or submitted for providers that require it.
  const transactionConfirmation = selectCurrentTransactionConfirmation({
    snapshot: transactionConfirmationSnapshot,
    currentRequestKey: transactionConfirmationRequestKey,
    resolvedRequestKey:
      isEtherFiShareWithdrawal && !isTransactionConfirmationCurrent
        ? undefined
        : resolvedTransactionConfirmationRequestKey,
    requiresCurrentRequest: requiresEarnWithdrawPath,
  });

  const { formTip: formTransactionTip, inlinePathTip } = getWithdrawFormTips(
    transactionConfirmation,
    effectiveSelectedWithdrawPathIndex,
  );

  const isQueuedWithdraw = selectedWithdrawType === 'queued';

  const handleTipAction = useCallback(
    async (tip?: IEarnTransactionTip) => {
      const button = tip?.button ?? formTransactionTip?.button;
      if (
        button?.type !== EStakingActionType.CancelWithdrawal ||
        !protocolInfo?.earnAccount?.accountId
      ) {
        return;
      }
      await handleWithdrawAction({
        withdrawType: EStakingActionType.CancelWithdrawal,
        protocolInfo,
        tokenInfo,
        accountId: protocolInfo.earnAccount.accountId,
        networkId: protocolInfo.networkId,
        symbol: protocolInfo.symbol,
        provider: protocolInfo.provider,
      });
    },
    [formTransactionTip?.button, handleWithdrawAction, protocolInfo, tokenInfo],
  );

  // Open the explainer dialog for a `popup` tip button (e.g. Spark's "Detail"
  // on the liquidity-request info banner → "Why is a liquidity request
  // required?"). Content is fully server-driven via the popup button's data.
  const handleShowTipPopup = useCallback((button?: IEarnActionIcon) => {
    if (button?.type !== 'popup') {
      return;
    }
    Dialog.show({
      title: button.data.title?.text ?? button.text?.text ?? '',
      renderContent: (
        <ActionPopupContent
          bulletList={button.data.bulletList}
          items={button.data.items}
          panel={button.data.panel}
          description={button.data.description}
          // Dialog's Content already applies px="$5" pb="$5"; drop the
          // component's own horizontal + bottom padding to avoid doubling
          // (align body with the dialog title, no extra bottom gap). Keep the
          // top padding for a comfortable title-to-body gap.
          containerProps={{ px: '$0', pb: '$0' }}
        />
      ),
      showFooter: false,
    });
  }, []);

  // Alert action for a tip button: cancel-withdrawal keeps its existing
  // handler; a popup button opens the explainer dialog. Other/no button → no
  // action rendered.
  const buildTipAlertAction = useCallback(
    (tip?: IEarnTransactionTip) => {
      const button = tip?.button;
      if (!button) {
        return undefined;
      }
      if (button.type === EStakingActionType.CancelWithdrawal) {
        return {
          primary: button.text?.text ?? '',
          onPrimaryPress: () => {
            void handleTipAction(tip);
          },
        };
      }
      if (button.type === 'popup') {
        return {
          primary: button.text?.text ?? '',
          onPrimaryPress: () => handleShowTipPopup(button),
        };
      }
      return undefined;
    },
    [handleTipAction, handleShowTipPopup],
  );

  const approveAmountValue = useMemo(
    () =>
      getWithdrawApproveAmount({
        amount: amountForRequest,
        amountUnit,
        withdrawType: selectedWithdrawType,
        receiptTokenRate,
        decimals: approveTarget?.token?.decimals ?? decimals ?? 0,
        withdrawAll: isWithdrawAll && shouldUseLiveBalanceForMax,
      }),
    [
      amountForRequest,
      amountUnit,
      selectedWithdrawType,
      receiptTokenRate,
      approveTarget?.token?.decimals,
      decimals,
      isWithdrawAll,
      shouldUseLiveBalanceForMax,
    ],
  );

  // --- Approve logic (Pendle sell and server-declared queued withdraw) ---
  const useApprove =
    (allowNonQueuedApproval || isQueuedWithdraw) &&
    !!approveTarget?.spenderAddress;
  const [approving, setApproving] = useState(false);
  const allowanceAbortRef = useRef<AbortController | undefined>(undefined);
  const approvalAttemptRef = useRef(0);
  const withdrawalReadyRef = useRef(false);
  const sendEligibilityRef = useRef(false);
  const sendEligible = Boolean(
    !isDisabled && areWithdrawAssetsReady && !footerActionOverride,
  );
  const actionGuardRef = useRef(actionGuard);
  useLayoutEffect(() => {
    sendEligibilityRef.current = sendEligible;
    actionGuardRef.current = actionGuard;
  }, [actionGuard, sendEligible]);
  const isWithdrawalGuardAllowed = useCallback(() => {
    const guard = actionGuardRef.current;
    return guard?.isActionAllowed
      ? guard.isActionAllowed()
      : !guard?.action && !guard?.blocked;
  }, []);
  const approvalScope = JSON.stringify([
    accountId,
    accountAddress,
    networkId,
    providerName,
    protocolVault,
    identity,
    amountForRequest,
    amountUnit,
    requiresConfirmedWithdrawal,
    approveAmountValue,
    isWithdrawAll,
    maxWithdrawAmountMode,
    transactionInputTokenAddress,
    transactionOutputTokenAddress,
    selectedWithdrawType,
    approveTarget?.accountId,
    approveTarget?.networkId,
    approveTarget?.token?.address,
    approveTarget?.spenderAddress,
    approveType,
  ]);
  const approvalScopeGuard = useCommittedEarnScopeGuard(approvalScope);
  const [approvalProgress, setApprovalProgress] = useState<{
    scope: string;
    status: 'pending' | 'confirmed';
  }>();
  useLayoutEffect(() => {
    setApprovalProgress(undefined);
  }, [approvalScope]);
  const approvalTargetScope = JSON.stringify([
    accountId,
    accountAddress,
    networkId,
    providerName,
    protocolVault,
    identity,
    amountUnit,
    maxWithdrawAmountMode,
    requestSymbol,
    tokenSymbol,
    pendleSlippage,
    transactionInputTokenAddress,
    transactionOutputTokenAddress,
    selectedWithdrawType,
    effectiveSelectedWithdrawPathIndex,
    withdrawPathConfirmBoxes.length,
    requiresConfirmedWithdrawal,
    approveTarget?.accountId,
    approveTarget?.networkId,
    approveTarget?.token?.address,
    approveTarget?.token?.decimals,
    approveTarget?.token?.isNative,
    approveTarget?.spenderAddress,
    approveType,
  ]);
  const approvalTargetScopeGuard =
    useCommittedEarnScopeGuard(approvalTargetScope);
  const latestApprovalSnapshotRef = useRef({
    amountForRequest,
    approveAmountValue,
    isWithdrawAll,
    transactionConfirmationRequestKey,
    resolvedTransactionConfirmationRequestKey,
    transactionConfirmation,
  });
  useLayoutEffect(() => {
    latestApprovalSnapshotRef.current = {
      amountForRequest,
      approveAmountValue,
      isWithdrawAll,
      transactionConfirmationRequestKey,
      resolvedTransactionConfirmationRequestKey,
      transactionConfirmation,
    };
  }, [
    amountForRequest,
    approveAmountValue,
    isWithdrawAll,
    transactionConfirmationRequestKey,
    resolvedTransactionConfirmationRequestKey,
    transactionConfirmation,
  ]);
  const approvalSendScopeGuard = useCommittedEarnScopeGuard(
    JSON.stringify([
      sendEligible,
      approveTarget?.token?.decimals,
      approveTarget?.token?.isNative,
    ]),
  );
  const sendScopeGuard = useCommittedEarnScopeGuard(
    JSON.stringify([
      accountId,
      accountAddress,
      networkId,
      providerName,
      protocolVault,
      identity,
      amountUnit,
      maxWithdrawAmountMode,
      transactionInputTokenAddress,
      transactionOutputTokenAddress,
    ]),
  );
  const sendAttemptRef = useRef(0);
  const policyScopeGuard = useCommittedEarnScopeGuard(
    requiresConfirmedWithdrawal ? 'strict' : 'legacy',
  );
  const isPolicyForRenderCurrent = useCallback(
    () => policyScopeGuard.isCurrent(),
    [policyScopeGuard],
  );
  const loadingOwnerRef = useRef<
    { isPolicyCurrent: () => boolean } | undefined
  >(undefined);
  const previousRequiresConfirmedWithdrawalRef = useRef(
    requiresConfirmedWithdrawal,
  );
  const previousApprovalTargetScopeRef = useRef(approvalTargetScope);
  useEffect(() => {
    if (
      requiresConfirmedWithdrawal ||
      previousRequiresConfirmedWithdrawalRef.current ||
      previousApprovalTargetScopeRef.current !== approvalTargetScope
    ) {
      approvalAttemptRef.current += 1;
      allowanceAbortRef.current?.abort();
      setApproving(false);
    }
    if (loadingOwnerRef.current && !loadingOwnerRef.current.isPolicyCurrent()) {
      loadingOwnerRef.current = undefined;
      setLoading(false);
    }
    previousRequiresConfirmedWithdrawalRef.current =
      requiresConfirmedWithdrawal;
    previousApprovalTargetScopeRef.current = approvalTargetScope;
  }, [approvalScope, approvalTargetScope, requiresConfirmedWithdrawal]);

  const actionSymbol = useMemo(
    () => requestSymbol || tokenSymbol || '',
    [requestSymbol, tokenSymbol],
  );

  const ensureRiskAccepted = useEarnRiskWarningGate();
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId: approveTarget?.accountId ?? '',
    networkId: approveTarget?.networkId ?? '',
  });

  const {
    allowance,
    allowanceAvailable,
    allowanceError,
    retryAllowance,
    loading: loadingAllowance,
    trackAllowance,
    fetchAllowanceResponse,
  } = useTrackTokenAllowance({
    providerName: providerName ?? '',
    accountId: approveTarget?.accountId ?? '',
    networkId: approveTarget?.networkId ?? '',
    tokenAddress: approveTarget?.token?.address ?? '',
    spenderAddress: approveTarget?.spenderAddress ?? '',
    initialValue: currentAllowance,
    refreshOnMount: requiresConfirmedWithdrawal,
    retryTrackingOnError: requiresConfirmedWithdrawal,
    approveType,
  });

  const isFocus = useIsFocused();

  const needsApproval = useMemo(() => {
    if (!useApprove) return false;
    if (!isFocus) return true;
    const amountBN = new BigNumber(approveAmountValue);
    const allowanceBN = new BigNumber(allowance);
    return !amountBN.isNaN() && amountBN.gt(0) && allowanceBN.lt(amountBN);
  }, [useApprove, isFocus, approveAmountValue, allowance]);

  const shouldApprove = useMemo(
    () => needsApproval && !ignoreAllowanceCheck,
    [needsApproval, ignoreAllowanceCheck],
  );

  useEffect(
    () => () => {
      allowanceAbortRef.current?.abort();
      approvalAttemptRef.current += 1;
    },
    [],
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
      if (!useApprove || !requiredAmount) {
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
    [useApprove, fetchAllowanceResponse],
  );

  // Refs to break circular dependency: onApprove needs onPress/fetchTransactionConfirmation
  // which are defined later. Assigned after their useCallback declarations.
  const onPressRef =
    useRef<
      (
        handoff?: IUniversalWithdrawWorkflowHandoff,
        setSendCurrent?: (isCurrent: () => boolean) => void,
      ) => Promise<void>
    >(undefined);
  const fetchTransactionConfirmationRef =
    useRef<
      (amount: string) => Promise<IStakeTransactionConfirmation | undefined>
    >(undefined);

  const onApprove = useCallback(async () => {
    if (!approveTarget?.token || !approveAmountValue) return;
    const approvalToken = approveTarget.token;
    if (!isPolicyForRenderCurrent()) return;
    const isScopeCurrent = approvalScopeGuard.capture();
    const isTargetCurrent = approvalTargetScopeGuard.capture();
    const isPolicyCurrent = policyScopeGuard.capture();
    const isSendScopeCurrent = approvalSendScopeGuard.capture();
    if (
      !isScopeCurrent() ||
      !isTargetCurrent() ||
      !isPolicyCurrent() ||
      (requiresConfirmedWithdrawal &&
        (!isSendScopeCurrent() ||
          !sendEligibilityRef.current ||
          !withdrawalReadyRef.current))
    ) {
      return;
    }
    approvalAttemptRef.current += 1;
    const attempt = approvalAttemptRef.current;
    const isApprovalCurrent = () =>
      isPolicyCurrent() &&
      isTargetCurrent() &&
      approvalAttemptRef.current === attempt &&
      (!requiresConfirmedWithdrawal || isScopeCurrent());
    const isApprovalSendCurrent = () =>
      isApprovalCurrent() &&
      (!requiresConfirmedWithdrawal ||
        (isSendScopeCurrent() &&
          sendEligibilityRef.current &&
          withdrawalReadyRef.current));
    const releaseApproving = () => {
      if (isPolicyCurrent() && approvalAttemptRef.current === attempt) {
        setApproving(false);
      }
    };
    if (
      !(await ensureRiskAccepted({
        provider: providerName ?? '',
        symbol: tokenSymbol,
        networkId,
      }))
    ) {
      return;
    }
    if (
      !isApprovalSendCurrent() ||
      (requiresConfirmedWithdrawal && !isWithdrawalGuardAllowed())
    )
      return;
    Keyboard.dismiss();
    setApproving(true);
    let pendingWithoutTxid = false;
    let abortController: AbortController | undefined;
    try {
      let approveAllowance = allowance;
      try {
        const allowanceInfo = await fetchAllowanceResponse();
        approveAllowance = allowanceInfo.allowanceParsed;
      } catch (error) {
        if (requiresConfirmedWithdrawal) throw error;
      }
      if (!isApprovalSendCurrent()) return;
      const allowanceBN = new BigNumber(approveAllowance);
      const amountBN = new BigNumber(approveAmountValue);
      if (
        requiresConfirmedWithdrawal &&
        (!allowanceBN.isFinite() || allowanceBN.isNegative())
      ) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.global_an_error_occurred,
          }),
        });
        return;
      }
      if (!amountBN.isNaN() && allowanceBN.gte(amountBN)) {
        if (requiresConfirmedWithdrawal) retryAllowance();
        return;
      }
      const account = await backgroundApiProxy.serviceAccount.getAccount({
        accountId: approveTarget.accountId,
        networkId: approveTarget.networkId,
      });
      if (
        !isApprovalSendCurrent() ||
        (requiresConfirmedWithdrawal && !isWithdrawalGuardAllowed())
      )
        return;
      if (
        !accountId ||
        !networkId ||
        accountId !== approveTarget.accountId ||
        networkId !== approveTarget.networkId ||
        !accountAddress ||
        normalizeTaskAccountAddress(networkId, account.address) !==
          normalizeTaskAccountAddress(networkId, accountAddress)
      )
        throw new OneKeyLocalError('Earn withdrawal account changed');
      const config = await backgroundApiProxy.serviceStaking.getStakingConfigs({
        networkId,
        symbol: actionSymbol,
        provider: providerName ?? '',
      });
      if (!isApprovalSendCurrent()) return;
      if (!config) throw new OneKeyLocalError('Earn withdrawal config missing');
      const useEthenaCooldown = shouldUseEthenaCooldown;
      const plan = getUniversalWithdrawProtocolPlan({
        provider: providerName ?? '',
        config,
        useEthenaCooldown,
        resumeEthenaCooldownUnstake:
          useEthenaCooldown && pendingEthenaCooldownUnstake,
      });
      const taskIdentity: IEarnWithdrawApprovalIdentity = {
        accountId,
        accountAddress: account.address,
        networkId,
        provider: providerName ?? '',
        action: 'withdraw',
      };
      type IApprovalStep = Exclude<
        IEarnWorkflowTaskStep,
        { kind: 'sign' | 'external' | 'wait' }
      >;
      type IApprovalPrepared = { owner: string };
      const assertWithdrawApproval = async () => {
        if (
          !isApprovalSendCurrent() ||
          (requiresConfirmedWithdrawal && !isWithdrawalGuardAllowed())
        )
          throw new OneKeyLocalError('Earn withdrawal selection changed');
        await backgroundApiProxy.serviceStaking.assertEarnApproval({
          accountId: approveTarget.accountId,
          networkId: approveTarget.networkId,
          expectedAccountAddress: account.address,
          provider: providerName ?? '',
          symbol: protocolInfo?.symbol ?? tokenSymbol ?? '',
          vault: protocolInfo?.vault,
          action: 'unstake',
          tokenAddress: approvalToken.address,
          spenderAddress: approveTarget.spenderAddress,
        });
        const currentAccount =
          await backgroundApiProxy.serviceAccount.getAccount({
            accountId: approveTarget.accountId,
            networkId: approveTarget.networkId,
          });
        if (
          !isApprovalSendCurrent() ||
          (requiresConfirmedWithdrawal && !isWithdrawalGuardAllowed()) ||
          normalizeTaskAccountAddress(networkId, currentAccount.address) !==
            normalizeTaskAccountAddress(networkId, account.address)
        )
          throw new OneKeyLocalError('Earn withdrawal selection changed');
      };
      const confirmation = createEarnConfirmationTaskAdapter<
        IEarnWithdrawApprovalIdentity,
        IApprovalStep,
        IApprovalPrepared,
        ISendTxOnSuccessData[],
        Error
      >({
        prepare: async () => ({ owner: account.address }),
        navigate: async (prepared, callbacks) => {
          await assertWithdrawApproval();
          await navigationToTxConfirm({
            isNavigationCurrent: isApprovalSendCurrent,
            onBeforeSend: async () => {
              if (
                !isApprovalSendCurrent() ||
                (requiresConfirmedWithdrawal && !isWithdrawalGuardAllowed())
              )
                throw new OneKeyLocalError(
                  intl.formatMessage({
                    id: ETranslations.privacy_error_review_expired__msg,
                  }),
                );
              const currentAccount =
                await backgroundApiProxy.serviceAccount.getAccount({
                  accountId: approveTarget.accountId,
                  networkId: approveTarget.networkId,
                });
              if (
                !isApprovalSendCurrent() ||
                (requiresConfirmedWithdrawal && !isWithdrawalGuardAllowed()) ||
                normalizeTaskAccountAddress(
                  networkId,
                  currentAccount.address,
                ) !== normalizeTaskAccountAddress(networkId, prepared.owner)
              )
                throw new OneKeyLocalError('Earn withdrawal account changed');
              await assertWithdrawApproval();
              callbacks.onSendObserved();
            },
            approvesInfo: [
              {
                owner: prepared.owner,
                spender: approveTarget.spenderAddress,
                amount: approveAmountValue,
                tokenInfo: approveTarget.token,
              },
            ],
            onSuccess: callbacks.onSuccess,
            onLateBroadcastAccepted: (fact) => {
              if (
                fact.accountId !== approveTarget.accountId ||
                fact.networkId !== approveTarget.networkId ||
                !fact.uuid.trim() ||
                !callbacks.onLateBroadcastAccepted(fact.txid)
              )
                return;
              if (isApprovalCurrent()) {
                if (requiresConfirmedWithdrawal) {
                  setApprovalProgress({
                    scope: approvalScope,
                    status: 'pending',
                  });
                }
                trackAllowance(fact.txid);
              }
            },
            onFail: callbacks.onFail,
            onSafePreSendFail: (error) => {
              if (isApprovalCurrent()) errorToastUtils.showToastOfError(error);
            },
            onConfirmationFail: callbacks.onFail,
            onCancel: callbacks.onCancel,
          });
        },
        onSuccess: (data) => {
          if (!isApprovalCurrent()) return;
          const txid =
            data[0]?.signedTx?.txid?.trim() || data[0]?.decodedTx?.txid?.trim();
          if (!txid && requiresConfirmedWithdrawal) {
            pendingWithoutTxid = true;
            Toast.message({
              title: intl.formatMessage({ id: ETranslations.global_pending }),
            });
            return;
          }
          if (requiresConfirmedWithdrawal && txid) {
            setApprovalProgress({ scope: approvalScope, status: 'pending' });
          }
          trackAllowance(txid || data[0]?.decodedTx?.txid || '');
        },
        onObserverError: (error) => {
          defaultLogger.staking.page.permitSignError({
            error: error instanceof Error ? error.message : String(error),
          });
        },
        getTxid: (data) =>
          data[0]?.signedTx?.txid?.trim() || data[0]?.decodedTx?.txid?.trim(),
        failureCertainty: () => 'unknown',
        cancellationCertainty: () => 'unknown',
      });
      void confirmation.navigation.catch((error: unknown) => {
        defaultLogger.staking.page.permitSignError({
          error: error instanceof Error ? error.message : String(error),
        });
      });
      allowanceAbortRef.current?.abort();
      abortController = new AbortController();
      allowanceAbortRef.current = abortController;
      const taskAbort = abortController;
      let validatedSnapshot:
        | typeof latestApprovalSnapshotRef.current
        | undefined;
      let businessSendCurrent: (() => boolean) | undefined;
      const task = createEarnWithdrawApprovalTask<
        IApprovalPrepared,
        IUniversalWithdrawPrepared,
        IUniversalWithdrawContext
      >({
        taskId: generateUUID(),
        identity: taskIdentity,
        protocolSteps: plan.steps,
        initialContext: plan.initialContext,
        approval: {
          adapter: {
            ...confirmation.adapter,
            waitForFinalStatus: async ({ txid, signal }) => {
              const status = await waitForTxFinalStatus({
                accountId: approveTarget.accountId,
                networkId: approveTarget.networkId,
                txid,
                signal,
              });
              if (status === EOnChainHistoryTxStatus.Success) return 'success';
              if (status === EOnChainHistoryTxStatus.Failed) {
                if (isApprovalCurrent()) setApprovalProgress(undefined);
                return 'failed';
              }
              return 'unknown';
            },
            verify: async () => true,
          },
          handoffOnSubmit: !requiresConfirmedWithdrawal,
          allowMissingTxidAllowanceCheck: !requiresConfirmedWithdrawal,
        },
        allowanceCheck: async (signal) => {
          if (signal.aborted || !isApprovalSendCurrent()) return false;
          const snapshot = latestApprovalSnapshotRef.current;
          const requiredAmount = new BigNumber(snapshot.approveAmountValue);
          if (
            !requiredAmount.isFinite() ||
            requiredAmount.lte(0) ||
            !withdrawalReadyRef.current ||
            (requireCurrentQuoteAfterApproval &&
              snapshot.resolvedTransactionConfirmationRequestKey !==
                snapshot.transactionConfirmationRequestKey)
          )
            return false;
          const isSnapshotCurrent = () =>
            isApprovalSendCurrent() &&
            latestApprovalSnapshotRef.current === snapshot &&
            !signal.aborted;
          const canContinue = await canContinueWithdrawalAfterApproval({
            waitForAllowance: async () => {
              const allowanceReady = await waitForAllowanceAfterApprove({
                requiredAmount: snapshot.approveAmountValue,
                signal,
              });
              if (
                requiresConfirmedWithdrawal &&
                allowanceReady &&
                isSnapshotCurrent()
              ) {
                setApprovalProgress({
                  scope: approvalScope,
                  status: 'confirmed',
                });
              }
              return allowanceReady;
            },
            isCurrent: isSnapshotCurrent,
            verifyBeforeAction: requiresConfirmedWithdrawal
              ? actionGuardRef.current?.verifyBeforeAction
              : undefined,
          });
          if (
            !canContinue ||
            !isSnapshotCurrent() ||
            (requiresConfirmedWithdrawal &&
              (!withdrawalReadyRef.current || !isWithdrawalGuardAllowed()))
          )
            return false;
          validatedSnapshot = snapshot;
          return true;
        },
        prepareBusiness: async (handoff) => {
          const snapshot = validatedSnapshot;
          if (!snapshot || latestApprovalSnapshotRef.current !== snapshot)
            return;
          const guardedHandoff: IUniversalWithdrawWorkflowHandoff = {
            register: async (fragment) => {
              if (
                !isApprovalSendCurrent() ||
                latestApprovalSnapshotRef.current !== snapshot
              )
                return false;
              const started = await handoff.register(fragment);
              if (started && allowanceAbortRef.current === taskAbort)
                allowanceAbortRef.current = undefined;
              return started;
            },
          };
          await onPressRef.current?.(guardedHandoff, (isCurrent) => {
            businessSendCurrent = isCurrent;
          });
        },
        isCurrent: isApprovalCurrent,
        isCurrentAfterHandoff: () =>
          isPolicyCurrent() && (businessSendCurrent?.() ?? false),
        signal: taskAbort.signal,
        onAsyncError: (error) => errorToastUtils.showToastOfError(error),
      });
      await task.run();
    } catch (error) {
      if (isApprovalCurrent()) {
        errorToastUtils.toastIfError(error);
        errorToastUtils.showToastOfError(error);
      }
    } finally {
      if (allowanceAbortRef.current === abortController && !pendingWithoutTxid)
        allowanceAbortRef.current = undefined;
      if (!pendingWithoutTxid) releaseApproving();
    }
  }, [
    accountAddress,
    accountId,
    actionSymbol,
    allowance,
    approvalScope,
    approvalScopeGuard,
    approvalSendScopeGuard,
    approvalTargetScopeGuard,
    approveAmountValue,
    approveTarget,
    ensureRiskAccepted,
    fetchAllowanceResponse,
    intl,
    requireCurrentQuoteAfterApproval,
    shouldUseEthenaCooldown,
    isPolicyForRenderCurrent,
    isWithdrawalGuardAllowed,
    navigationToTxConfirm,
    networkId,
    pendingEthenaCooldownUnstake,
    policyScopeGuard,
    providerName,
    protocolInfo?.symbol,
    protocolInfo?.vault,
    requiresConfirmedWithdrawal,
    retryAllowance,
    tokenSymbol,
    trackAllowance,
    waitForAllowanceAfterApprove,
  ]);
  const [checkAmountMessage, setCheckoutAmountMessage] = useState('');
  const [checkAmountFetchFailed, setCheckAmountFetchFailed] = useState(false);
  const [checkAmountRetrySequence, setCheckAmountRetrySequence] = useState(0);
  const [checkAmountAlerts, setCheckAmountAlerts] = useState<
    ICheckAmountAlert[]
  >([]);

  const estimateAction = getWithdrawEstimateStep({
    requireConfirmedApproval: requiresConfirmedWithdrawal,
    assetsReady: areWithdrawAssetsReady,
    pathReady:
      isTransactionConfirmationCurrent &&
      !!selectedWithdrawType &&
      !selectedWithdrawPath?.disabled,
    withdrawType: selectedWithdrawType,
    allowanceAvailable,
    loadingAllowance,
    allowance,
    amount: approveAmountValue,
  })?.action;
  const estimateWithdrawAll = isWithdrawAll && shouldUseLiveBalanceForMax;
  const estimateFeeScopeKey = isEtherFiShareWithdrawal
    ? JSON.stringify([
        amountValue,
        amountForRequest,
        estimateAction,
        estimateWithdrawAll,
        skipWithdrawFeeEstimate,
        includeTransactionIdentity,
        isDisabled,
        accountId,
        accountAddress,
        networkId,
        providerName,
        actionSymbol,
        identity,
        protocolVault,
        shouldSendProtocolVault,
        balance,
        transactionInputTokenAddress,
        transactionOutputTokenAddress,
        selectedWithdrawType,
        isCancelWithdrawal,
        isTransactionConfirmationCurrent,
        areWithdrawAssetsReady,
        allowanceAvailable,
        loadingAllowance,
        allowance,
      ])
    : 'other-provider';
  const estimateFeeScope = useCommittedEarnScopeGuard(estimateFeeScopeKey);
  const committedEstimateFeeScope = useRef<typeof estimateFeeScope | undefined>(
    undefined,
  );
  const estimateFeeMounted = useRef(false);
  const estimateFeeRequestId = useRef(0);
  useLayoutEffect(() => {
    committedEstimateFeeScope.current = estimateFeeScope;
  }, [estimateFeeScope]);
  useEffect(() => {
    estimateFeeMounted.current = true;
    return () => {
      estimateFeeMounted.current = false;
    };
  }, []);
  const [failedEstimateFeeScope, setFailedEstimateFeeScope] =
    useState<typeof estimateFeeScope>();
  const { result: estimateFeeResult } = usePromiseResult(
    async () => {
      estimateFeeRequestId.current += 1;
      const requestId = estimateFeeRequestId.current;
      if (isEtherFiShareWithdrawal) {
        setFailedEstimateFeeScope((previous) =>
          previous === estimateFeeScope ? undefined : previous,
        );
      }
      if (
        !accountId ||
        !networkId ||
        !providerName ||
        !actionSymbol ||
        (!isCancelWithdrawal && !BigNumber(amountValue).isGreaterThan(0))
      ) {
        return { scope: estimateFeeScope, value: undefined };
      }

      if (skipWithdrawFeeEstimate) {
        return { scope: estimateFeeScope, value: undefined };
      }

      if (!estimateAction || isDisabled)
        return { scope: estimateFeeScope, value: undefined };
      const markFeeFailure = (error: unknown): never => {
        if (
          isEtherFiShareWithdrawal &&
          estimateFeeMounted.current &&
          committedEstimateFeeScope.current === estimateFeeScope &&
          estimateFeeRequestId.current === requestId
        ) {
          setFailedEstimateFeeScope(estimateFeeScope);
        }
        throw error;
      };
      const account = await backgroundApiProxy.serviceAccount
        .getAccount({
          accountId,
          networkId,
        })
        .catch(markFeeFailure);
      if (
        accountAddress &&
        normalizeTaskAccountAddress(networkId, account.address) !==
          normalizeTaskAccountAddress(networkId, accountAddress)
      )
        return { scope: estimateFeeScope, value: undefined };

      const resp = await backgroundApiProxy.serviceStaking
        .estimateFee({
          networkId,
          provider: providerName,
          symbol: actionSymbol,
          action: estimateAction,
          amount: isCancelWithdrawal ? '0' : amountForRequest || balance || '1',
          txId: includeTransactionIdentity ? identity : undefined,
          protocolVault: shouldSendProtocolVault ? protocolVault : undefined,
          identity,
          accountAddress: account.address,
          withdrawAll: estimateWithdrawAll,
          inputTokenAddress: transactionInputTokenAddress,
          outputTokenAddress: transactionOutputTokenAddress,
          withdrawType: selectedWithdrawType,
        })
        .catch(markFeeFailure);
      return { scope: estimateFeeScope, value: resp };
    },
    [
      amountValue,
      amountForRequest,
      estimateAction,
      estimateWithdrawAll,
      skipWithdrawFeeEstimate,
      includeTransactionIdentity,
      isDisabled,
      accountId,
      accountAddress,
      networkId,
      providerName,
      actionSymbol,
      identity,
      protocolVault,
      shouldSendProtocolVault,
      balance,
      transactionInputTokenAddress,
      transactionOutputTokenAddress,
      selectedWithdrawType,
      isCancelWithdrawal,
      estimateFeeScope,
      isEtherFiShareWithdrawal,
    ],
    {
      undefinedResultIfReRun: true,
      resumeOnEffectReconnect: isEtherFiShareWithdrawal,
    },
  );
  const estimateFeeResp =
    estimateFeeResult?.scope === estimateFeeScope
      ? estimateFeeResult.value
      : undefined;
  const isEstimatingFee =
    estimateFeeResult?.scope !== estimateFeeScope &&
    failedEstimateFeeScope !== estimateFeeScope;
  const [lastFeeScope, setLastFeeScope] = useState<string>();
  if (
    isTransactionConfirmationCurrent &&
    estimateFeeResp &&
    Number(estimateFeeResp.feeFiatValue) > 0 &&
    lastFeeScope !== quoteScope
  )
    setLastFeeScope(quoteScope);

  const [
    {
      currencyInfo: { symbol },
    },
  ] = useSettingsPersistAtom();

  const network = usePromiseResult(
    () =>
      backgroundApiProxy.serviceNetwork.getNetwork({
        networkId,
      }),
    [networkId],
  ).result;

  const resetAmount = useCallback(() => {
    setAmountValue(isCancelWithdrawal ? '0' : '');
    setCheckoutAmountMessage('');
    setCheckAmountAlerts([]);
    setIgnoreAllowanceCheck(false);
    setPendingEthenaCooldownUnstake(false);
    withdrawAllRef.current = false;
    setIsWithdrawAll(false);
  }, [isCancelWithdrawal]);

  const handleSelectWithdrawPath = useCallback(
    (index: number) => {
      const targetBox = withdrawPathConfirmBoxes[index];
      if (!targetBox || targetBox.disabled) {
        return;
      }
      if (index !== effectiveSelectedWithdrawPathIndex) {
        sendScopeGuard.invalidate();
      }
      // Remember the user's explicit choice so it is respected on later renders.
      manualWithdrawTypeRef.current = targetBox.withdrawType;
      setIgnoreAllowanceCheck(false);
      setPendingEthenaCooldownUnstake(false);
      setWithdrawProgressStep(EStakeProgressStep.approve);
      setSelectedWithdrawPathIndex(index);
    },
    [
      withdrawPathConfirmBoxes,
      effectiveSelectedWithdrawPathIndex,
      sendScopeGuard,
    ],
  );

  const confirmPriceImpact = useCallback(
    (resumeEthenaCooldownUnstake: boolean) => {
      if (
        !requiresPriceImpactConfirmation ||
        isCancelWithdrawal ||
        resumeEthenaCooldownUnstake
      ) {
        return true;
      }
      const payFiatValue =
        Number(amountForRequest) > 0 && Number(price) > 0
          ? new BigNumber(amountForRequest).multipliedBy(price).toFixed()
          : undefined;
      const impactInfo = calcPriceImpactInfo({
        payFiatValue,
        receiveConfig: receiveInputConfig,
        receiveDescription: transactionConfirmation?.receive,
      });
      if (!impactInfo) return true;
      return showHighPriceImpactDialog(intl, {
        percent: impactInfo.percent,
        lossAmount: `${symbol}${impactInfo.lossAmount}`,
      });
    },
    [
      amountForRequest,
      intl,
      isCancelWithdrawal,
      requiresPriceImpactConfirmation,
      price,
      receiveInputConfig,
      symbol,
      transactionConfirmation?.receive,
    ],
  );

  const onPress = useCallback(
    async (
      workflowHandoff?: IUniversalWithdrawWorkflowHandoff,
      setSendCurrent?: (isCurrent: () => boolean) => void,
    ) => {
      const isScopeCurrent = approvalScopeGuard.capture();
      const isSendScopeCurrent = sendScopeGuard.capture();
      const isPolicyCurrent = policyScopeGuard.capture();
      if (!isScopeCurrent() || !isSendScopeCurrent() || !isPolicyCurrent()) {
        return;
      }
      sendAttemptRef.current += 1;
      const sendAttempt = sendAttemptRef.current;
      const isResultCurrent =
        requiresConfirmedWithdrawal || workflowHandoff
          ? () => isSendScopeCurrent() && sendAttemptRef.current === sendAttempt
          : undefined;
      const isSendCurrent = isResultCurrent
        ? () =>
            isPolicyCurrent() &&
            isResultCurrent() &&
            sendEligibilityRef.current &&
            isWithdrawalGuardAllowed()
        : undefined;
      const isActionCurrent =
        requiresConfirmedWithdrawal || workflowHandoff
          ? () =>
              isPolicyCurrent() &&
              isScopeCurrent() &&
              withdrawalReadyRef.current &&
              isWithdrawalGuardAllowed()
          : undefined;
      setSendCurrent?.(
        isSendCurrent ?? (() => isPolicyCurrent() && isSendScopeCurrent()),
      );
      if (
        !areWithdrawAssetsReady ||
        (requiresEarnWithdrawPath &&
          (!isTransactionConfirmationCurrent || !selectedWithdrawType))
      ) {
        return;
      }
      if (!isPolicyCurrent()) return;
      const loadingOwner = { isPolicyCurrent };
      loadingOwnerRef.current = loadingOwner;
      try {
        Keyboard.dismiss();
        setLoading(true);
        ethenaCooldownCompletedRef.current = false;
        const shouldResumeEthenaCooldownUnstake =
          shouldUseEthenaCooldown && pendingEthenaCooldownUnstake;

        const priceImpactDecision = confirmPriceImpact(
          shouldResumeEthenaCooldownUnstake,
        );
        if (
          typeof priceImpactDecision === 'boolean'
            ? !priceImpactDecision
            : !(await priceImpactDecision)
        )
          return;

        if (!isPolicyCurrent() || (isActionCurrent && !isActionCurrent()))
          return;
        let workflowRegistered = false;
        const trackedHandoff: IUniversalWithdrawWorkflowHandoff | undefined =
          workflowHandoff
            ? {
                register: (fragment) => {
                  workflowRegistered = true;
                  return workflowHandoff.register(fragment);
                },
              }
            : undefined;
        const isTaskIntentCurrent = () =>
          isPolicyCurrent() &&
          isScopeCurrent() &&
          (isActionCurrent?.() ?? true);
        const started = await onConfirm?.({
          amount: isCancelWithdrawal ? '0' : amountForRequest,
          withdrawAll: withdrawAllRef.current && shouldUseLiveBalanceForMax,
          isTaskIntentCurrent,
          effectiveApy: transactionConfirmation?.effectiveApy,
          withdrawType: selectedWithdrawType,
          isActionCurrent,
          isSendCurrent,
          isResultCurrent,
          taskAccountAddress: accountAddress || undefined,
          workflowHandoff: trackedHandoff,
          useEthenaCooldown: shouldUseEthenaCooldown ? true : undefined,
          resumeEthenaCooldownUnstake: shouldResumeEthenaCooldownUnstake
            ? true
            : undefined,
          onStepChange: (step: number) => {
            setIgnoreAllowanceCheck(true);
            setWithdrawProgressStep(step);
            if (step >= EStakeProgressStep.unstake) {
              ethenaCooldownCompletedRef.current = true;
            }
          },
          onEthenaCooldownUnstakeReady: shouldUseEthenaCooldown
            ? () => {
                setIgnoreAllowanceCheck(true);
                setPendingEthenaCooldownUnstake(true);
                setWithdrawProgressStep(EStakeProgressStep.unstake);
              }
            : undefined,
        });
        if (
          started === false ||
          (workflowHandoff && !workflowRegistered) ||
          !isPolicyCurrent() ||
          (isActionCurrent && !isActionCurrent())
        ) {
          return;
        }
        if (shouldUseEthenaCooldown) {
          if (ethenaCooldownCompletedRef.current) {
            resetAmount();
            setWithdrawProgressStep(EStakeProgressStep.approve);
            onQuoteReset?.();
          }
        } else {
          resetAmount();
          setWithdrawProgressStep(EStakeProgressStep.approve);
          // Auto-refresh quote countdown after swap completes
          onQuoteReset?.();
        }
      } finally {
        if (loadingOwnerRef.current === loadingOwner) {
          loadingOwnerRef.current = undefined;
          setLoading(false);
        }
      }
    },
    [
      amountForRequest,
      requiresConfirmedWithdrawal,
      approvalScopeGuard,
      sendScopeGuard,
      policyScopeGuard,
      isWithdrawalGuardAllowed,
      areWithdrawAssetsReady,
      onConfirm,
      onQuoteReset,
      resetAmount,
      accountAddress,
      shouldUseEthenaCooldown,
      confirmPriceImpact,
      transactionConfirmation?.effectiveApy,
      pendingEthenaCooldownUnstake,
      requiresEarnWithdrawPath,
      isTransactionConfirmationCurrent,
      selectedWithdrawType,
      isCancelWithdrawal,
      shouldUseLiveBalanceForMax,
    ],
  );

  const [checkAmountLoading, setCheckAmountLoading] = useState(false);
  const [transactionConfirmationLoading, setTransactionConfirmationLoading] =
    useState(false);

  const isWithdrawPathReady =
    !requiresEarnWithdrawPath ||
    (!transactionConfirmationLoading &&
      isTransactionConfirmationCurrent &&
      !!selectedWithdrawType);

  const receiveQuoteLoading = Boolean(
    isEtherFiShareWithdrawal &&
    !isDisabled &&
    areWithdrawAssetsReady &&
    !isCancelWithdrawal &&
    !isInvalidAmount(amountForRequest) &&
    new BigNumber(amountForRequest).isGreaterThan(0) &&
    (transactionConfirmationLoading ||
      quoteSettlement.key !== transactionConfirmationRequestKey ||
      quoteSettlement.status === 'pending'),
  );
  const quoteLoading =
    checkAmountLoading || transactionConfirmationLoading || receiveQuoteLoading;

  const checkAmountRequestParams = useMemo(
    () => ({
      accountId,
      action: ECheckAmountActionType.UNSTAKING,
      amount: amountForRequest,
      identity,
      inputTokenAddress: transactionInputTokenAddress,
      networkId,
      outputTokenAddress: transactionOutputTokenAddress,
      protocolVault,
      provider: providerName,
      slippage: pendleSlippage,
      symbol: actionSymbol,
      withdrawAll: isWithdrawAll && shouldUseLiveBalanceForMax,
      withdrawType: selectedWithdrawType,
    }),
    [
      accountId,
      actionSymbol,
      amountForRequest,
      identity,
      isWithdrawAll,
      shouldUseLiveBalanceForMax,
      networkId,
      pendleSlippage,
      protocolVault,
      providerName,
      selectedWithdrawType,
      transactionInputTokenAddress,
      transactionOutputTokenAddress,
    ],
  );
  const checkAmountRequestKey = useMemo(
    () =>
      JSON.stringify([
        getCheckAmountRequestKey(checkAmountRequestParams),
        requiresConfirmedWithdrawal,
        requiresConfirmedWithdrawal ? accountAddress : undefined,
      ]),
    [accountAddress, requiresConfirmedWithdrawal, checkAmountRequestParams],
  );
  const checkAmountLifecycleKey = JSON.stringify([
    checkAmountRequestKey,
    checkAmountRetrySequence,
    isWithdrawPathReady,
    areWithdrawAssetsReady,
    isDisabled,
  ]);
  const [checkAmountSettlement, setCheckAmountSettlement] = useState({
    key: checkAmountLifecycleKey,
    settled: false,
  });
  if (checkAmountSettlement.key !== checkAmountLifecycleKey) {
    setCheckAmountSettlement({ key: checkAmountLifecycleKey, settled: false });
  }
  useLayoutEffect(() => {
    checkAmountRequestKeyRef.current = checkAmountRequestKey;
  }, [checkAmountRequestKey]);

  const debouncedCheckAmount = useDebouncedCallback(
    async ({
      requestId,
      requestKey,
      settlementKey,
      params,
    }: {
      requestId: number;
      requestKey: string;
      settlementKey: string;
      params: typeof checkAmountRequestParams;
    }) => {
      try {
        const response =
          await backgroundApiProxy.serviceStaking.checkAmount(params);
        if (
          !isLatestCheckAmountRequest({
            latestRequestId: checkAmountRequestIdRef.current,
            latestRequestKey: checkAmountRequestKeyRef.current,
            requestId,
            requestKey,
          })
        ) {
          return;
        }

        const responseCode: unknown = response.code;
        const success = requiresConfirmedWithdrawal
          ? responseCode === 0 || responseCode === '0'
          : Number(response.code) === 0;
        if (success) {
          setCheckoutAmountMessage('');
          setCheckAmountAlerts(response.data?.alerts || []);
        } else {
          setCheckoutAmountMessage(
            response.message ||
              (requiresConfirmedWithdrawal
                ? intl.formatMessage({
                    id: ETranslations.global_an_error_occurred,
                  })
                : ''),
          );
          setCheckAmountAlerts([]);
        }
      } catch (error) {
        if (!requiresConfirmedWithdrawal) throw error;
        if (
          isLatestCheckAmountRequest({
            latestRequestId: checkAmountRequestIdRef.current,
            latestRequestKey: checkAmountRequestKeyRef.current,
            requestId,
            requestKey,
          })
        ) {
          setCheckoutAmountMessage(
            intl.formatMessage({ id: ETranslations.global_an_error_occurred }),
          );
          setCheckAmountAlerts([]);
          setCheckAmountFetchFailed(true);
        }
      } finally {
        if (
          isLatestCheckAmountRequest({
            latestRequestId: checkAmountRequestIdRef.current,
            latestRequestKey: checkAmountRequestKeyRef.current,
            requestId,
            requestKey,
          })
        ) {
          setCheckAmountSettlement({ key: settlementKey, settled: true });
          setCheckAmountLoading(false);
          setCheckAmountSettlement({ key: settlementKey, settled: true });
        }
      }
    },
    300,
  );

  useEffect(() => {
    checkAmountRequestIdRef.current += 1;
    const requestId = checkAmountRequestIdRef.current;
    const requestKey = checkAmountRequestKey;
    const isCheckableAmount =
      areWithdrawAssetsReady &&
      (!requiresConfirmedWithdrawal || isWithdrawPathReady) &&
      !isDisabled &&
      !isCancelWithdrawal &&
      !isInvalidAmount(amountForRequest) &&
      new BigNumber(amountForRequest).isGreaterThan(0);

    if (!isCheckableAmount) {
      setCheckAmountLoading(false);
      setCheckoutAmountMessage('');
      setCheckAmountAlerts([]);
      setCheckAmountFetchFailed(false);
      return undefined;
    }

    setCheckAmountLoading(true);
    setCheckAmountFetchFailed(false);
    void debouncedCheckAmount({
      params: checkAmountRequestParams,
      requestId,
      requestKey,
      settlementKey: checkAmountLifecycleKey,
    });

    return () => {
      if (checkAmountRequestIdRef.current === requestId) {
        checkAmountRequestIdRef.current += 1;
      }
      debouncedCheckAmount.cancel();
    };
  }, [
    amountForRequest,
    requiresConfirmedWithdrawal,
    areWithdrawAssetsReady,
    isWithdrawPathReady,
    isDisabled,
    checkAmountRequestKey,
    checkAmountLifecycleKey,
    checkAmountRetrySequence,
    checkAmountRequestParams,
    debouncedCheckAmount,
    isCancelWithdrawal,
  ]);

  const fetchTransactionConfirmation = useCallback(
    async (amount: string, withdrawType = selectedWithdrawType) => {
      if (isDisabled || !areWithdrawAssetsReady) {
        return undefined;
      }
      const resp =
        await backgroundApiProxy.serviceStaking.getTransactionConfirmation({
          networkId: networkId || '',
          provider: providerName || '',
          symbol: actionSymbol || '',
          vault: shouldSendProtocolVault ? protocolVault || '' : '',
          accountAddress,
          action: ECheckAmountActionType.UNSTAKING,
          amount,
          identity,
          inputTokenAddress: transactionInputTokenAddress,
          outputTokenAddress: transactionOutputTokenAddress,
          slippage: pendleSlippage,
          withdrawType,
        });
      return resp;
    },
    [
      isDisabled,
      areWithdrawAssetsReady,
      accountAddress,
      protocolVault,
      shouldSendProtocolVault,
      networkId,
      providerName,
      actionSymbol,
      identity,
      transactionInputTokenAddress,
      transactionOutputTokenAddress,
      pendleSlippage,
      selectedWithdrawType,
    ],
  );

  const pathPreviewRef = useRef(
    new Map<
      string,
      { at: number; confirmation: IStakeTransactionConfirmation }
    >(),
  );
  const pendingPathPreviewRef = useRef(new Set<string>());
  useEffect(() => {
    if (
      !isTransactionConfirmationCurrent ||
      isCancelWithdrawal ||
      isDisabled ||
      !areWithdrawAssetsReady ||
      !accountId ||
      !accountAddress ||
      !networkId ||
      withdrawPathConfirmBoxes.length < 2 ||
      transactionLayout === 'market' ||
      isInvalidAmount(amountForRequest) ||
      !new BigNumber(amountForRequest).gt(0)
    )
      return undefined;
    let active = true;
    const cache = pathPreviewRef.current;
    const pending = pendingPathPreviewRef.current;
    const now = Date.now();
    cache.forEach((entry, key) => {
      if (now - entry.at >= 30_000) cache.delete(key);
    });
    withdrawPathConfirmBoxes.forEach((box) => {
      if (
        box.disabled ||
        !box.withdrawType ||
        box.withdrawType === selectedWithdrawType
      )
        return;
      const path = box.withdrawType;
      const key = getWithdrawPathPreviewKey(
        transactionConfirmationRequestParams,
        path,
      );
      if (pending.has(key) || cache.has(key)) return;
      pending.add(key);
      void fetchTransactionConfirmation(amountForRequest, path)
        .then((confirmation) => {
          if (active && confirmation)
            cache.set(key, { at: Date.now(), confirmation });
        })
        .catch(() => {
          // A failed speculative request is retried through the normal quote path.
        })
        .finally(() => pending.delete(key));
    });
    return () => {
      active = false;
    };
  }, [
    accountAddress,
    accountId,
    amountForRequest,
    areWithdrawAssetsReady,
    fetchTransactionConfirmation,
    isCancelWithdrawal,
    isDisabled,
    isTransactionConfirmationCurrent,
    networkId,
    selectedWithdrawType,
    transactionConfirmationRequestParams,
    transactionLayout,
    withdrawPathConfirmBoxes,
  ]);

  useLayoutEffect(() => {
    onPressRef.current = onPress;
    fetchTransactionConfirmationRef.current = fetchTransactionConfirmation;
  }, [fetchTransactionConfirmation, onPress]);

  const debouncedFetchTransactionConfirmation = useDebouncedCallback(
    async ({
      amount,
      requestId,
      requestKey,
      requestScope,
      withdrawType,
    }: {
      amount?: string;
      requestId: number;
      requestKey: string;
      requestScope: string;
      withdrawType?: IEarnWithdrawType;
    }) => {
      let quoteSucceeded = false;
      try {
        const resp = await fetchTransactionConfirmation(
          amount || '0',
          withdrawType,
        );
        if (
          !isLatestTransactionConfirmationRequest({
            requestId,
            requestKey,
            latestRequestId: transactionConfirmationRequestIdRef.current,
            latestRequestKey: transactionConfirmationRequestKeyRef.current,
          })
        ) {
          return;
        }
        setTransactionConfirmation(resp);
        if (
          resp &&
          amount &&
          new BigNumber(amount).gt(0) &&
          networkId &&
          providerName
        ) {
          keepWithdrawWaysOutShape({
            networkId,
            providerName,
            confirmation: resp,
          });
        }
        setResolvedRequestKey(requestKey);
        quoteSucceeded = Boolean(resp);
        if (isEtherFiShareWithdrawal)
          setResolvedQuoteScope(resp ? requestScope : undefined);
        if (resp && amount && Number(amount) > 0) {
          onQuoteReset?.();
        }
      } catch {
        // The previous snapshot remains internal and cannot enable submission.
      } finally {
        if (
          isLatestTransactionConfirmationRequest({
            requestId,
            requestKey,
            latestRequestId: transactionConfirmationRequestIdRef.current,
            latestRequestKey: transactionConfirmationRequestKeyRef.current,
          })
        ) {
          setQuoteSettlement({
            key: requestKey,
            status: quoteSucceeded ? 'succeeded' : 'failed',
          });
          setTransactionConfirmationLoading(false);
        }
      }
    },
    350,
  );

  useEffect(() => {
    transactionConfirmationRequestIdRef.current += 1;
    const requestId = transactionConfirmationRequestIdRef.current;
    // OK-59850: an empty / "0" / "0.000" field used to reach the server here.
    // isInvalidAmount only rejects NaN and a trailing dot, and the fetch itself
    // falls back to '0', so clearing the input still issued a request and lit
    // the spinner (quoteLoading covers this flag too). The server resolves the
    // withdraw path on-chain regardless of how small the amount is, so the wait
    // was real — and nothing it returns for a non-positive amount is rendered.
    // Cancelling a queued withdrawal is the one flow with no amount to enter,
    // so it still has to be quoted.
    const isQuotableAmount =
      isCancelWithdrawal ||
      (!isInvalidAmount(amountForRequest) &&
        new BigNumber(amountForRequest).isGreaterThan(0));

    if (!isQuotableAmount || !areWithdrawAssetsReady || isDisabled) {
      // Bumping the id above already invalidates anything in flight; the
      // previous run's cleanup cancelled any pending debounce.
      setTransactionConfirmationLoading(false);
      return undefined;
    }

    if (isEtherFiShareWithdrawal) {
      setQuoteSettlement({
        key: transactionConfirmationRequestKey,
        status: 'pending',
      });
    }
    setTransactionConfirmationLoading(true);
    setQuoteSettlement({
      key: transactionConfirmationRequestKey,
      status: 'pending',
    });
    void debouncedFetchTransactionConfirmation({
      amount: amountForRequest,
      requestId,
      requestKey: transactionConfirmationRequestKey,
      requestScope: quoteScope,
      withdrawType: selectedWithdrawType,
    });
    return () => {
      if (transactionConfirmationRequestIdRef.current === requestId) {
        transactionConfirmationRequestIdRef.current += 1;
      }
      debouncedFetchTransactionConfirmation.cancel();
    };
  }, [
    amountForRequest,
    areWithdrawAssetsReady,
    isDisabled,
    debouncedFetchTransactionConfirmation,
    isCancelWithdrawal,
    isEtherFiShareWithdrawal,
    selectedWithdrawType,
    transactionConfirmationRequestKey,
    quoteScope,
  ]);

  const { quoteRefreshing, handleLocalRefreshQuote } = useQuoteRefresh({
    enabled: enableQuoteRefresh,
    refreshKey,
    amountValue,
    fetchTransactionConfirmation,
    setTransactionConfirmation,
    onQuoteReset,
    onQuoteRefreshingChange,
  });

  const onChangeAmountValue = useCallback(
    (text: string, isMax = false) => {
      if (isCancelWithdrawal) {
        return;
      }
      const value = fillLeadingZero(text);
      if (!validateAmountInputForStaking(value, decimals)) {
        return;
      }
      const valueBN = new BigNumber(value);
      if (valueBN.isNaN()) {
        if (value === '') {
          sendScopeGuard.invalidate();
          // OK-59850 is handled by the checkAmount effect now: clearing the
          // field re-runs it, whose cleanup cancels the pending debounce and
          // whose non-checkable branch resets the loading state.
          setCheckoutAmountMessage('');
          setCheckAmountAlerts([]);
          setIgnoreAllowanceCheck(false);
          setPendingEthenaCooldownUnstake(false);
          setWithdrawProgressStep(EStakeProgressStep.approve);
          setIsEmptyHold(true);
          setAmountValue('');
          setIsWithdrawAll(false);
          withdrawAllRef.current = false;
        }
        return;
      }
      const isOverflowDecimals = Boolean(
        decimals &&
        Number(decimals) > 0 &&
        countDecimalPlaces(value) > decimals,
      );
      if (isOverflowDecimals) {
        setAmountValue((oldValue) => oldValue);
      } else {
        if (value !== amountValue || isMax !== isWithdrawAll) {
          sendScopeGuard.invalidate();
        }
        setIgnoreAllowanceCheck(false);
        setPendingEthenaCooldownUnstake(false);
        setWithdrawProgressStep(EStakeProgressStep.approve);
        if (valueBN.gt(0)) setIsEmptyHold(false);
        setAmountValue(value);
      }
      withdrawAllRef.current = !!isMax;
      setIsWithdrawAll(!!isMax);
    },
    [decimals, isCancelWithdrawal, amountValue, isWithdrawAll, sendScopeGuard],
  );

  const currentValue = useMemo<string | undefined>(() => {
    if (Number(amountValue) > 0 && Number(price) > 0) {
      return BigNumber(amountValue).multipliedBy(price).toFixed();
    }
    return undefined;
  }, [amountValue, price]);

  const remainingLessThanMinAmountWarning = useMemo<boolean>(() => {
    if (Number(minAmount) > 0) {
      const minAmountBN = new BigNumber(Number(minAmount));
      const amountValueBN = new BigNumber(amountValue);
      const balanceBN = new BigNumber(balance);
      if (minAmountBN.gt(0) && amountValueBN.gt(0) && balanceBN.gte(0)) {
        return (
          amountValueBN.gt(0) &&
          amountValueBN.gte(minAmountBN) &&
          balanceBN.minus(amountValueBN).gt(0) &&
          balanceBN.minus(amountValueBN).lt(minAmountBN)
        );
      }
    }
    return false;
  }, [minAmount, amountValue, balance]);
  const onBlurAmountValue = useOnBlurAmountValue(
    typedAmountValue,
    setAmountValue,
  );

  const onMax = useCallback(() => {
    onChangeAmountValue(balance, true);
  }, [onChangeAmountValue, balance]);

  const onSelectPercentageStage = useCallback(
    (percent: number) => {
      onChangeAmountValue(
        calcPercentBalance({
          balance,
          percent,
          decimals: Math.min(decimals ?? 6, 6),
        }),
      );
    },
    [balance, decimals, onChangeAmountValue],
  );

  const hasCurrentCheckAmountResult =
    !requiresConfirmedWithdrawal ||
    (checkAmountSettlement.key === checkAmountLifecycleKey &&
      checkAmountSettlement.settled);
  const isCurrentCheckAmountPending = Boolean(
    requiresConfirmedWithdrawal &&
    !isDisabled &&
    areWithdrawAssetsReady &&
    !isCancelWithdrawal &&
    isWithdrawPathReady &&
    !isInvalidAmount(amountForRequest) &&
    new BigNumber(amountForRequest).isGreaterThan(0) &&
    !hasCurrentCheckAmountResult,
  );
  const availableAmount = new BigNumber(balance);
  const isOverBalance =
    !isCancelWithdrawal &&
    !isDisabled &&
    !isInvalidAmount(amountValue) &&
    availableAmount.isFinite() &&
    availableAmount.gte(0) &&
    new BigNumber(amountValue).gt(availableAmount);
  const isCheckAmountMessageError =
    isOverBalance ||
    (hasCurrentCheckAmountResult &&
      amountValue.length > 0 &&
      !!checkAmountMessage);
  const amountErrorText = isOverBalance
    ? intl.formatMessage({ id: ETranslations.earn_insufficient_balance })
    : checkAmountMessage;
  const hasCurrentCheckAmountAlerts =
    hasCurrentCheckAmountResult && checkAmountAlerts.length > 0;

  const isDisable = useMemo<boolean>(
    () =>
      isDisabled ||
      !areWithdrawAssetsReady ||
      (requiresConfirmedWithdrawal &&
        !isCancelWithdrawal &&
        isQueuedWithdraw &&
        (!allowanceAvailable || loadingAllowance)) ||
      !!selectedWithdrawPath?.disabled ||
      (!isCancelWithdrawal &&
        (isInvalidAmount(amountValue) ||
          BigNumber(amountValue).isLessThanOrEqualTo(0))) ||
      isCheckAmountMessageError ||
      hasCurrentCheckAmountAlerts ||
      checkAmountLoading ||
      isCurrentCheckAmountPending ||
      !isWithdrawPathReady,
    [
      isDisabled,
      requiresConfirmedWithdrawal,
      areWithdrawAssetsReady,
      allowanceAvailable,
      loadingAllowance,
      amountValue,
      isCheckAmountMessageError,
      hasCurrentCheckAmountAlerts,
      checkAmountLoading,
      isCurrentCheckAmountPending,
      isCancelWithdrawal,
      isQueuedWithdraw,
      isWithdrawPathReady,
      selectedWithdrawPath?.disabled,
    ],
  );

  const withdrawalReady = Boolean(
    !isDisabled &&
    areWithdrawAssetsReady &&
    !footerActionOverride &&
    !selectedWithdrawPath?.disabled &&
    (isCancelWithdrawal ||
      (!isInvalidAmount(amountValue) &&
        new BigNumber(amountValue).isGreaterThan(0))) &&
    !isCheckAmountMessageError &&
    !hasCurrentCheckAmountAlerts &&
    !checkAmountLoading &&
    !isCurrentCheckAmountPending &&
    isWithdrawPathReady,
  );
  useLayoutEffect(() => {
    withdrawalReadyRef.current = withdrawalReady;
    if (requiresConfirmedWithdrawal && !withdrawalReady) {
      approvalSendScopeGuard.invalidate();
    }
  }, [approvalSendScopeGuard, requiresConfirmedWithdrawal, withdrawalReady]);

  const {
    isPendleLikeLayout,
    pendleAccordionItems,
    pendleTipText,
    showExpiredRefresh,
    showReceiveInput,
    effectiveReceiveInputConfig,
    receiveArrowOverlayStyle,
  } = usePendleLayoutState({
    transactionLayout,
    transactionConfirmation,
    amountValue,
    showApyDetail,
    receiveInputConfig,
    networkLogoURI: network?.logoURI,
    isQuoteExpired,
    loading: quoteLoading,
  });

  // During approve/submit flow, don't show expired refresh — the transaction is in progress.
  const isTransacting = approving || loading;
  const effectiveShowExpiredRefresh = showExpiredRefresh && !isTransacting;

  const amountInputDisabled = useMemo(() => {
    return isDisabled || initialAmount !== undefined || isCancelWithdrawal;
  }, [isDisabled, initialAmount, isCancelWithdrawal]);

  const accordionContent = useMemo(() => {
    const items: ReactElement[] = [];
    if (!isCancelWithdrawal && Number(amountValue) <= 0) {
      return items;
    }

    if (isPendleLikeLayout) {
      return pendleAccordionItems;
    }

    const showReceivePlaceholder =
      receiveQuoteLoading &&
      resolvedQuoteScope === quoteScope &&
      !!transactionConfirmationSnapshot?.receive;
    if (transactionConfirmation?.receive || showReceivePlaceholder) {
      items.push(
        <CalculationListItem key="receive">
          {showReceivePlaceholder ? (
            <>
              <XStack h="$5" ai="center">
                <Skeleton h="$3.5" w="$20" />
              </XStack>
              <XStack h="$5" ai="center">
                <Skeleton h="$3.5" w="$16" />
              </XStack>
            </>
          ) : null}
          {!showReceivePlaceholder && transactionConfirmation?.receive ? (
            <>
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
            </>
          ) : null}
        </CalculationListItem>,
      );
    }
    const showFeePlaceholder =
      isEtherFiShareWithdrawal &&
      lastFeeScope === quoteScope &&
      (receiveQuoteLoading || isEstimatingFee);
    if (
      showFeePlaceholder ||
      (estimateFeeResp &&
        (!isEtherFiShareWithdrawal || isTransactionConfirmationCurrent))
    ) {
      items.push(
        <EstimateNetworkFee
          key="network-fee"
          estimateFeeResp={estimateFeeResp}
          loading={showFeePlaceholder}
          isVisible={isCancelWithdrawal || Number(amountValue) > 0}
        />,
      );
    }
    return items;
  }, [
    amountValue,
    estimateFeeResp,
    isEtherFiShareWithdrawal,
    isTransactionConfirmationCurrent,
    isEstimatingFee,
    lastFeeScope,
    quoteScope,
    receiveQuoteLoading,
    isCancelWithdrawal,
    isPendleLikeLayout,
    pendleAccordionItems,
    transactionConfirmation?.receive,
    transactionConfirmationSnapshot?.receive,
    resolvedQuoteScope,
  ]);

  const showWithdrawPathPlaceholder =
    receiveQuoteLoading && resolvedQuoteScope === quoteScope;
  const showWithdrawPathSummary =
    (!requiresEarnWithdrawPath ||
      isTransactionConfirmationCurrent ||
      showWithdrawPathPlaceholder) &&
    (withdrawPathConfirmBoxes.length > 1 ||
      (showSingleWithdrawPath && withdrawPathConfirmBoxes.length === 1)) &&
    !!selectedWithdrawPath;
  const providerWaysOut =
    !isCancelWithdrawal &&
    !withdrawPathConfirmBoxes.length &&
    networkId &&
    providerName
      ? readFirstFrame<IWithdrawPathBox[]>(
          buildWaysOutFirstFrameKey({ networkId, providerName }),
          { orOlder: true },
        )
      : undefined;
  const waysOutStandIn =
    providerWaysOut && providerWaysOut.length > 1 ? providerWaysOut : undefined;
  const currentApprovalProgress =
    approvalProgress?.scope === approvalScope
      ? approvalProgress.status
      : undefined;
  const shouldShowPendleWithdrawProgress =
    useApprove &&
    !!amountValue &&
    !isInvalidAmount(amountValue) &&
    (shouldApprove ||
      !!currentApprovalProgress ||
      withdrawProgressStep > EStakeProgressStep.approve);
  const isEthenaCooldownWithdrawPath =
    shouldShowPendleWithdrawProgress &&
    withdrawPathConfirmBoxes.length > 1 &&
    effectiveSelectedWithdrawPathIndex === 0;
  const shouldResumeEthenaCooldownUnstake =
    isEthenaCooldownWithdrawPath && pendingEthenaCooldownUnstake;

  const confirmText = useMemo(() => {
    if (shouldApprove) {
      // One tap covers both steps when the protocol submits the redeem request
      // itself after the approve (OK-66931).
      return isProtocolExecutedWithdraw
        ? ETranslations.earn_approve_and_withdraw__action
        : ETranslations.global_approve;
    }
    if (effectiveShowExpiredRefresh) return ETranslations.global_refresh;
    if (shouldResumeEthenaCooldownUnstake) return ETranslations.defi_unstake;
    if (isCancelWithdrawal) return ETranslations.global_confirm;
    if (withdrawalAction === 'swap') return ETranslations.global_swap;
    return ETranslations.global_withdraw;
  }, [
    shouldApprove,
    isProtocolExecutedWithdraw,
    effectiveShowExpiredRefresh,
    shouldResumeEthenaCooldownUnstake,
    isCancelWithdrawal,
    withdrawalAction,
  ]);

  const onWithdrawPress = useCallback(() => {
    void onPress();
  }, [onPress]);

  const confirmOnPress = useMemo(() => {
    if (shouldApprove) return onApprove;
    if (effectiveShowExpiredRefresh) return handleLocalRefreshQuote;
    return onWithdrawPress;
  }, [
    shouldApprove,
    effectiveShowExpiredRefresh,
    onApprove,
    handleLocalRefreshQuote,
    onWithdrawPress,
  ]);

  const actionIdentity = [
    accountId,
    accountAddress,
    networkId,
    providerName,
    protocolVault,
    amountForRequest,
    transactionInputTokenAddress,
    transactionOutputTokenAddress,
    initialWithdrawType,
    effectiveSelectedWithdrawPathIndex,
    approveType,
  ].join('|');
  const confirmLoading = useMemo(() => {
    if (shouldApprove)
      return (
        loadingAllowance ||
        approving ||
        (isEtherFiShareWithdrawal &&
          (receiveQuoteLoading ||
            checkAmountLoading ||
            isCurrentCheckAmountPending))
      );
    if (effectiveShowExpiredRefresh) return quoteRefreshing;
    return (
      loading ||
      checkAmountLoading ||
      receiveQuoteLoading ||
      isCurrentCheckAmountPending ||
      (requiresEarnWithdrawPath && transactionConfirmationLoading)
    );
  }, [
    shouldApprove,
    effectiveShowExpiredRefresh,
    loadingAllowance,
    approving,
    isEtherFiShareWithdrawal,
    receiveQuoteLoading,
    isCurrentCheckAmountPending,
    quoteRefreshing,
    loading,
    checkAmountLoading,
    requiresEarnWithdrawPath,
    transactionConfirmationLoading,
  ]);

  const confirmDisabled = useMemo(() => {
    if (shouldApprove) return isDisable;
    if (effectiveShowExpiredRefresh) return false;
    return isDisable;
  }, [shouldApprove, effectiveShowExpiredRefresh, isDisable]);

  const guardedAction = useEarnActionGuard({
    action: {
      text:
        !shouldApprove &&
        !effectiveShowExpiredRefresh &&
        !shouldResumeEthenaCooldownUnstake &&
        !isCancelWithdrawal &&
        withdrawalAction === 'swap' &&
        actionLabel
          ? actionLabel
          : intl.formatMessage({ id: confirmText }),
      onPress: confirmOnPress,
      loading: confirmLoading,
      disabled: confirmDisabled,
    },
    override: footerActionOverride,
    guard: actionGuard,
    identity: actionIdentity,
  });
  const effectiveConfirmText = guardedAction.text;
  const effectiveConfirmOnPress = guardedAction.onPress;
  const effectiveConfirmLoading = Boolean(guardedAction.loading);
  const effectiveConfirmDisabled = Boolean(guardedAction.disabled);

  // Keep previously shown figures only for the same account, market, and
  // selected path while the next quote is loading. They are never executable.
  const shownQuoteRef = useRef<
    | {
        scope: string;
        path?: IEarnWithdrawType;
        confirmation: IStakeTransactionConfirmation;
      }
    | undefined
  >(undefined);
  const summaryScope = JSON.stringify([
    quoteScope,
    transactionOutputTokenAddress,
    amountUnit,
    pendleSlippage,
    claimRefreshKey,
  ]);
  useLayoutEffect(() => {
    if (
      shownQuoteRef.current &&
      (shownQuoteRef.current.scope !== summaryScope ||
        shownQuoteRef.current.path !== selectedWithdrawType)
    ) {
      shownQuoteRef.current = undefined;
    }
    if (isTransactionConfirmationCurrent && transactionConfirmation) {
      shownQuoteRef.current = {
        scope: summaryScope,
        path: selectedWithdrawType,
        confirmation: transactionConfirmation,
      };
    }
  }, [
    summaryScope,
    selectedWithdrawType,
    isTransactionConfirmationCurrent,
    transactionConfirmation,
  ]);
  const heldConfirmation =
    shownQuoteRef.current?.scope === summaryScope &&
    shownQuoteRef.current.path === selectedWithdrawType
      ? shownQuoteRef.current.confirmation
      : undefined;
  const isSummaryUpdating = Boolean(
    !isDisabled &&
    areWithdrawAssetsReady &&
    !isCancelWithdrawal &&
    !isInvalidAmount(amountValue) &&
    new BigNumber(amountValue).gt(0) &&
    (receiveQuoteLoading ||
      quoteLoading ||
      quoteSettlement.key !== transactionConfirmationRequestKey ||
      quoteSettlement.status === 'pending'),
  );
  const pathPreview = isSummaryUpdating
    ? getFreshWithdrawPathPreview(
        pathPreviewRef.current,
        transactionConfirmationRequestKey,
        Date.now(),
      )
    : undefined;
  const displayConfirmation =
    (isTransactionConfirmationCurrent ? transactionConfirmation : undefined) ??
    pathPreview ??
    (isSummaryUpdating || isEmptyHold ? heldConfirmation : undefined);
  const displaySelectedPath =
    displayConfirmation?.withdrawPath?.data?.confirmBoxes?.find(
      (box) => box.withdrawType === selectedWithdrawType,
    );

  const isPendleSell =
    isPendleLikeLayout && !isCancelWithdrawal && withdrawalAction === 'swap';
  const summaryConfirmation =
    displayConfirmation ?? (isPendleSell ? pendleSellTitlesQuote : undefined);
  const pendleDisplayRows = usePendleTransactionDetails({
    transactionConfirmation: summaryConfirmation,
    amountValue,
    isPendleLikeLayout,
    placeholder: !displayConfirmation,
  });
  const receiveLabel = intl.formatMessage({
    id: ETranslations.swap_review_you_receive,
  });
  const outcome: IEarnOutcome | undefined = isPendleLikeLayout
    ? undefined
    : {
        label: isCancelWithdrawal
          ? summaryConfirmation?.title?.text?.trim() || receiveLabel
          : receiveLabel,
        tooltip: summaryConfirmation?.tooltip,
        values: (() => {
          const values: IEarnOutcomeValue[] = [];
          const pathAmountText = displayConfirmation
            ? displaySelectedPath?.description
            : undefined;
          if (pathAmountText?.text?.trim()) {
            const pathAmount = new BigNumber(
              earnUtils.extractAmountFromText(pathAmountText),
            );
            values.push({
              main: pathAmountText.text.trim(),
              suffix:
                Number(price) > 0 && pathAmount.gt(0)
                  ? numberFormat(pathAmount.times(price).toFixed(), {
                      formatter: 'value',
                      formatterOptions: { currency: symbol },
                    })
                  : undefined,
            });
          } else if (displayConfirmation) {
            values.push(
              ...buildRewardsOutcome({
                transactionConfirmation: displayConfirmation,
                placeholderLabel: receiveLabel,
              }).values,
            );
          }
          return values;
        })(),
        isEarning: false,
      };
  let summaryFootnote: ReactNode;
  if (pendleTipText) {
    summaryFootnote = (
      <EarnText
        text={pendleTipText}
        size="$bodySm"
        color={pendleTipText.color ?? '$textInfo'}
      />
    );
  } else if (isPendleSell && !displayConfirmation) {
    summaryFootnote = (
      <EarnText
        text={pendleSellTitlesQuote.tip?.text}
        size="$bodySm"
        color="$textInfo"
      />
    );
  }
  const summaryRows = (() => {
    const rows: ReactElement[] = [];
    if (isPendleLikeLayout) {
      (summaryConfirmation?.rewards ?? []).forEach((reward, index) => {
        if (!reward.title?.text?.trim()) return;
        rows.push(
          <EarnFormRow
            key={`pendle-reward-${index}`}
            label={reward.title.text}
            tooltip={reward.tooltip}
            value={
              displayConfirmation ? (
                <EarnText
                  text={reward.description}
                  size="$bodyMdMedium"
                  textAlign="right"
                />
              ) : undefined
            }
          />,
        );
      });
      rows.push(...pendleDisplayRows);
      return rows;
    }
    rows.push(
      ...buildRewardNoteRows({
        transactionConfirmation: summaryConfirmation,
        withoutValues: !displayConfirmation,
      }),
    );
    if (
      withdrawPathConfirmBoxes.length === 1 &&
      displaySelectedPath &&
      !(
        displaySelectedPath.withdrawType === 'instant' &&
        displaySelectedPath.subtitleDescription?.color === '$textSuccess'
      )
    ) {
      rows.push(
        <EarnFormRow
          key="withdraw-path"
          label={displaySelectedPath.title.text}
          value={
            <YStack ai="flex-end">
              {displaySelectedPath.subtitle?.text ? (
                <SizableText size="$bodyMdMedium" textAlign="right">
                  {displaySelectedPath.subtitle.text}
                </SizableText>
              ) : null}
              {displaySelectedPath.subtitleDescription?.text ? (
                <SizableText
                  size="$bodySm"
                  color={
                    displaySelectedPath.subtitleDescription.color ||
                    '$textSubdued'
                  }
                  textAlign="right"
                >
                  {displaySelectedPath.subtitleDescription.text}
                </SizableText>
              ) : null}
            </YStack>
          }
        />,
      );
    }
    const liquidity = summaryConfirmation?.availableLiquidity;
    if (liquidity)
      rows.push(
        <EarnFormRow
          key="available-liquidity"
          label={liquidity.title.text}
          tooltip={liquidity.tooltip}
          value={
            <EarnText
              text={liquidity.description}
              size="$bodyMdMedium"
              textAlign="right"
            />
          }
        />,
      );
    rows.push(...accordionContent);
    if (
      !earnUtils.isLidoProvider({ providerName: providerName ?? '' }) &&
      !accordionContent.some((row) => row.key === 'network-fee')
    ) {
      rows.push(
        <EarnFormRow
          key="network-fee"
          label={intl.formatMessage({
            id: ETranslations.global_est_network_fee,
          })}
          isLoading={isSummaryUpdating}
        />,
      );
    }
    return rows;
  })();
  return (
    <StakingFormWrapper>
      <Stack position="relative">
        <YStack gap="$2">
          <Stack position="relative" opacity={amountInputDisabled ? 0.7 : 1}>
            <StakingAmountInput
              title={
                inputTitle ||
                intl.formatMessage({ id: ETranslations.global_withdraw })
              }
              disabled={amountInputDisabled}
              hasError={isCheckAmountMessageError}
              value={typedAmountValue}
              onChange={onChangeAmountValue}
              onBlur={onBlurAmountValue}
              tokenSelectorTriggerProps={{
                selectedTokenImageUri: withdrawInputToken
                  ? withdrawInputToken.logoURI
                  : tokenImageUri,
                selectedTokenSymbol: inputSymbol,
                selectedNetworkImageUri: network?.logoURI,
              }}
              inputProps={{
                placeholder: '0',
                autoFocus: !amountInputDisabled,
              }}
              balanceProps={{
                value: balance,
                iconText: intl.formatMessage({
                  id: ETranslations.global_available,
                }),
                onPress: onMax,
              }}
              valueProps={{
                value: currentValue,
                currency: symbol,
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
          <ManagePageV2ReceiveInput
            receive={transactionConfirmation?.receive}
            config={effectiveReceiveInputConfig}
            fiatSymbol={symbol}
            payFiatValue={currentValue}
            loading={
              isEtherFiShareWithdrawal ? receiveQuoteLoading : quoteLoading
            }
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

      {offerSwitch}
      {waysOutStandIn ? (
        <WithdrawPathCardsPlaceholder boxes={waysOutStandIn} />
      ) : null}
      {showWithdrawPathSummary &&
      withdrawPathConfirmBoxes.length > 1 &&
      showWithdrawPathPlaceholder ? (
        <WithdrawPathCardsPlaceholder boxes={withdrawPathConfirmBoxes} />
      ) : null}
      {showWithdrawPathSummary &&
      withdrawPathConfirmBoxes.length > 1 &&
      !showWithdrawPathPlaceholder ? (
        <WithdrawPathCards
          boxes={withdrawPathConfirmBoxes}
          selectedIndex={effectiveSelectedWithdrawPathIndex}
          onSelect={handleSelectWithdrawPath}
          disabled={Boolean(isDisabled) || showWithdrawPathPlaceholder}
        />
      ) : null}
      {isTransactionConfirmationCurrent
        ? withdrawPathConfirmBoxes.map((box, index) => {
            const claimButton = box.tip?.button;
            if (
              claimButton?.type !== EClaimType.Claim ||
              !claimButton.data ||
              !box.tip?.text ||
              !protocolInfo ||
              !tokenInfo
            )
              return null;
            const claimData = claimButton.data;
            return (
              <EarnActionIcon
                key={`claim-${box.withdrawType ?? index}`}
                actionIcon={claimButton}
                protocolInfo={{ ...protocolInfo, claimable: claimData.balance }}
                tokenInfo={tokenInfo}
                token={claimData.token.info}
                onActionSuccess={() => setClaimRefreshKey((key) => key + 1)}
                trigger={({ onPress: onClaimPress, disabled }) => (
                  <Alert
                    icon="InfoCircleOutline"
                    type={resolveEarnAlertType(box.tip?.type)}
                    renderTitle={() => (
                      <EarnText text={box.tip?.text} size="$bodyMdMedium" />
                    )}
                    action={
                      disabled
                        ? undefined
                        : {
                            primary: claimButton.text.text,
                            onPrimaryPress: onClaimPress,
                          }
                    }
                  />
                )}
              />
            );
          })
        : null}
      <HeightTransition duration={200}>
        {isCheckAmountMessageError && !checkAmountFetchFailed ? (
          <YStack pt="$2" px="$3.5">
            <SizableText
              testID="earn-amount-error"
              size="$bodyMd"
              color="$textCritical"
            >
              {amountErrorText}
            </SizableText>
          </YStack>
        ) : null}
      </HeightTransition>
      {isCheckAmountMessageError && checkAmountFetchFailed ? (
        <Alert
          icon="InfoCircleOutline"
          type="critical"
          title={amountErrorText}
          action={{
            primary: intl.formatMessage({ id: ETranslations.global_retry }),
            onPrimaryPress: () => setCheckAmountRetrySequence((n) => n + 1),
          }}
        />
      ) : null}
      {[
        { key: 'path-tip', tip: inlinePathTip },
        { key: 'form-tip', tip: formTransactionTip },
      ].map(({ key, tip }) =>
        tip?.text &&
        !(
          key === 'form-tip' &&
          pendleTipText?.text &&
          tip.text.text?.trim() === pendleTipText.text.trim() &&
          !tip.button &&
          !tip.description
        ) &&
        !(
          key === 'path-tip' &&
          isTransactionConfirmationCurrent &&
          tip.button?.type === EClaimType.Claim &&
          tip.button.data &&
          protocolInfo &&
          tokenInfo
        ) ? (
          <Alert
            key={key}
            icon="InfoCircleOutline"
            type={resolveEarnAlertType(tip.type)}
            renderTitle={() => (
              <EarnText text={tip.text} size="$bodyMdMedium" />
            )}
            descriptionComponent={
              tip.description ? (
                <EarnText
                  text={tip.description}
                  size="$bodyMd"
                  color="$textSubdued"
                />
              ) : undefined
            }
            action={buildTipAlertAction(tip)}
          />
        ) : null,
      )}

      {remainingLessThanMinAmountWarning ? (
        <Alert
          icon="InfoCircleOutline"
          type="warning"
          title={intl.formatMessage(
            { id: ETranslations.earn_unstake_all_due_to_min_withdrawal },
            { number: minAmount, symbol: inputSymbol },
          )}
        />
      ) : null}
      {hasCurrentCheckAmountAlerts ? (
        <>
          {checkAmountAlerts.map((alert, index) => (
            <Alert
              key={index}
              type={resolveEarnAlertType(alert.type)}
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
      <EarnFormSummary
        outcome={outcome}
        isLoading={isSummaryUpdating}
        isDimmed={isEmptyHold}
        rows={summaryRows}
        footnote={summaryFootnote}
      />
      {amountUnit === 'shares' &&
      !isCancelWithdrawal &&
      (withdrawAssetsStatus === 'error' || withdrawAssetsStatus === 'empty') ? (
        <Alert
          type="critical"
          title={intl.formatMessage({
            id:
              withdrawAssetsStatus === 'empty'
                ? ETranslations.global_no_data
                : ETranslations.global_an_error_occurred,
          })}
          action={{
            primary: intl.formatMessage({ id: ETranslations.global_retry }),
            onPrimaryPress: onRetryWithdrawAssets,
          }}
        />
      ) : null}
      {requiresConfirmedWithdrawal && useApprove && allowanceError ? (
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
      {beforeFooter}
      <EarnFormFooter
        isInModalContext={isInModalContext}
        progress={
          shouldShowPendleWithdrawProgress ? (
            <StakeProgress
              approveType={approveType}
              currentStep={
                currentApprovalProgress === 'pending' ||
                (shouldApprove &&
                  (isFocus || currentApprovalProgress !== 'confirmed'))
                  ? EStakeProgressStep.approve
                  : (Math.max(
                      withdrawProgressStep,
                      EStakeProgressStep.deposit,
                    ) as EStakeProgressStep)
              }
              step2LabelId={
                withdrawalAction === 'swap'
                  ? ETranslations.global_swap
                  : ETranslations.global_withdraw
              }
              step3LabelId={
                isEthenaCooldownWithdrawPath
                  ? ETranslations.defi_unstake
                  : undefined
              }
            />
          ) : null
        }
        confirmText={effectiveConfirmText}
        confirmButtonProps={{
          onPress: effectiveConfirmOnPress,
          loading: effectiveConfirmLoading,
          disabled: effectiveConfirmDisabled,
        }}
        keyboardStage={
          platformEnv.isNativeIOSPhone ? null : (
            <PercentageStageOnKeyboard
              isAmountFocused={isAmountFocused && !amountInputDisabled}
              onSelectPercentageStage={onSelectPercentageStage}
              reserveSpaceUntilKeyboardShown={!amountInputDisabled}
            />
          )
        }
      />
    </StakingFormWrapper>
  );
}
