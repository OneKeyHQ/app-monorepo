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
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IAlertType } from '@onekeyhq/components';
import {
  ANIMATE_ONLY_OPACITY,
  ANIMATE_ONLY_TRANSFORM,
} from '@onekeyhq/components/src/utils/animationConstants';
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
import { validateAmountInputForStaking } from '@onekeyhq/kit/src/utils/validateAmountInput';
import { waitForTxFinalStatus } from '@onekeyhq/kit/src/utils/waitForTxFinalStatus';
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
import { getEarnProviderDisplayName } from '@onekeyhq/shared/types/earn/earnProvider.constants';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import {
  EApproveType,
  ECheckAmountActionType,
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
  countDecimalPlaces,
  isInvalidAmount,
  shouldShowStakingSummaryCard,
} from '../../utils/utils';
import { CalculationListItem } from '../CalculationList';
import { EstimateNetworkFee } from '../EstimateNetworkFee';
import {
  type IManagePageV2ReceiveInputConfig,
  ManagePageV2ReceiveInput,
} from '../ManagePageV2ReceiveInput';
import {
  ActionPopupContent,
  EarnActionIcon,
} from '../ProtocolDetails/EarnActionIcon';
import { EarnAmountText } from '../ProtocolDetails/EarnAmountText';
import { EarnText } from '../ProtocolDetails/EarnText';
import { EarnTooltip } from '../ProtocolDetails/EarnTooltip';
import {
  PendleAccordionTriggerContent,
  PendleSummarySection,
} from '../ProtocolDetails/PendleSharedComponents';
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
  getCheckAmountRequestKey,
  isLatestCheckAmountRequest,
} from './checkAmountRequestUtils';
import {
  isLatestTransactionConfirmationRequest,
  selectCurrentTransactionConfirmation,
  shouldShowPendleSummaryTip,
} from './transactionConfirmationRequestUtils';
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
import type { FontSizeTokens } from 'tamagui';

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

const WITHDRAW_ACCORDION_KEY = 'withdraw-accordion-content';

type IWithdrawPathBox = {
  title: IEarnText;
  description: IEarnText;
  subtitle?: IEarnText;
  subtitleDescription?: IEarnText;
  withdrawType?: IEarnWithdrawType;
  disabled?: boolean;
  tip?: IEarnTransactionTip;
};

type IWithdrawPathDialogContentProps = {
  boxes: IWithdrawPathBox[];
  initialSelectedIndex: number;
  selectedIndexRef: {
    current: number;
  };
  onTipAction?: (tip: IEarnTransactionTip) => void | Promise<void>;
};

