import type { PropsWithChildren, ReactElement, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IAlertType } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  PercentageStageOnKeyboard,
  calcPercentBalance,
} from '@onekeyhq/kit/src/components/PercentageStageOnKeyboard';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { useBrowserAction } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import {
  fillLeadingZero,
  validateAmountInputForStaking,
} from '@onekeyhq/kit/src/utils/validateAmountInput';
import { EARN_DESKTOP_DEMO_COPY } from '@onekeyhq/kit/src/views/Earn/components/desktopHome/earnDesktopHomeCopy';
import { buildKeyboardPressProps } from '@onekeyhq/kit/src/views/Earn/components/desktopHome/earnDesktopPressable';
import {
  buildEmptyAmountFirstFrameKey,
  keepFirstFrame,
  readFirstFrame,
} from '@onekeyhq/kit/src/views/Earn/pages/EarnRouter/earnFirstFrameCache';
import { useEarnRiskWarningGate } from '@onekeyhq/kit/src/views/Staking/components/EarnRiskWarningDialog';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import {
  EApproveType,
  ECheckAmountActionType,
  EStakingActionType,
} from '@onekeyhq/shared/types/staking';
import type {
  ICheckAmountAlert,
  IEarnActionIcon,
  IEarnEstimateFeeResp,
  IEarnText,
  IEarnTokenInfo,
  IEarnTransactionTip,
  IEarnWithdrawType,
  IProtocolInfo,
  IStakeTransactionConfirmation,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import { useEarnSignMessageWithoutVerify } from '../../hooks/useEarnSignMessageWithoutVerify';
import { usePendleLayoutState } from '../../hooks/usePendleLayoutState';
import { useQuoteRefresh } from '../../hooks/useQuoteRefresh';
import { useTrackTokenAllowance } from '../../hooks/useUtilsHooks';
import { useHandleWithdraw } from '../../pages/ProtocolDetails/useHandleActions';
import { countDecimalPlaces, isInvalidAmount } from '../../utils/utils';
import { EstimateNetworkFee } from '../EstimateNetworkFee';
import {
  type IManagePageV2ReceiveInputConfig,
  ManagePageV2ReceiveInput,
} from '../ManagePageV2ReceiveInput';
import { ActionPopupContent } from '../ProtocolDetails/EarnActionIcon';
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
import { StakingReceiveRow } from '../UniversalStake/StakingConfirmationSummary';

import {
  getCheckAmountRequestKey,
  isLatestCheckAmountRequest,
} from './checkAmountRequestUtils';
import {
  isLatestTransactionConfirmationRequest,
  selectCurrentTransactionConfirmation,
} from './transactionConfirmationRequestUtils';

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
  // The position's protocol, named in a row under the amount box (a modal
  // for one side of a position)
  offerSwitch?: ReactNode;

  onConfirm?: ({
    amount,
    withdrawAll,
    signature,
    message,
    effectiveApy,
    useEthenaCooldown,
    resumeEthenaCooldownUnstake,
    onStepChange,
    onEthenaCooldownUnstakeReady,
    withdrawType,
  }: {
    amount: string;
    withdrawAll: boolean;
    // Stakefish: signature and message for withdraw all
    signature?: string;
    message?: string;
    effectiveApy?: string | number;
    // Pendle: Ethena cooldown path vs instant swap
    useEthenaCooldown?: boolean;
    resumeEthenaCooldownUnstake?: boolean;
    // Pendle Ethena: step change callback for multi-step progress
    onStepChange?: (step: number) => void;
    onEthenaCooldownUnstakeReady?: () => void;
    withdrawType?: IEarnWithdrawType;
    // Resolves false when the flow never started (risk disclaimer rejected), so
    // the form keeps the amount the user typed. Deliberately not
    // `boolean | void`: a caller that forgets to return the hook's result would
    // silently reset the form, which is how this shipped half-wired once.
  }) => Promise<boolean>;
  beforeFooter?: ReactElement | null;
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

// A line or a row of cards that comes with typing grows in this long
const AMOUNT_LINE_MS = 200;

// The ways out side by side, as Lido shows its two withdrawal routes: each
// card says when it pays and what it costs, in the server's words. The one
// picked is a lighter card with a check, no border, as the guide's vault
// cards; a pick only moves the check. The amount it pays shows once, in
// "You receive" under the cards
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

  onConfirm,
  beforeFooter,
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
  currentAllowance = '0',
  approveType = EApproveType.Legacy,
  pendleSlippage,
  initialWithdrawType,
  receiptTokenRate,
  protocolInfo,
  tokenInfo,
}: PropsWithChildren<IUniversalWithdrawProps>) {
  const navigation = useAppNavigation();
  const handleWithdrawAction = useHandleWithdraw();
  const { handleOpenWebSite } = useBrowserAction().current;
  const price = Number(inputPrice) > 0 ? inputPrice : '0';
  const [loading, setLoading] = useState<boolean>(false);
  const withdrawAllRef = useRef(false);
  const [isWithdrawAll, setIsWithdrawAll] = useState(false);
  const isCancelWithdrawal = initialWithdrawType === 'cancel';
  const [amountValue, setAmountValue] = useState(
    isCancelWithdrawal ? '0' : (initialAmount ?? ''),
  );
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

  // Sign message hook and refs for withdraw all signature
  const signPersonalMessage = useEarnSignMessageWithoutVerify();
  const withdrawSignatureRef = useRef<string | undefined>(undefined);
  const withdrawMessageRef = useRef<string | undefined>(undefined);
  // Only Stakefish ETH needs signature for withdraw all
  const isStakefishEthWithdraw = useMemo(
    () =>
      earnUtils.isStakefishProvider({ providerName: providerName ?? '' }) &&
      tokenSymbol?.toUpperCase() === 'ETH',
    [providerName, tokenSymbol],
  );
  const isPendleProvider = useMemo(
    () => earnUtils.isPendleProvider({ providerName: providerName ?? '' }),
    [providerName],
  );
  const requiresEarnWithdrawPath = useMemo(
    () =>
      earnUtils.requiresEarnWithdrawPath({
        providerName: providerName ?? '',
      }),
    [providerName],
  );
  const shouldSendProtocolVault = useMemo(
    () =>
      earnUtils.shouldSendEarnProtocolVault({
        providerName: providerName ?? '',
      }),
    [providerName],
  );
  const actionSymbol = useMemo(
    () => requestSymbol || tokenSymbol || '',
    [requestSymbol, tokenSymbol],
  );
  // The server's answer for an empty amount: the ways out (withdrawal paths)
  // and the rows, so they are in place before anything is typed. The last
  // answer for this position opens the form complete while it is asked again
  const emptyAmountKey = buildEmptyAmountFirstFrameKey({
    action: 'unstake',
    networkId: networkId || '',
    providerName: providerName || '',
    symbol: actionSymbol || '',
    vault: shouldSendProtocolVault ? protocolVault : undefined,
  });
  const [emptyAmountConfirmation, setEmptyAmountConfirmation] = useState<
    IStakeTransactionConfirmation | undefined
  >(() => readFirstFrame(emptyAmountKey));

  const withdrawPathConfirmBoxes = useMemo(() => {
    return (
      transactionConfirmationSnapshot?.withdrawPath?.data?.confirmBoxes ??
      emptyAmountConfirmation?.withdrawPath?.data?.confirmBoxes ??
      []
    );
  }, [
    emptyAmountConfirmation?.withdrawPath?.data?.confirmBoxes,
    transactionConfirmationSnapshot?.withdrawPath?.data?.confirmBoxes,
  ]);

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
        amount: amountValue,
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
      amountValue,
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
  transactionConfirmationRequestKeyRef.current =
    transactionConfirmationRequestKey;

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

  const approveAmountValue = useMemo(() => {
    if (!isQueuedWithdraw || !receiptTokenRate) {
      return amountValue;
    }

    const amountBN = new BigNumber(amountValue);
    const receiptTokenRateBN = new BigNumber(receiptTokenRate);
    const approveTokenDecimals =
      approveTarget?.token?.decimals ?? decimals ?? 0;
    if (
      amountBN.isNaN() ||
      amountBN.lte(0) ||
      receiptTokenRateBN.isNaN() ||
      receiptTokenRateBN.lte(0)
    ) {
      return amountValue;
    }

    const roundingMode = isWithdrawAll
      ? BigNumber.ROUND_CEIL
      : BigNumber.ROUND_FLOOR;

    // For max queued withdrawals the server spends the full receipt-token
    // balance. The displayed underlying amount may be rounded down, so ceil the
    // approval by at most one smallest receipt unit to avoid under-approving.
    return amountBN
      .multipliedBy(receiptTokenRateBN)
      .integerValue(roundingMode)
      .shiftedBy(-approveTokenDecimals)
      .toFixed();
  }, [
    amountValue,
    approveTarget?.token?.decimals,
    decimals,
    isQueuedWithdraw,
    isWithdrawAll,
    receiptTokenRate,
  ]);

  // --- Approve logic (Pendle sell and server-declared queued withdraw) ---
  const useApprove =
    (isPendleProvider || isQueuedWithdraw) && !!approveTarget?.spenderAddress;
  const [approving, setApproving] = useState(false);
  const allowanceAbortRef = useRef<AbortController | undefined>(undefined);

  const ensureRiskAccepted = useEarnRiskWarningGate();
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId: approveTarget?.accountId ?? '',
    networkId: approveTarget?.networkId ?? '',
  });

  const {
    allowance,
    loading: loadingAllowance,
    trackAllowance,
    fetchAllowanceResponse,
  } = useTrackTokenAllowance({
    accountId: approveTarget?.accountId ?? '',
    networkId: approveTarget?.networkId ?? '',
    tokenAddress: approveTarget?.token?.address ?? '',
    spenderAddress: approveTarget?.spenderAddress ?? '',
    initialValue: currentAllowance,
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
  const onPressRef = useRef<() => Promise<void>>(undefined);
  const fetchTransactionConfirmationRef =
    useRef<
      (amount: string) => Promise<IStakeTransactionConfirmation | undefined>
    >(undefined);

  const onApprove = useCallback(async () => {
    if (!approveTarget?.token || !approveAmountValue) return;
    // OK-59196: the approve transaction is the user's first on-chain action in
    // the two-step withdraw flow and never reaches useUniversalWithdraw, so the
    // one-time disclaimer has to gate it here too. Before the approving lock:
    // bailing after it would leave the button stuck loading.
    if (
      !(await ensureRiskAccepted({
        provider: providerName ?? '',
        symbol: tokenSymbol,
        networkId,
      }))
    ) {
      return;
    }
    Keyboard.dismiss();
    setApproving(true);

    let approveAllowance = allowance;
    try {
      const allowanceInfo = await fetchAllowanceResponse();
      approveAllowance = allowanceInfo.allowanceParsed;
    } catch (_e) {
      // use cached allowance
    }

    const allowanceBN = new BigNumber(approveAllowance);
    const amountBN = new BigNumber(approveAmountValue);
    if (!amountBN.isNaN() && allowanceBN.gte(amountBN)) {
      // Already approved
      setApproving(false);
      return;
    }

    const account = await backgroundApiProxy.serviceAccount.getAccount({
      accountId: approveTarget.accountId,
      networkId: approveTarget.networkId,
    });

    await navigationToTxConfirm({
      approvesInfo: [
        {
          owner: account.address,
          spender: approveTarget.spenderAddress,
          amount: approveAmountValue,
          tokenInfo: approveTarget.token,
        },
      ],
      onSuccess(data) {
        trackAllowance(data[0].decodedTx.txid);
        allowanceAbortRef.current?.abort();
        const abortController = new AbortController();
        allowanceAbortRef.current = abortController;
        void (async () => {
          try {
            const allowanceReady = await waitForAllowanceAfterApprove({
              requiredAmount: approveAmountValue,
              signal: abortController.signal,
            });
            if (!allowanceReady) {
              return;
            }
            await onPressRef.current?.();
          } finally {
            setApproving(false);
          }
        })();
      },
      onFail() {
        setApproving(false);
      },
      onCancel() {
        setApproving(false);
      },
    });
  }, [
    allowance,
    approveAmountValue,
    approveTarget,
    ensureRiskAccepted,
    networkId,
    providerName,
    tokenSymbol,
    navigationToTxConfirm,
    fetchAllowanceResponse,
    trackAllowance,
    waitForAllowanceAfterApprove,
  ]);
  const [checkAmountMessage, setCheckoutAmountMessage] = useState('');
  const [checkAmountAlerts, setCheckAmountAlerts] = useState<
    ICheckAmountAlert[]
  >([]);

  const { result: estimateFeeResp } = usePromiseResult(async () => {
    if (
      !accountId ||
      !networkId ||
      !providerName ||
      !actionSymbol ||
      (!isCancelWithdrawal && !BigNumber(amountValue).isGreaterThan(0))
    ) {
      return undefined;
    }

    if (earnUtils.isLidoProvider({ providerName })) {
      return undefined;
    }

    const account = await backgroundApiProxy.serviceAccount.getAccount({
      accountId,
      networkId,
    });

    const resp = await backgroundApiProxy.serviceStaking.estimateFee({
      networkId,
      provider: providerName,
      symbol: actionSymbol,
      action: 'unstake',
      amount: isCancelWithdrawal ? '0' : amountValue || balance || '1',
      txId: earnUtils.isBabylonProvider({ providerName })
        ? identity
        : undefined,
      protocolVault: shouldSendProtocolVault ? protocolVault : undefined,
      identity,
      accountAddress: account.address,
      withdrawAll: withdrawAllRef.current,
      inputTokenAddress: transactionInputTokenAddress,
      outputTokenAddress: transactionOutputTokenAddress,
      withdrawType: selectedWithdrawType,
    });
    return resp;
  }, [
    amountValue,
    accountId,
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
  ]);

  const [
    {
      currencyInfo: { symbol },
    },
  ] = useSettingsPersistAtom();

  const intl = useIntl();

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
    // Reset withdraw signature and message
    withdrawSignatureRef.current = undefined;
    withdrawMessageRef.current = undefined;
  }, [isCancelWithdrawal]);

  const handleSelectWithdrawPath = useCallback(
    (index: number) => {
      const targetBox = withdrawPathConfirmBoxes[index];
      if (!targetBox || targetBox.disabled) {
        return;
      }
      // Remember the user's explicit choice so it is respected on later renders.
      manualWithdrawTypeRef.current = targetBox.withdrawType;
      setIgnoreAllowanceCheck(false);
      setPendingEthenaCooldownUnstake(false);
      setWithdrawProgressStep(EStakeProgressStep.approve);
      setSelectedWithdrawPathIndex(index);
    },
    [withdrawPathConfirmBoxes],
  );

  const onPress = useCallback(async () => {
    if (
      requiresEarnWithdrawPath &&
      (!isTransactionConfirmationCurrent || !selectedWithdrawType)
    ) {
      return;
    }
    try {
      Keyboard.dismiss();
      setLoading(true);
      ethenaCooldownCompletedRef.current = false;
      const shouldUseEthenaCooldown =
        isPendleProvider &&
        networkId === getNetworkIdsMap().eth &&
        withdrawPathConfirmBoxes.length > 1 &&
        effectiveSelectedWithdrawPathIndex === 0;
      const shouldResumeEthenaCooldownUnstake =
        shouldUseEthenaCooldown && pendingEthenaCooldownUnstake;

      // Get signature for withdraw all (Stakefish ETH)
      if (
        isStakefishEthWithdraw &&
        withdrawAllRef.current &&
        !withdrawSignatureRef.current
      ) {
        try {
          const { signature, message } = await signPersonalMessage({
            networkId: networkId || '',
            accountId: accountId || '',
            provider: providerName || '',
            symbol: actionSymbol || '',
            action: 'unstake',
            identity,
          });
          withdrawSignatureRef.current = signature;
          withdrawMessageRef.current = message;
        } catch (error) {
          console.error('Stakefish withdraw sign error:', error);
          setLoading(false);
          return;
        }
      }

      // Check high price impact (Pendle only)
      if (
        isPendleProvider &&
        !isCancelWithdrawal &&
        !shouldResumeEthenaCooldownUnstake
      ) {
        const payFiatValue =
          Number(amountValue) > 0 && Number(price) > 0
            ? new BigNumber(amountValue).multipliedBy(price).toFixed()
            : undefined;
        const impactInfo = calcPriceImpactInfo({
          payFiatValue,
          receiveConfig: receiveInputConfig,
          receiveDescription: transactionConfirmation?.receive,
        });
        if (impactInfo) {
          const userConfirmed = await showHighPriceImpactDialog(intl, {
            percent: impactInfo.percent,
            lossAmount: `${symbol}${impactInfo.lossAmount}`,
          });
          if (!userConfirmed) return;
        }
      }

      const started = await onConfirm?.({
        amount: isCancelWithdrawal ? '0' : amountValue,
        withdrawAll: withdrawAllRef.current,
        signature: withdrawSignatureRef.current,
        message: withdrawMessageRef.current,
        effectiveApy: transactionConfirmation?.effectiveApy,
        withdrawType: selectedWithdrawType,
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
      if (started === false) {
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
      setLoading(false);
    }
  }, [
    amountValue,
    onConfirm,
    onQuoteReset,
    resetAmount,
    isStakefishEthWithdraw,
    signPersonalMessage,
    networkId,
    accountId,
    providerName,
    actionSymbol,
    identity,
    isPendleProvider,
    withdrawPathConfirmBoxes.length,
    effectiveSelectedWithdrawPathIndex,
    intl,
    symbol,
    price,
    receiveInputConfig,
    transactionConfirmation?.effectiveApy,
    transactionConfirmation?.receive,
    pendingEthenaCooldownUnstake,
    requiresEarnWithdrawPath,
    isTransactionConfirmationCurrent,
    selectedWithdrawType,
    isCancelWithdrawal,
  ]);

  const [checkAmountLoading, setCheckAmountLoading] = useState(false);
  const [transactionConfirmationLoading, setTransactionConfirmationLoading] =
    useState(false);

  const isWithdrawPathReady = earnUtils.isEarnWithdrawPathReady({
    providerName: providerName ?? '',
    isLoading:
      transactionConfirmationLoading ||
      (requiresEarnWithdrawPath && !isTransactionConfirmationCurrent),
    withdrawType: selectedWithdrawType,
  });

  const quoteLoading = checkAmountLoading || transactionConfirmationLoading;

  const checkAmountRequestParams = useMemo(
    () => ({
      accountId,
      action: ECheckAmountActionType.UNSTAKING,
      amount: amountValue,
      identity,
      inputTokenAddress: transactionInputTokenAddress,
      networkId,
      outputTokenAddress: transactionOutputTokenAddress,
      protocolVault,
      provider: providerName,
      slippage: pendleSlippage,
      symbol: actionSymbol,
      withdrawAll: isWithdrawAll,
      withdrawType: selectedWithdrawType,
    }),
    [
      accountId,
      actionSymbol,
      amountValue,
      identity,
      isWithdrawAll,
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
    () => getCheckAmountRequestKey(checkAmountRequestParams),
    [checkAmountRequestParams],
  );
  checkAmountRequestKeyRef.current = checkAmountRequestKey;

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

        if (Number(response.code) === 0) {
          setCheckoutAmountMessage('');
          setCheckAmountAlerts(response.data?.alerts || []);
        } else {
          setCheckoutAmountMessage(response.message);
          setCheckAmountAlerts([]);
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
      !isCancelWithdrawal &&
      !isInvalidAmount(amountValue) &&
      new BigNumber(amountValue).isGreaterThan(0);

    if (!isCheckableAmount) {
      setCheckAmountLoading(false);
      setCheckoutAmountMessage('');
      setCheckAmountAlerts([]);
      return undefined;
    }

    setCheckAmountLoading(true);
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
    amountValue,
    checkAmountRequestKey,
    checkAmountRequestParams,
    debouncedCheckAmount,
    isCancelWithdrawal,
  ]);

  const fetchTransactionConfirmation = useCallback(
    async (amount: string, withdrawType = selectedWithdrawType) => {
      if (isDisabled) {
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

  // Keep refs in sync for onApprove's async onSuccess handler
  onPressRef.current = onPress;
  fetchTransactionConfirmationRef.current = fetchTransactionConfirmation;

  // Asked once per position, apart from the amount's own quote (which skips
  // an empty amount, OK-59850): nothing waits on it and no spinner shows
  useEffect(() => {
    if (isDisabled || isCancelWithdrawal) {
      return undefined;
    }
    let cancelled = false;
    backgroundApiProxy.serviceStaking
      .getTransactionConfirmation({
        networkId: networkId || '',
        provider: providerName || '',
        symbol: actionSymbol || '',
        vault: shouldSendProtocolVault ? protocolVault || '' : '',
        accountAddress,
        action: ECheckAmountActionType.UNSTAKING,
        amount: '0',
        identity,
        inputTokenAddress: transactionInputTokenAddress,
        outputTokenAddress: transactionOutputTokenAddress,
      })
      .then((resp) => {
        if (!cancelled) {
          setEmptyAmountConfirmation(resp);
          keepFirstFrame(emptyAmountKey, resp);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [
    accountAddress,
    actionSymbol,
    emptyAmountKey,
    identity,
    isCancelWithdrawal,
    isDisabled,
    networkId,
    protocolVault,
    providerName,
    shouldSendProtocolVault,
    transactionInputTokenAddress,
    transactionOutputTokenAddress,
  ]);

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
      (!isInvalidAmount(amountValue) &&
        new BigNumber(amountValue).isGreaterThan(0));

    if (!isQuotableAmount) {
      // Bumping the id above already invalidates anything in flight; the
      // previous run's cleanup cancelled any pending debounce.
      setTransactionConfirmationLoading(false);
      return undefined;
    }

    setTransactionConfirmationLoading(true);
    void debouncedFetchTransactionConfirmation({
      amount: amountValue,
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
    amountValue,
    debouncedFetchTransactionConfirmation,
    isCancelWithdrawal,
    selectedWithdrawType,
    transactionConfirmationRequestKey,
  ]);

  const { quoteRefreshing, handleLocalRefreshQuote } = useQuoteRefresh({
    enabled: isPendleProvider,
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
        setIgnoreAllowanceCheck(false);
        setPendingEthenaCooldownUnstake(false);
        setWithdrawProgressStep(EStakeProgressStep.approve);
        setAmountValue(value);
      }
      withdrawAllRef.current = !!isMax;
      setIsWithdrawAll(!!isMax);
    },
    [decimals, isCancelWithdrawal],
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
      amountValue,
      isCheckAmountMessageError,
      checkAmountAlerts.length,
      checkAmountLoading,
      isCancelWithdrawal,
      isWithdrawPathReady,
      selectedWithdrawPath?.disabled,
    ],
  );

  const {
    isPendleLikeLayout,
    pendleTipText,
    showExpiredRefresh,
    showReceiveInput,
    effectiveReceiveInputConfig,
    receiveArrowOverlayStyle,
  } = usePendleLayoutState({
    providerName: providerName ?? '',
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

  const isPositiveAmount =
    !isInvalidAmount(amountValue) && new BigNumber(amountValue).gt(0);
  // With no amount the rows keep their places, each value a dash
  const isRowsPlaceholder = !isCancelWithdrawal && !isPositiveAmount;
  const lastConfirmationRef = useRef<IStakeTransactionConfirmation | undefined>(
    undefined,
  );
  if (transactionConfirmation) {
    lastConfirmationRef.current = transactionConfirmation;
  }
  // What the rows show: this amount's answer; until it is in (a provider
  // whose path must be current shows none stale), the last rows with dashes
  const isAnswerMissing = !isRowsPlaceholder && !transactionConfirmation;
  const rowsConfirmation =
    isRowsPlaceholder || isAnswerMissing
      ? (lastConfirmationRef.current ?? emptyAmountConfirmation)
      : transactionConfirmation;
  const showDashes = isRowsPlaceholder || isAnswerMissing;
  const isQuoteUpdating = isPositiveAmount && quoteLoading;

  const pendleDetailRows = usePendleTransactionDetails({
    transactionConfirmation: rowsConfirmation,
    amountValue,
    isPendleLikeLayout,
    placeholder: showDashes,
  });

  // The result: what reaches the wallet, by the chosen way out where there
  // are ways to choose. Pendle's second box already says it
  const youReceiveLabel = intl.formatMessage({
    id: ETranslations.swap_review_you_receive,
  });
  let outcome: IEarnOutcome | undefined;
  if (!isPendleLikeLayout) {
    const values: IEarnOutcomeValue[] = [];
    const pathAmountText = selectedWithdrawPath?.description;
    if (!showDashes && pathAmountText?.text?.trim()) {
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
    } else if (!showDashes) {
      values.push(
        ...buildRewardsOutcome({
          transactionConfirmation: rowsConfirmation,
          placeholderLabel: youReceiveLabel,
        }).values,
      );
    }
    outcome = {
      // Cancelling a queued withdrawal keeps the server's own words
      label: isCancelWithdrawal
        ? rowsConfirmation?.title?.text?.trim() || youReceiveLabel
        : youReceiveLabel,
      tooltip: rowsConfirmation?.tooltip,
      values,
      isEarning: false,
    };
  }

  // Lido has no fee estimate for a withdrawal
  const isLidoWithdraw = earnUtils.isLidoProvider({
    providerName: providerName ?? '',
  });
  const summaryRows = useMemo(() => {
    const items: ReactElement[] = [];
    if (isPendleLikeLayout) {
      (rowsConfirmation?.rewards ?? [])
        .filter(
          (reward) =>
            !!reward?.title?.text?.trim() &&
            !!reward?.description?.text?.trim(),
        )
        .forEach((reward, index) => {
          items.push(
            <EarnFormRow
              key={`pendle-reward-${index}`}
              label={reward.title.text}
              tooltip={reward.tooltip}
              value={
                showDashes ? undefined : (
                  <EarnText
                    text={reward.description}
                    size="$bodyMdMedium"
                    textAlign="right"
                  />
                )
              }
            />,
          );
        });
      items.push(...pendleDetailRows);
      return items;
    }
    // Lines of the result that are not amounts ("Claim available in 4 days")
    items.push(
      ...buildRewardNoteRows({
        transactionConfirmation: rowsConfirmation,
        withoutValues: showDashes,
      }),
    );
    // One way out: when it pays and what it costs, under the result
    if (withdrawPathConfirmBoxes.length === 1 && selectedWithdrawPath) {
      items.push(
        <EarnFormRow
          key="withdraw-path"
          label={selectedWithdrawPath.title.text}
          value={
            <YStack ai="flex-end">
              {selectedWithdrawPath.subtitle?.text ? (
                <SizableText size="$bodyMdMedium" textAlign="right">
                  {selectedWithdrawPath.subtitle.text}
                </SizableText>
              ) : null}
              {selectedWithdrawPath.subtitleDescription?.text ? (
                <SizableText
                  size="$bodySm"
                  color={
                    selectedWithdrawPath.subtitleDescription.color ||
                    '$textSubdued'
                  }
                  textAlign="right"
                >
                  {selectedWithdrawPath.subtitleDescription.text}
                </SizableText>
              ) : null}
            </YStack>
          }
        />,
      );
    }
    // Why an instant withdrawal may not cover the amount (Bitway's flash
    // pool, Spark's liquidity), OK-58353
    const liquidity = rowsConfirmation?.availableLiquidity;
    if (liquidity) {
      items.push(
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
    }
    const receive = rowsConfirmation?.receive;
    if (receive) {
      items.push(
        <StakingReceiveRow
          key="receive"
          receive={
            showDashes
              ? {
                  ...receive,
                  description: { text: '–', color: '$textDisabled' },
                }
              : receive
          }
        />,
      );
    }
    // The row hides itself on a zero estimate, so that counts as none
    if (
      estimateFeeResp &&
      Number(estimateFeeResp.feeFiatValue) > 0 &&
      (isCancelWithdrawal || isPositiveAmount)
    ) {
      items.push(
        <EstimateNetworkFee
          key="network-fee"
          estimateFeeResp={estimateFeeResp}
          isVisible
        />,
      );
    } else if (!isLidoWithdraw) {
      // Held in place until this amount's estimate is in, so the button
      // doesn't move on the first digit
      items.push(
        <EarnFormRow
          key="network-fee-placeholder"
          label={intl.formatMessage({
            id: ETranslations.global_est_network_fee,
          })}
        />,
      );
    }
    return items;
  }, [
    estimateFeeResp,
    intl,
    isLidoWithdraw,
    isCancelWithdrawal,
    isPendleLikeLayout,
    isPositiveAmount,
    pendleDetailRows,
    rowsConfirmation,
    selectedWithdrawPath,
    showDashes,
    withdrawPathConfirmBoxes.length,
  ]);

  const showWithdrawPathCards =
    withdrawPathConfirmBoxes.length > 1 && !!selectedWithdrawPath;
  // Cards there from the first frame (a kept answer) show at once
  const [hasPathCardsFromStart] = useState(showWithdrawPathCards);
  // The steps show once pressed: the button already names them
  const isWithdrawRunning =
    approving || loading || withdrawProgressStep > EStakeProgressStep.approve;
  const shouldShowPendleWithdrawProgress =
    useApprove &&
    !!amountValue &&
    !isInvalidAmount(amountValue) &&
    isWithdrawRunning &&
    (shouldApprove || withdrawProgressStep > EStakeProgressStep.approve);
  const isEthenaCooldownWithdrawPath =
    useApprove &&
    withdrawPathConfirmBoxes.length > 1 &&
    effectiveSelectedWithdrawPathIndex === 0 &&
    (shouldApprove || withdrawProgressStep > EStakeProgressStep.approve);
  const shouldResumeEthenaCooldownUnstake =
    isEthenaCooldownWithdrawPath && pendingEthenaCooldownUnstake;

  const withdrawActionLabel = intl.formatMessage({
    id: isPendleProvider
      ? ETranslations.global_swap
      : ETranslations.global_withdraw,
  });
  const confirmText = useMemo(() => {
    // One press approves, then withdraws by itself once the approval is on
    // chain, so the button names both
    if (shouldApprove) {
      return EARN_DESKTOP_DEMO_COPY.approveAnd(withdrawActionLabel);
    }
    if (effectiveShowExpiredRefresh) {
      return intl.formatMessage({ id: ETranslations.global_refresh });
    }
    if (shouldResumeEthenaCooldownUnstake) {
      return intl.formatMessage({ id: ETranslations.defi_unstake });
    }
    if (isCancelWithdrawal) {
      return intl.formatMessage({ id: ETranslations.global_confirm });
    }
    return withdrawActionLabel;
  }, [
    shouldApprove,
    effectiveShowExpiredRefresh,
    shouldResumeEthenaCooldownUnstake,
    isCancelWithdrawal,
    intl,
    withdrawActionLabel,
  ]);

  const confirmOnPress = useMemo(() => {
    if (shouldApprove) return onApprove;
    if (effectiveShowExpiredRefresh) return handleLocalRefreshQuote;
    return onPress;
  }, [
    shouldApprove,
    effectiveShowExpiredRefresh,
    onApprove,
    handleLocalRefreshQuote,
    onPress,
  ]);

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

  const effectiveConfirmText = footerActionOverride?.text ?? confirmText;
  const effectiveConfirmOnPress =
    footerActionOverride?.onPress ?? confirmOnPress;
  const effectiveConfirmLoading = footerActionOverride
    ? Boolean(footerActionOverride.loading)
    : confirmLoading;
  const effectiveConfirmDisabled = footerActionOverride
    ? Boolean(footerActionOverride.disabled)
    : confirmDisabled;

  const withdrawProgress = shouldShowPendleWithdrawProgress ? (
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
      // Plain "Approve", also when it is a signature (permit)
      step1LabelId={ETranslations.global_approve}
      step2Label={withdrawActionLabel}
      step3LabelId={
        isEthenaCooldownWithdrawPath ? ETranslations.defi_unstake : undefined
      }
      isRunning={approving || loading}
    />
  ) : null;

  const selectedPathTip = selectedWithdrawPath?.tip?.text
    ? selectedWithdrawPath.tip
    : undefined;
  // An info tip with nothing to press is a note under the rows, not a box
  // (Pendle's "Selling early may…"); one the note already says isn't repeated
  const isFormTipNote =
    !!formTransactionTip?.text?.text?.trim() &&
    formTransactionTip.type === 'info' &&
    !formTransactionTip.button &&
    !formTransactionTip.description;
  const isFormTipInFootnote =
    !!pendleTipText &&
    formTransactionTip?.text?.text?.trim() === pendleTipText.text;
  const formTipAlert =
    formTransactionTip?.text && !isFormTipNote && !isFormTipInFootnote
      ? formTransactionTip
      : undefined;
  const footnoteText =
    pendleTipText ?? (isFormTipNote ? formTransactionTip?.text : undefined);

  return (
    <StakingFormWrapper>
      <Stack position="relative">
        <YStack gap="$2">
          {/* The error line brings its own space, so no error leaves no gap */}
          <YStack>
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
                  // As the lending form says it, so the action's name stays on
                  // the button
                  iconText: intl.formatMessage({
                    id: ETranslations.global_available,
                  }),
                  onPress: onMax,
                }}
                valueProps={{
                  value: currentValue,
                  // "$0.00" before an amount, as on the Swap page
                  currency: symbol,
                }}
                enableMaxAmount
                onSelectPercentageStage={onSelectPercentageStage}
              />
              {amountInputDisabled ? (
                <Stack position="absolute" w="100%" h="100%" zIndex={1} />
              ) : null}
            </Stack>
            <HeightTransition duration={AMOUNT_LINE_MS}>
              {isCheckAmountMessageError ? (
                <YStack pt="$2" px="$3.5">
                  <SizableText
                    testID="earn-amount-error"
                    size="$bodyMd"
                    color="$textCritical"
                  >
                    {checkAmountMessage}
                  </SizableText>
                </YStack>
              ) : null}
            </HeightTransition>
          </YStack>
          <ManagePageV2ReceiveInput
            receive={transactionConfirmation?.receive}
            // One name before and after the quote; the server's would
            // replace it once a quote is in
            config={
              effectiveReceiveInputConfig
                ? {
                    ...effectiveReceiveInputConfig,
                    title: effectiveReceiveInputConfig.title || youReceiveLabel,
                  }
                : undefined
            }
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
      {/* Where it comes from, then the ways out when there are two: cards
          side by side, each with when it pays and what it costs. The cards
          bring their own space above, so none leave no gap */}
      {offerSwitch || showWithdrawPathCards ? (
        <YStack>
          {offerSwitch}
          <HeightTransition
            duration={AMOUNT_LINE_MS}
            skipInitialAnimation={hasPathCardsFromStart}
          >
            {showWithdrawPathCards && selectedWithdrawPath ? (
              <YStack pt={offerSwitch ? '$2' : undefined}>
                <WithdrawPathCards
                  boxes={withdrawPathConfirmBoxes}
                  selectedIndex={effectiveSelectedWithdrawPathIndex}
                  onSelect={handleSelectWithdrawPath}
                  disabled={isTransacting}
                />
              </YStack>
            ) : null}
          </HeightTransition>
        </YStack>
      ) : null}

      {selectedPathTip ? (
        <Alert
          icon="InfoCircleOutline"
          type={resolveEarnAlertType(selectedPathTip.type)}
          renderTitle={() => (
            <EarnText text={selectedPathTip.text} size="$bodyMdMedium" />
          )}
          action={buildTipAlertAction(selectedPathTip)}
        />
      ) : null}
      {formTipAlert ? (
        <Alert
          icon="InfoCircleOutline"
          type={resolveEarnAlertType(formTipAlert.type)}
          renderTitle={() => (
            <EarnText text={formTipAlert.text} size="$bodyMdMedium" />
          )}
          descriptionComponent={
            formTipAlert.description ? (
              <EarnText
                text={formTipAlert.description}
                size="$bodyMd"
                color="$textSubdued"
              />
            ) : undefined
          }
          action={buildTipAlertAction(formTipAlert)}
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
      {/* What reaches the wallet, then the withdrawal's own rows */}
      <EarnFormSummary
        outcome={outcome}
        isLoading={isQuoteUpdating}
        rows={summaryRows}
        footnote={
          footnoteText ? (
            <EarnText
              text={footnoteText}
              size="$bodySm"
              color={footnoteText.color ?? '$textInfo'}
            />
          ) : undefined
        }
      />
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
            {withdrawProgress ? (
              <Stack pl="$5" $md={{ pt: '$5' }}>
                {withdrawProgress}
              </Stack>
            ) : (
              <Stack />
            )}
            <Page.FooterActions
              onConfirmText={effectiveConfirmText}
              confirmButtonProps={{
                onPress: effectiveConfirmOnPress,
                loading: effectiveConfirmLoading,
                disabled: effectiveConfirmDisabled,
              }}
            />
          </Stack>
          <PercentageStageOnKeyboard
            onSelectPercentageStage={onSelectPercentageStage}
            reserveSpaceUntilKeyboardShown={!amountInputDisabled}
          />
        </Page.Footer>
      ) : (
        <YStack bg="$bgApp" gap="$5">
          {withdrawProgress}
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