function WithdrawPathDialogContent({
  boxes,
  initialSelectedIndex,
  selectedIndexRef,
  onTipAction,
}: IWithdrawPathDialogContentProps) {
  const [selectedIndex, setSelectedIndex] = useState(initialSelectedIndex);
  const handleSelect = useCallback(
    (index: number) => {
      selectedIndexRef.current = index;
      setSelectedIndex(index);
    },
    [selectedIndexRef],
  );

  return (
    <YStack>
      {boxes.map((box, index) => {
        const isSelected = index === selectedIndex;
        const isDisabled = !!box.disabled;
        const tipAction =
          box.tip?.button?.type === EStakingActionType.CancelWithdrawal
            ? {
                primary: box.tip.button.text.text,
                onPrimaryPress: () => {
                  if (box.tip) {
                    void onTipAction?.(box.tip);
                  }
                },
              }
            : undefined;
        return (
          <YStack key={index} gap="$2">
            <XStack
              py="$2.5"
              gap="$3"
              ai="center"
              userSelect="none"
              cursor={isDisabled ? 'not-allowed' : 'pointer'}
              opacity={isDisabled ? 0.5 : 1}
              onPress={() => {
                if (isDisabled) return;
                handleSelect(index);
              }}
            >
              <Stack
                w="$5"
                h="$5"
                my="$0.5"
                borderWidth="$0.5"
                borderColor={isSelected ? '$transparent' : '$borderStrong'}
                bg={isSelected ? '$bgPrimary' : '$transparent'}
                borderRadius="$full"
                ai="center"
                jc="center"
              >
                {isSelected ? (
                  <Stack
                    w="$2.5"
                    h="$2.5"
                    bg="$iconInverse"
                    borderRadius="$full"
                  />
                ) : null}
              </Stack>
              <YStack flex={1} gap="$1">
                <SizableText size="$bodyLgMedium" color="$text">
                  {box.title.text}
                </SizableText>
                {box.subtitle?.text ? (
                  <SizableText
                    size="$bodyMd"
                    color={box.subtitle?.color || '$textSubdued'}
                  >
                    {box.subtitle.text}
                  </SizableText>
                ) : null}
              </YStack>
              {/* textAlign is required besides ai="flex-end": long i18n copy
                  wraps to multiple lines and wrapped lines default to
                  left-alignment inside the text box (OK-58722) */}
              <YStack flex={1} gap="$1" ai="flex-end">
                <EarnAmountText
                  size="$headingMd"
                  color="$text"
                  textAlign="right"
                >
                  {box.description.text}
                </EarnAmountText>
                {box.subtitleDescription?.text ? (
                  <SizableText
                    size="$bodyMd"
                    color={box.subtitleDescription?.color || '$textSubdued'}
                    textAlign="right"
                  >
                    {box.subtitleDescription.text}
                  </SizableText>
                ) : null}
              </YStack>
            </XStack>
            {box.tip?.text ? (
              <Alert
                icon="InfoCircleOutline"
                type={resolveEarnAlertType(box.tip?.type)}
                renderTitle={() => (
                  <EarnText text={box.tip?.text} size="$bodyMdMedium" />
                )}
                action={tipAction}
              />
            ) : null}
          </YStack>
        );
      })}
    </YStack>
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
  providerLogo,
  providerName,
  initialAmount,
  minAmount = '0',
  decimals,
  protocolVault,
  identity,
  isDisabled,
  inputTitle,

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
  const price = Number(inputPrice) > 0 ? inputPrice : '0';
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
  const [amountValue, setAmountValue] = useState(
    isCancelWithdrawal ? '0' : (initialAmount ?? ''),
  );
  const amountForRequest = useMemo(() => {
    if (maxWithdrawAmountMode !== 'fixed' || isInvalidAmount(amountValue)) {
      return amountValue;
    }
    const amount = new BigNumber(amountValue);
    return amount.isFinite() ? amount.toFixed() : amountValue;
  }, [amountValue, maxWithdrawAmountMode]);
  const [selectedWithdrawPathIndex, setSelectedWithdrawPathIndex] = useState(0);
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

  const transactionConfirmationRequestKey = useMemo(
    () =>
      JSON.stringify({
        accountAddress,
        actionSymbol: requestSymbol || tokenSymbol || '',
        amount: amountForRequest,
        amountUnit,
        areWithdrawAssetsReady,
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
      accountAddress,
      amountForRequest,
      amountUnit,
      areWithdrawAssetsReady,
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
  useLayoutEffect(() => {
    transactionConfirmationRequestKeyRef.current =
      transactionConfirmationRequestKey;
  }, [transactionConfirmationRequestKey]);

  const isTransactionConfirmationCurrent =
    resolvedTransactionConfirmationRequestKey ===
    transactionConfirmationRequestKey;
  // Preserve the last response only to retain the selected path while loading.
  // Stale data is never rendered or submitted for providers that require it.
  const transactionConfirmation = selectCurrentTransactionConfirmation({
    snapshot: transactionConfirmationSnapshot,
    currentRequestKey: transactionConfirmationRequestKey,
    resolvedRequestKey: resolvedTransactionConfirmationRequestKey,
    requiresCurrentRequest: requiresEarnWithdrawPath,
  });

  const rootTransactionTip = useMemo(
    () =>
      transactionConfirmation?.withdrawPath?.data?.tip ??
      transactionConfirmation?.tip,
    [
      transactionConfirmation?.tip,
      transactionConfirmation?.withdrawPath?.data?.tip,
    ],
  );
  const formTransactionTip = useMemo(
    () => (selectedWithdrawPath?.tip ? undefined : rootTransactionTip),
    [rootTransactionTip, selectedWithdrawPath?.tip],
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
      const confirmation = createEarnConfirmationTaskAdapter<
        IEarnWithdrawApprovalIdentity,
        IApprovalStep,
        IApprovalPrepared,
        ISendTxOnSuccessData[],
        Error
      >({
        prepare: async () => ({ owner: account.address }),
        navigate: async (prepared, callbacks) => {
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
              if (isApprovalCurrent()) trackAllowance(fact.txid);
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
              if (status === EOnChainHistoryTxStatus.Failed) return 'failed';
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
            waitForAllowance: () =>
              waitForAllowanceAfterApprove({
                requiredAmount: snapshot.approveAmountValue,
                signal,
              }),
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
  const { result: estimateFeeResp } = usePromiseResult(
    async () => {
      if (
        !accountId ||
        !networkId ||
        !providerName ||
        !actionSymbol ||
        (!isCancelWithdrawal && !BigNumber(amountValue).isGreaterThan(0))
      ) {
        return undefined;
      }

      if (skipWithdrawFeeEstimate) {
        return undefined;
      }

      if (!estimateAction || isDisabled) return undefined;
      const account = await backgroundApiProxy.serviceAccount.getAccount({
        accountId,
        networkId,
      });
      if (
        accountAddress &&
        normalizeTaskAccountAddress(networkId, account.address) !==
          normalizeTaskAccountAddress(networkId, accountAddress)
      )
        return undefined;

      const resp = await backgroundApiProxy.serviceStaking.estimateFee({
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
      });
      return resp;
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
    ],
    { undefinedResultIfReRun: true },
  );

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

  const quoteLoading = checkAmountLoading || transactionConfirmationLoading;

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
  useLayoutEffect(() => {
    checkAmountRequestKeyRef.current = checkAmountRequestKey;
  }, [checkAmountRequestKey]);

  const debouncedCheckAmount = useDebouncedCallback(
    async ({
      requestId,
      requestKey,
      params,
    }: {
      requestId: number;
      requestKey: string;
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
          setCheckAmountLoading(false);
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

  useLayoutEffect(() => {
    onPressRef.current = onPress;
    fetchTransactionConfirmationRef.current = fetchTransactionConfirmation;
  }, [fetchTransactionConfirmation, onPress]);

  const debouncedFetchTransactionConfirmation = useDebouncedCallback(
    async ({
      amount,
      requestId,
      requestKey,
      withdrawType,
    }: {
      amount?: string;
      requestId: number;
      requestKey: string;
      withdrawType?: IEarnWithdrawType;
    }) => {
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
        setResolvedRequestKey(requestKey);
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

    setTransactionConfirmationLoading(true);
    void debouncedFetchTransactionConfirmation({
      amount: amountForRequest,
      requestId,
      requestKey: transactionConfirmationRequestKey,
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
    selectedWithdrawType,
    transactionConfirmationRequestKey,
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
    (value: string, isMax = false) => {
      if (isCancelWithdrawal) {
        return;
      }
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
  const onBlurAmountValue = useOnBlurAmountValue(amountValue, setAmountValue);

  const onMax = useCallback(() => {
    onChangeAmountValue(balance, true);
  }, [onChangeAmountValue, balance]);

  const onSelectPercentageStage = useCallback(
    (percent: number) => {
      onChangeAmountValue(
        calcPercentBalance({
          balance,
          percent,
          decimals,
        }),
      );
    },
    [balance, decimals, onChangeAmountValue],
  );

  const isCheckAmountMessageError =
    amountValue?.length > 0 && !!checkAmountMessage;

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
      checkAmountAlerts.length > 0 ||
      checkAmountLoading ||
      !isWithdrawPathReady,
    [
      isDisabled,
      requiresConfirmedWithdrawal,
      areWithdrawAssetsReady,
      allowanceAvailable,
      loadingAllowance,
      amountValue,
      isCheckAmountMessageError,
      checkAmountAlerts.length,
      checkAmountLoading,
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
    checkAmountAlerts.length === 0 &&
    !checkAmountLoading &&
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

    if (transactionConfirmation?.receive) {
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
          estimateFeeResp={estimateFeeResp}
          isVisible={isCancelWithdrawal || Number(amountValue) > 0}
        />,
      );
    }
    return items;
  }, [
    amountValue,
    estimateFeeResp,
    isCancelWithdrawal,
    isPendleLikeLayout,
    pendleAccordionItems,
    transactionConfirmation?.receive,
  ]);
  const isAccordionTriggerDisabled = !amountValue;

  const showWithdrawPathSummary =
    (!requiresEarnWithdrawPath || isTransactionConfirmationCurrent) &&
    (withdrawPathConfirmBoxes.length > 1 ||
      (showSingleWithdrawPath && withdrawPathConfirmBoxes.length === 1)) &&
    !!selectedWithdrawPath;
  const canSelectWithdrawPath = withdrawPathConfirmBoxes.length > 1;
  const shouldShowPendleWithdrawProgress =
    useApprove &&
    !!amountValue &&
    !isInvalidAmount(amountValue) &&
    (shouldApprove || withdrawProgressStep > EStakeProgressStep.approve);
  const isEthenaCooldownWithdrawPath =
    shouldShowPendleWithdrawProgress &&
    withdrawPathConfirmBoxes.length > 1 &&
    effectiveSelectedWithdrawPathIndex === 0;
  const shouldResumeEthenaCooldownUnstake =
    isEthenaCooldownWithdrawPath && pendingEthenaCooldownUnstake;

  const showWithdrawPathDialog = useCallback(() => {
    const selectedIndexRef = {
      current: effectiveSelectedWithdrawPathIndex,
    };
    const dialogRef: {
      close?: () => Promise<void> | void;
    } = {};
    const dialog = Dialog.show({
      title:
        transactionConfirmation?.withdrawPath?.text?.text ||
        intl.formatMessage({
          id: ETranslations.defi_withdrawal_options,
        }),
      renderContent: (
        <WithdrawPathDialogContent
          boxes={withdrawPathConfirmBoxes}
          initialSelectedIndex={effectiveSelectedWithdrawPathIndex}
          selectedIndexRef={selectedIndexRef}
          onTipAction={async (tip) => {
            await dialogRef.close?.();
            await handleTipAction(tip);
          }}
        />
      ),
      onConfirm: () => {
        if (selectedIndexRef.current !== effectiveSelectedWithdrawPathIndex) {
          handleSelectWithdrawPath(selectedIndexRef.current);
        }
      },
    });
    dialogRef.close = dialog.close;
  }, [
    effectiveSelectedWithdrawPathIndex,
    handleSelectWithdrawPath,
    handleTipAction,
    intl,
    transactionConfirmation?.withdrawPath?.text?.text,
    withdrawPathConfirmBoxes,
  ]);

  const confirmText = useMemo(() => {
    if (shouldApprove) return ETranslations.global_approve;
    if (effectiveShowExpiredRefresh) return ETranslations.global_refresh;
    if (shouldResumeEthenaCooldownUnstake) return ETranslations.defi_unstake;
    if (isCancelWithdrawal) return ETranslations.global_confirm;
    if (withdrawalAction === 'swap') return ETranslations.global_swap;
    return ETranslations.global_withdraw;
  }, [
    shouldApprove,
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
    if (shouldApprove) return loadingAllowance || approving;
    if (effectiveShowExpiredRefresh) return quoteRefreshing;
    return (
      loading ||
      checkAmountLoading ||
      (requiresEarnWithdrawPath && transactionConfirmationLoading)
    );
  }, [
    shouldApprove,
    effectiveShowExpiredRefresh,
    loadingAllowance,
    approving,
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
      text: intl.formatMessage({ id: confirmText }),
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

  const shouldShowSummaryCard = shouldShowStakingSummaryCard({
    isDisabled,
    usesMarketLayout: transactionLayout === 'market',
    amountValue,
    hasSummarySection,
    showPendleTransactionSection,
  });

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
              value={amountValue}
              onChange={onChangeAmountValue}
              onBlur={onBlurAmountValue}
              tokenSelectorTriggerProps={{
                selectedTokenImageUri: tokenImageUri,
                selectedTokenSymbol: tokenSymbol,
                selectedNetworkImageUri: network?.logoURI,
              }}
              inputProps={{
                placeholder: '0',
                autoFocus: !amountInputDisabled,
              }}
              balanceProps={{
                value: balance,
                iconText: intl.formatMessage({
                  id: ETranslations.global_withdraw,
                }),
                onPress: onMax,
              }}
              valueProps={{
                value: currentValue,
                currency: currentValue ? symbol : undefined,
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

      {showWithdrawPathSummary && selectedWithdrawPath ? (
        <XStack
          borderWidth={StyleSheet.hairlineWidth}
          borderColor="$borderSubdued"
          borderRadius="$3"
          p="$3.5"
          gap="$2.5"
          ai="center"
          userSelect="none"
          cursor={canSelectWithdrawPath ? 'pointer' : undefined}
          hoverStyle={canSelectWithdrawPath ? { bg: '$bgHover' } : undefined}
          onPress={canSelectWithdrawPath ? showWithdrawPathDialog : undefined}
        >
          <YStack flex={1} gap="$1">
            <SizableText size="$bodyMdMedium" color="$text">
              {selectedWithdrawPath.title.text}
            </SizableText>
            {selectedWithdrawPath.subtitle?.text ? (
              <SizableText
                size="$bodySm"
                color={selectedWithdrawPath.subtitle?.color || '$textSubdued'}
              >
                {selectedWithdrawPath.subtitle.text}
              </SizableText>
            ) : null}
          </YStack>
          <YStack gap="$1" ai="flex-end">
            <EarnAmountText size="$bodyMdMedium" color="$text">
              {selectedWithdrawPath.description.text}
            </EarnAmountText>
            {selectedWithdrawPath.subtitleDescription?.text ? (
              <XStack ai="center">
                <SizableText
                  size="$bodySmMedium"
                  color={
                    selectedWithdrawPath.subtitleDescription?.color ||
                    '$textSubdued'
                  }
                >
                  {selectedWithdrawPath.subtitleDescription.text}
                </SizableText>
              </XStack>
            ) : null}
          </YStack>
          {canSelectWithdrawPath ? (
            <Icon
              name="ChevronRightSmallOutline"
              size="$5"
              color="$iconSubdued"
            />
          ) : null}
        </XStack>
      ) : null}

      {formTransactionTip?.text ? (
        <Alert
          icon="InfoCircleOutline"
          type={resolveEarnAlertType(formTransactionTip.type)}
          renderTitle={() => (
            <EarnText text={formTransactionTip.text} size="$bodyMdMedium" />
          )}
          descriptionComponent={
            formTransactionTip.description ? (
              <EarnText
                text={formTransactionTip.description}
                size="$bodyMd"
                color="$textSubdued"
              />
            ) : undefined
          }
          action={buildTipAlertAction(formTransactionTip)}
        />
      ) : null}

      {remainingLessThanMinAmountWarning ? (
        <Alert
          icon="InfoCircleOutline"
          type="warning"
          title={intl.formatMessage(
            { id: ETranslations.earn_unstake_all_due_to_min_withdrawal },
            { number: minAmount, symbol: tokenSymbol },
          )}
        />
      ) : null}
      {isCheckAmountMessageError ? (
        <Alert
          icon="InfoCircleOutline"
          type="critical"
          title={checkAmountMessage}
          action={
            checkAmountFetchFailed
              ? {
                  primary: intl.formatMessage({
                    id: ETranslations.global_retry,
                  }),
                  onPrimaryPress: () =>
                    setCheckAmountRetrySequence((n) => n + 1),
                }
              : undefined
          }
        />
      ) : null}
      {checkAmountAlerts.length > 0 ? (
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
      {shouldShowSummaryCard ? (
        <YStack
          p="$3.5"
          pt={hasSummarySection ? '$5' : '$3.5'}
          pb={hasSummarySection ? '$5' : '$3.5'}
          borderRadius="$3"
          borderWidth={StyleSheet.hairlineWidth}
          borderColor="$borderSubdued"
        >
          <HeightTransition>
            {showApyHeader && apyDetail ? (
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
            {hasSummarySection && usePendleSummaryLayout ? (
              <PendleSummarySection
                rewardRows={pendleRewardRows}
                tipText={
                  shouldShowPendleSummaryTip({
                    formTip: formTransactionTip,
                    transactionTip: transactionConfirmation?.tip,
                  })
                    ? pendleTipText
                    : undefined
                }
                loading={quoteLoading}
              />
            ) : null}
            {hasSummarySection && !usePendleSummaryLayout ? (
              <YStack gap="$1.5">
                <XStack ai="center" gap="$1">
                  <EarnText
                    text={transactionConfirmation?.title}
                    color="$textSubdued"
                    size="$bodyMd"
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
                {transactionConfirmation?.availableLiquidity ? (
                  // Server-driven "Available liquidity" row (e.g. Bitway:
                  // instant withdrawal is capped by the flash pool balance, so
                  // amounts above it must go through the queued path). Kept in
                  // the always-visible summary so users can see why instant
                  // withdrawal is unavailable. (OK-58353)
                  <XStack ai="center" jc="space-between" flexWrap="wrap">
                    <XStack ai="center" gap="$1">
                      <EarnText
                        text={transactionConfirmation.availableLiquidity.title}
                        color={
                          transactionConfirmation.availableLiquidity.title
                            .color ?? '$textSubdued'
                        }
                        size={
                          transactionConfirmation.availableLiquidity.title
                            .size ?? '$bodyMd'
                        }
                      />
                      {transactionConfirmation.availableLiquidity.tooltip ? (
                        <EarnTooltip
                          title={
                            transactionConfirmation.availableLiquidity.title
                              .text
                          }
                          tooltip={
                            transactionConfirmation.availableLiquidity.tooltip
                          }
                        />
                      ) : null}
                    </XStack>
                    <EarnText
                      text={
                        transactionConfirmation.availableLiquidity.description
                      }
                      size={
                        transactionConfirmation.availableLiquidity.description
                          .size ?? '$bodyMdMedium'
                      }
                      color={
                        transactionConfirmation.availableLiquidity.description
                          .color
                      }
                    />
                  </XStack>
                ) : null}
              </YStack>
            ) : null}
            {hasSummarySection && showPendleTransactionSection ? (
              <Divider my="$5" />
            ) : null}
          </HeightTransition>
          {showPendleTransactionSection ? (
            <Accordion
              overflow="hidden"
              width="100%"
              type="single"
              collapsible
              defaultValue={isPendleLikeLayout ? '' : WITHDRAW_ACCORDION_KEY}
            >
              <Accordion.Item value={WITHDRAW_ACCORDION_KEY}>
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
                    pt={accordionContent.length > 0 ? '$3.5' : '$0'}
                    gap={isPendleLikeLayout ? '$3.5' : '$2.5'}
                  >
                    {accordionContent}
                  </Accordion.Content>
                </Accordion.HeightAnimator>
              </Accordion.Item>
            </Accordion>
          ) : null}
        </YStack>
      ) : null}
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
      {shouldShowPendleWithdrawProgress ? (
        <StakeProgress
          approveType={approveType}
          currentStep={
            shouldApprove
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
      ) : null}
      {isInModalContext ? (
        <Page.Footer>
          <Page.FooterActions
            onConfirmText={effectiveConfirmText}
            confirmButtonProps={{
              onPress: effectiveConfirmOnPress,
              loading: effectiveConfirmLoading,
              disabled: effectiveConfirmDisabled,
            }}
          />
          {platformEnv.isNativeIOSPhone ? null : (
            <PercentageStageOnKeyboard
              isAmountFocused={isAmountFocused && !amountInputDisabled}
              onSelectPercentageStage={onSelectPercentageStage}
              reserveSpaceUntilKeyboardShown={!amountInputDisabled}
            />
          )}
        </Page.Footer>
      ) : (
        <YStack>
          <Page.FooterActions
            p={0}
            onConfirmText={effectiveConfirmText}
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
      )}
    </StakingFormWrapper>
  );
}
