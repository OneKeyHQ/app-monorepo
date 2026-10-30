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
  NumberSizeableText,
  SizableText,
  Skeleton,
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
  buildWaysOutFirstFrameKey,
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
import {
  EARN_EMPTIED_HOLD_MS,
  countDecimalPlaces,
  getTypedAmountValue,
  isInvalidAmount,
} from '../../utils/utils';
import { EarnFormFooter } from '../EarnFormFooter';
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
  EARN_BUTTON_LOOK_TRANSITION,
  EarnFormRow,
  EarnFormSummary,
  buildRewardNoteRows,
  buildRewardsOutcome,
  useEarnFeeFigure,
} from '../UniversalStake/EarnFormSummary';

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

  // The side's own verb, as its tab says it (Sell Early, Redeem): the
  // button says what the entry that opened it said (demo 10-29)
  actionLabel?: string;

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

// Paid out at once with no fee. The server's fee line names the fee in
// words; "No withdrawal fee" is the one it colors as good news
const isInstantAndFreePath = (box: IWithdrawPathBox) =>
  box.withdrawType === 'instant' &&
  box.subtitleDescription?.color === '$textSuccess';

// A line or a row of cards that comes with typing grows in this long
const AMOUNT_LINE_MS = 200;
// Half the gap between the amount box and the second box ($2)
const RECEIVE_ARROW_GAP_CENTER = 4;
// A way out's answer asked ahead is used this long, then asked again
const PATH_ANSWER_FRESH_MS = 30_000;
// 25%, 50% and 75% of a balance fill at most this many decimals
const PERCENT_INPUT_DECIMALS = 6;

type IShownWithdrawQuote = {
  // The request the figures answer, and its amount (empty for dashes)
  requestKey: string;
  amount: string;
  confirmation?: IStakeTransactionConfirmation;
};
const EMPTY_SHOWN_WITHDRAW_QUOTE: IShownWithdrawQuote = {
  requestKey: '',
  amount: '',
};

// Sell Early before its first quote. Pendle quotes nothing for an empty
// amount (its answer has the maturity alone), so the form holds the rows a
// sell quote brings in place with dashes, with the note under them: as the
// last sell quote had them (every market has the same), else their titles
let lastPendleSellQuote: IStakeTransactionConfirmation | undefined;
const PENDLE_SELL_TITLES_QUOTE: IStakeTransactionConfirmation = {
  rewards: EARN_DESKTOP_DEMO_COPY.pendleSellRowTitles.map((title) => ({
    title: { text: title },
    description: { text: '–' },
  })),
  transactionDetails: {
    type: 'view',
    data: {
      transactionDetails: EARN_DESKTOP_DEMO_COPY.pendleSellDetailTitles.map(
        (title) => ({ title: { text: title }, description: { text: '–' } }),
      ),
    },
  },
  tip: { type: 'info', text: { text: EARN_DESKTOP_DEMO_COPY.pendleSellNote } },
};

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

// The ways out before their answer, where the provider's last answer had
// two: cards of the same lines, their words placeholders
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
  actionLabel,
}: PropsWithChildren<IUniversalWithdrawProps>) {
  const navigation = useAppNavigation();
  const handleWithdrawAction = useHandleWithdraw();
  const { handleOpenWebSite } = useBrowserAction().current;
  const price = Number(inputPrice) > 0 ? inputPrice : '0';
  const [loading, setLoading] = useState<boolean>(false);
  const withdrawAllRef = useRef(false);
  const [isWithdrawAll, setIsWithdrawAll] = useState(false);
  const isCancelWithdrawal = initialWithdrawType === 'cancel';
  const [typedAmountValue, setAmountValue] = useState(
    isCancelWithdrawal ? '0' : (initialAmount ?? ''),
  );
  // "1." and "1.0" on the way to "1.05" are the amount 1: the quote, the
  // checks, the figures and the button take them so, while the box keeps
  // what was typed
  const amountValue = getTypedAmountValue(typedAmountValue);
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
  // What the rows show: the latest answer for an amount and way out, kept
  // (dimmed) while the next is fetched, so the rows swap figures in place.
  // Only shown: the button acts on this amount's own answer
  const [shownQuote, setShownQuote] = useState<IShownWithdrawQuote>(
    EMPTY_SHOWN_WITHDRAW_QUOTE,
  );
  const checkAmountRequestIdRef = useRef(0);
  const checkAmountRequestKeyRef = useRef('');
  const transactionConfirmationRequestIdRef = useRef(0);
  const transactionConfirmationRequestKeyRef = useRef('');
  // Each way out's answer for an amount, by request; and those being asked
  const pathAnswersRef = useRef(
    new Map<string, { resp?: IStakeTransactionConfirmation; at: number }>(),
  );
  const pathAsksRef = useRef(new Set<string>());
  // Read when a kept answer is used: the caller's function changes with
  // every render of the caller
  const onQuoteResetRef = useRef(onQuoteReset);
  onQuoteResetRef.current = onQuoteReset;

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
  >(() => readFirstFrame(emptyAmountKey, { orOlder: true }));
  const waysOutKey = buildWaysOutFirstFrameKey({
    networkId: networkId || '',
    providerName: providerName || '',
  });
  // Before this position's own answer: the provider's ways out as its last
  // answer had them, so the cards' place is held from the first frame
  const [providerWaysOut] = useState(() =>
    emptyAmountConfirmation
      ? undefined
      : readFirstFrame<IWithdrawPathBox[]>(waysOutKey, { orOlder: true }),
  );

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

  const hasTwoWaysOut = withdrawPathConfirmBoxes.length > 1;
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

  const buildConfirmationRequestKey = useCallback(
    (amount: string, withdrawType?: IEarnWithdrawType) =>
      JSON.stringify({
        accountAddress,
        actionSymbol: requestSymbol || tokenSymbol || '',
        amount,
        identity,
        inputTokenAddress: transactionInputTokenAddress,
        isDisabled,
        networkId: networkId || '',
        outputTokenAddress: transactionOutputTokenAddress,
        provider: providerName || '',
        slippage: pendleSlippage,
        vault: shouldSendProtocolVault ? protocolVault || '' : '',
        withdrawType,
      }),
    [
      accountAddress,
      identity,
      isDisabled,
      networkId,
      pendleSlippage,
      protocolVault,
      providerName,
      requestSymbol,
      shouldSendProtocolVault,
      tokenSymbol,
      transactionInputTokenAddress,
      transactionOutputTokenAddress,
    ],
  );
  const transactionConfirmationRequestKey = useMemo(
    () => buildConfirmationRequestKey(amountValue, selectedWithdrawType),
    [amountValue, buildConfirmationRequestKey, selectedWithdrawType],
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
  // The amount the server's message was for
  const checkAmountMessageAmountRef = useRef('');
  const [checkAmountAlerts, setCheckAmountAlerts] = useState<
    ICheckAmountAlert[]
  >([]);
  // The last notes stay in place while they close, and go once closed, so
  // nothing hidden (a note's button) stays in the form
  const lastCheckAmountAlertsRef = useRef(checkAmountAlerts);
  if (checkAmountAlerts.length) {
    lastCheckAmountAlertsRef.current = checkAmountAlerts;
  }
  const [, setClosedAlertsTick] = useState(0);
  useEffect(() => {
    if (checkAmountAlerts.length || !lastCheckAmountAlertsRef.current.length) {
      return undefined;
    }
    const timer = setTimeout(() => {
      lastCheckAmountAlertsRef.current = [];
      setClosedAlertsTick((tick) => tick + 1);
    }, AMOUNT_LINE_MS);
    return () => clearTimeout(timer);
  }, [checkAmountAlerts]);
  const shownCheckAmountAlerts = checkAmountAlerts.length
    ? checkAmountAlerts
    : lastCheckAmountAlertsRef.current;

  // With the amount it is for, so the fee's figure waits for its own answer
  const { result: estimateFee } = usePromiseResult(async () => {
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

    const amount = isCancelWithdrawal ? '' : amountValue;
    try {
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
      return { amount, resp };
    } catch {
      // A failed estimate ends as no fee for this amount (a dash), as a
      // failed figure does, rather than the last one held dimmed for good
      return { amount, resp: undefined };
    }
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
  // A new amount's quote (Pendle's, which expires) is on its way from that
  // amount's own frame, not only once the effect below asks for it
  const [quoteAskAmount, setQuoteAskAmount] = useState(amountValue);
  if (isPendleProvider && quoteAskAmount !== amountValue) {
    setQuoteAskAmount(amountValue);
    setTransactionConfirmationLoading(
      !isInvalidAmount(amountValue) && new BigNumber(amountValue).gt(0),
    );
  }

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
          checkAmountMessageAmountRef.current = params.amount;
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
        keepFirstFrame(
          waysOutKey,
          resp?.withdrawPath?.data?.confirmBoxes ?? [],
        );
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
    waysOutKey,
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
        if (resp && withdrawType) {
          pathAnswersRef.current.set(requestKey, { resp, at: Date.now() });
        }
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
        setShownQuote({ requestKey, amount: amount || '', confirmation: resp });
        if (resp && amount && Number(amount) > 0) {
          onQuoteReset?.();
        }
      } catch {
        // The previous snapshot remains internal and cannot enable submission.
        // The rows show dashes rather than another amount's figures
        if (
          isLatestTransactionConfirmationRequest({
            requestId,
            requestKey,
            latestRequestId: transactionConfirmationRequestIdRef.current,
            latestRequestKey: transactionConfirmationRequestKeyRef.current,
          })
        ) {
          setShownQuote({ requestKey, amount: amount || '' });
        }
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

    // This way out's answer for this amount, asked ahead a moment ago: its
    // figures and rows show with the press that picked it
    // Only between ways out: a quote that expires (Pendle) is always new
    const kept =
      isCancelWithdrawal || !hasTwoWaysOut || isPendleProvider
        ? undefined
        : pathAnswersRef.current.get(transactionConfirmationRequestKey);
    if (kept && Date.now() - kept.at < PATH_ANSWER_FRESH_MS) {
      setTransactionConfirmation(kept.resp);
      setResolvedRequestKey(transactionConfirmationRequestKey);
      setShownQuote({
        requestKey: transactionConfirmationRequestKey,
        amount: amountValue,
        confirmation: kept.resp,
      });
      setTransactionConfirmationLoading(false);
      onQuoteResetRef.current?.();
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
    hasTwoWaysOut,
    isCancelWithdrawal,
    isPendleProvider,
    selectedWithdrawType,
    transactionConfirmationRequestKey,
  ]);

  // With two ways out, the other way's answer for the amount is asked as
  // soon as this way's is in, so a switch needn't wait for it
  const shownQuoteKey = shownQuote.requestKey;
  useEffect(() => {
    if (
      isCancelWithdrawal ||
      !hasTwoWaysOut ||
      isPendleProvider ||
      shownQuoteKey !== transactionConfirmationRequestKey ||
      isInvalidAmount(amountValue) ||
      !new BigNumber(amountValue).gt(0)
    ) {
      return;
    }
    withdrawPathConfirmBoxes.forEach((box) => {
      if (
        box.disabled ||
        !box.withdrawType ||
        box.withdrawType === selectedWithdrawType
      ) {
        return;
      }
      const { withdrawType } = box;
      const key = buildConfirmationRequestKey(amountValue, withdrawType);
      const kept = pathAnswersRef.current.get(key);
      if (
        pathAsksRef.current.has(key) ||
        (kept && Date.now() - kept.at < PATH_ANSWER_FRESH_MS)
      ) {
        return;
      }
      pathAsksRef.current.add(key);
      fetchTransactionConfirmation(amountValue, withdrawType)
        .then((resp) => {
          if (resp) {
            pathAnswersRef.current.set(key, { resp, at: Date.now() });
          }
        })
        .catch(() => undefined)
        .finally(() => pathAsksRef.current.delete(key));
    });
  }, [
    amountValue,
    buildConfirmationRequestKey,
    fetchTransactionConfirmation,
    hasTwoWaysOut,
    isCancelWithdrawal,
    isPendleProvider,
    selectedWithdrawType,
    shownQuoteKey,
    transactionConfirmationRequestKey,
    withdrawPathConfirmBoxes,
  ]);

  // Pendle's refresh brings a new answer for the amount in the box
  const setRefreshedConfirmation = useCallback(
    (resp?: IStakeTransactionConfirmation) => {
      setTransactionConfirmation(resp);
      setShownQuote((prev) => ({ ...prev, confirmation: resp }));
    },
    [],
  );
  const { quoteRefreshing, handleLocalRefreshQuote } = useQuoteRefresh({
    enabled: isPendleProvider,
    refreshKey,
    amountValue,
    fetchTransactionConfirmation,
    setTransactionConfirmation: setRefreshedConfirmation,
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
          // A share of the balance reads as an amount, not 18 decimals
          decimals: Math.min(
            decimals ?? PERCENT_INPUT_DECIMALS,
            PERCENT_INPUT_DECIMALS,
          ),
        }),
      );
    },
    [balance, decimals, onChangeAmountValue],
  );

  // What is wrong with the amount, as one red line: more than the balance
  // reads the same whichever check says it first, as in the deposit forms,
  // at once and in the app's words (the server's comes a moment later, and
  // Pendle's speaks of a deposit); else the server's check
  const isOverBalance =
    !isCancelWithdrawal &&
    !isDisabled &&
    !isInvalidAmount(amountValue) &&
    new BigNumber(amountValue).gt(new BigNumber(balance || '0'));
  let amountErrorText: string | undefined;
  if (amountValue?.length > 0) {
    if (isOverBalance) {
      amountErrorText = intl.formatMessage({
        id: ETranslations.earn_insufficient_balance,
      });
    } else if (
      checkAmountMessage &&
      // The server's word on an amount over the balance stops once the
      // amount is back within it, not when its next check comes in
      !(
        checkAmountMessageAmountRef.current !== amountValue &&
        new BigNumber(checkAmountMessageAmountRef.current).gt(
          new BigNumber(balance || '0'),
        )
      )
    ) {
      amountErrorText = checkAmountMessage;
    }
  }
  const isCheckAmountMessageError = Boolean(amountErrorText);
  // The server's check of the amount and, for a way out that must be
  // current, its answer: a moment after each keystroke
  const isWaitingAnswer =
    checkAmountLoading ||
    !isWithdrawPathReady ||
    (requiresEarnWithdrawPath && transactionConfirmationLoading);

  // Off for what the amount is, before the server's answer for it
  const isDisableBeforeAnswer = useMemo<boolean>(
    () =>
      isDisabled ||
      !!selectedWithdrawPath?.disabled ||
      (!isCancelWithdrawal &&
        (isInvalidAmount(amountValue) ||
          BigNumber(amountValue).isLessThanOrEqualTo(0))) ||
      isCheckAmountMessageError ||
      checkAmountAlerts.length > 0,
    [
      isDisabled,
      amountValue,
      isCheckAmountMessageError,
      checkAmountAlerts.length,
      isCancelWithdrawal,
      selectedWithdrawPath?.disabled,
    ],
  );
  const isDisable = isDisableBeforeAnswer || isWaitingAnswer;

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
  // Nor while a new answer for the amount in the box is on its way: the
  // expired quote is being replaced, so the button keeps its look. Nor for
  // an amount the red line turns down: the button stays off for it
  const isTransacting = approving || loading;
  const effectiveShowExpiredRefresh =
    showExpiredRefresh &&
    !isTransacting &&
    !quoteLoading &&
    !isCheckAmountMessageError;

  const amountInputDisabled = useMemo(() => {
    return isDisabled || initialAmount !== undefined || isCancelWithdrawal;
  }, [isDisabled, initialAmount, isCancelWithdrawal]);

  const isPositiveAmount =
    !isInvalidAmount(amountValue) && new BigNumber(amountValue).gt(0);
  const lastConfirmationRef = useRef<IStakeTransactionConfirmation | undefined>(
    undefined,
  );
  if (transactionConfirmation) {
    lastConfirmationRef.current = transactionConfirmation;
    if (isPendleProvider && transactionConfirmation.transactionDetails) {
      lastPendleSellQuote = transactionConfirmation;
    }
  }
  // Sell Early before its first quote: the rows and the note a quote brings
  const pendleSellStandIn =
    isPendleProvider && !isCancelWithdrawal
      ? (lastPendleSellQuote ?? PENDLE_SELL_TITLES_QUOTE)
      : undefined;
  // A box emptied keeps what was on screen a moment (the figures dimmed, or
  // the placeholders of a quote on its way), so a digit deleted and typed
  // again is a change rather than a blink or a restart; left empty, the
  // rows go back to dashes together
  const [wasPositiveAmount, setWasPositiveAmount] = useState(isPositiveAmount);
  const [isEmptiedHolding, setIsEmptiedHolding] = useState(false);
  if (wasPositiveAmount !== isPositiveAmount) {
    setWasPositiveAmount(isPositiveAmount);
    setIsEmptiedHolding(!isPositiveAmount);
  }
  // Each key typed into it while it still has no amount ("0." on the way to
  // "0.5") keeps what was on screen a moment more: dashes come with a
  // pause, not mid-word
  useEffect(() => {
    if (isPositiveAmount) {
      return undefined;
    }
    const timer = setTimeout(() => {
      setShownQuote(EMPTY_SHOWN_WITHDRAW_QUOTE);
      setIsEmptiedHolding(false);
    }, EARN_EMPTIED_HOLD_MS);
    return () => clearTimeout(timer);
  }, [isPositiveAmount, typedAmountValue]);
  // What the rows show: the shown answer's figures (cancelling a queued
  // withdrawal, which has no amount, this answer's own); else the last
  // answer's labels with dashes, or placeholders while one is coming
  const shownConfirmation = isCancelWithdrawal
    ? transactionConfirmation
    : shownQuote.confirmation;
  const showDashes = !shownConfirmation;
  const rowsConfirmation =
    shownConfirmation ??
    lastConfirmationRef.current ??
    pendleSellStandIn ??
    emptyAmountConfirmation;
  // Whether the rows had settled for the amount in the box (its answer in,
  // with figures or without): through an emptied box's moment they stay as
  // they were, the figures dimmed and the dashes dashes, nothing being on
  // its way. Rows still waiting for their answer keep their placeholders
  const rowsSettledRef = useRef(false);
  let isQuoteUpdating = quoteLoading;
  let isHoldingSettled = false;
  if (!isCancelWithdrawal) {
    if (isPositiveAmount) {
      isQuoteUpdating =
        shownQuote.requestKey !== transactionConfirmationRequestKey;
      rowsSettledRef.current = !isQuoteUpdating;
    } else {
      isHoldingSettled = isEmptiedHolding && rowsSettledRef.current;
      isQuoteUpdating =
        (shownQuote.amount !== '' || isEmptiedHolding) && !isHoldingSettled;
    }
  }

  const hasShownReceiveFigure = new BigNumber(
    earnUtils.extractAmountFromText(shownConfirmation?.receive?.description),
  ).gt(0);

  const pendleDetailRows = usePendleTransactionDetails({
    transactionConfirmation: rowsConfirmation,
    // The amount the shown figures are for: they stay while the box is
    // emptied a moment
    amountValue: isCancelWithdrawal ? amountValue : shownQuote.amount,
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
  // The last estimate stays with its amount, as the deposit form's does: an
  // emptied box clears the request, and the same amount typed again shows
  // its fee at once with the other figures. Once the box has gone to dashes
  // the next amount starts from placeholders, its fee too, even the same
  // amount typed again
  const lastEstimateFeeRef = useRef(estimateFee);
  if (estimateFee) {
    lastEstimateFeeRef.current = estimateFee;
  } else if (!isPositiveAmount && !isEmptiedHolding) {
    lastEstimateFeeRef.current = undefined;
  }
  const keptEstimateFee = estimateFee ?? lastEstimateFeeRef.current;
  const feeFigure = useEarnFeeFigure({
    fee: keptEstimateFee?.resp,
    feeAmount: keptEstimateFee?.amount,
    amountValue,
    isPositiveAmount,
    hasShownFigures: shownQuote.amount !== '' || isEmptiedHolding,
  });
  // Cancelling a queued withdrawal has no amount: its fee shows as it is
  let shownFee = feeFigure.shownFee;
  let isFeeLoading: boolean | undefined = feeFigure.isFeeLoading;
  if (isCancelWithdrawal) {
    const cancelFee = estimateFee?.resp;
    shownFee =
      cancelFee && Number(cancelFee.feeFiatValue) > 0 ? cancelFee : undefined;
    isFeeLoading = undefined;
  }

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
    // One way out: when it pays and what it costs, under the result. Paid
    // out at once and free (Spark Savings) it tells nothing a withdrawal
    // doesn't already promise, so it goes, as Morpho has none
    if (
      withdrawPathConfirmBoxes.length === 1 &&
      selectedWithdrawPath &&
      !isInstantAndFreePath(selectedWithdrawPath)
    ) {
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
        <EarnFormRow
          key="receive"
          label={receive.title.text}
          tooltip={receive.tooltip}
          value={
            showDashes ? undefined : (
              <EarnText
                text={receive.description}
                size="$bodyMdMedium"
                textAlign="right"
              />
            )
          }
        />,
      );
    }
    // A zero estimate counts as none
    if (shownFee) {
      items.push(
        <EarnFormRow
          key="network-fee"
          label={intl.formatMessage({
            id: ETranslations.global_est_network_fee,
          })}
          isLoading={isFeeLoading}
          value={
            <NumberSizeableText
              size="$bodyMdMedium"
              formatter="value"
              formatterOptions={{ currency: symbol }}
            >
              {shownFee.feeFiatValue}
            </NumberSizeableText>
          }
        />,
      );
    } else if (!isLidoWithdraw) {
      // Held in place until this amount's estimate is in, so the button
      // doesn't move on the first digit; the same row as the fee's, which
      // fades in where its placeholder was
      items.push(
        <EarnFormRow
          key="network-fee"
          label={intl.formatMessage({
            id: ETranslations.global_est_network_fee,
          })}
          isLoading={isFeeLoading}
        />,
      );
    }
    return items;
  }, [
    shownFee,
    isFeeLoading,
    intl,
    symbol,
    isLidoWithdraw,
    isPendleLikeLayout,
    pendleDetailRows,
    rowsConfirmation,
    selectedWithdrawPath,
    showDashes,
    withdrawPathConfirmBoxes.length,
  ]);

  const showWithdrawPathCards =
    withdrawPathConfirmBoxes.length > 1 && !!selectedWithdrawPath;
  // The provider's ways out stand in until this position's answer is in
  const waysOutStandIn =
    !isCancelWithdrawal &&
    !emptyAmountConfirmation &&
    !withdrawPathConfirmBoxes.length &&
    providerWaysOut &&
    providerWaysOut.length > 1
      ? providerWaysOut
      : undefined;
  // Cards there from the first frame (a kept answer, or their stand-ins)
  // show at once
  const [hasPathCardsFromStart] = useState(
    showWithdrawPathCards || Boolean(waysOutStandIn),
  );
  // The steps show as soon as the button names them, before the press as
  // well as while it runs
  const shouldShowPendleWithdrawProgress =
    useApprove &&
    !!amountValue &&
    !isInvalidAmount(amountValue) &&
    (shouldApprove || withdrawProgressStep > EStakeProgressStep.approve);
  const isEthenaCooldownWithdrawPath =
    useApprove &&
    withdrawPathConfirmBoxes.length > 1 &&
    effectiveSelectedWithdrawPathIndex === 0 &&
    (shouldApprove || withdrawProgressStep > EStakeProgressStep.approve);
  const shouldResumeEthenaCooldownUnstake =
    isEthenaCooldownWithdrawPath && pendingEthenaCooldownUnstake;

  // Pendle's side is a sale or a redemption, named on its tab; never "Swap",
  // which the row that opened it doesn't say
  const withdrawActionLabel =
    (isPendleProvider ? actionLabel : undefined) ??
    intl.formatMessage({
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

  // The button keeps its look while the amount is checked (no spinner, no
  // grey that comes and goes with each keystroke), "Approve and …" too, as
  // the deposit form's does; a press in that moment goes once the answer
  // is in
  const [isPressWaitingAnswer, setIsPressWaitingAnswer] = useState(false);
  const isOwnButtonState =
    !footerActionOverride && !effectiveShowExpiredRefresh;
  const buttonLoading = isOwnButtonState
    ? isPressWaitingAnswer ||
      (shouldApprove ? loadingAllowance || approving : loading)
    : effectiveConfirmLoading;
  // Nor while this amount's figures (what it pays out, the network fee) are
  // on their way: it turns on as they land. An answer that fails lets it go,
  // as the rows go to dashes. Lido asks for no fee
  const isFiguresComing =
    isPositiveAmount &&
    (isQuoteUpdating || (!isLidoWithdraw && Boolean(isFeeLoading)));
  const buttonDisabled = isOwnButtonState
    ? isDisableBeforeAnswer || isFiguresComing
    : effectiveConfirmDisabled;
  const handleConfirmPress = useCallback(() => {
    if (isOwnButtonState && isWaitingAnswer) {
      setIsPressWaitingAnswer(true);
      return;
    }
    void effectiveConfirmOnPress();
  }, [effectiveConfirmOnPress, isOwnButtonState, isWaitingAnswer]);
  useEffect(() => {
    if (!isPressWaitingAnswer || isWaitingAnswer) {
      return;
    }
    setIsPressWaitingAnswer(false);
    if (!effectiveConfirmDisabled && !effectiveConfirmLoading) {
      void effectiveConfirmOnPress();
    }
  }, [
    effectiveConfirmDisabled,
    effectiveConfirmLoading,
    effectiveConfirmOnPress,
    isPressWaitingAnswer,
    isWaitingAnswer,
  ]);

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
    pendleTipText ??
    (transactionConfirmation ? undefined : pendleSellStandIn?.tip?.text) ??
    (isFormTipNote ? formTransactionTip?.text : undefined);

  // What is wrong with the amount, in red: under the amount box, or under
  // the second box where there is one. Where a card follows (the position,
  // the ways out), under the cards: the line coming and going doesn't move
  // them
  const hasCardGroup = Boolean(
    offerSwitch || showWithdrawPathCards || waysOutStandIn,
  );
  const amountErrorLine = (
    <HeightTransition duration={AMOUNT_LINE_MS}>
      {amountErrorText ? (
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
  );

  const receiveBox = (
    <ManagePageV2ReceiveInput
      // The shown answer's, as the rows: an emptied box empties it
      // once they go back to dashes
      receive={shownConfirmation?.receive}
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
      // Waits as the rows do: from a changed amount, or through the moment
      // an emptied box keeps its figures, until the answer for it. With no
      // figure there (the answer had none) it stays as it is
      loading={isQuoteUpdating || (isHoldingSettled && hasShownReceiveFigure)}
    />
  );

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
                value={typedAmountValue}
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
            {showReceiveInput || hasCardGroup ? null : amountErrorLine}
          </YStack>
          {/* With a second box the red line goes under it: between the
              boxes the arrow joining them would sit on it */}
          {showReceiveInput ? (
            <YStack position="relative">
              {receiveBox}
              {hasCardGroup ? null : amountErrorLine}
              <Stack
                ai="center"
                position="absolute"
                // Centered on the gap between the two boxes, whatever comes
                // under them
                top={-RECEIVE_ARROW_GAP_CENTER}
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
            </YStack>
          ) : (
            receiveBox
          )}
        </YStack>
      </Stack>
      {/* Where it comes from, then the ways out when there are two: cards
          side by side, each with when it pays and what it costs. The cards
          bring their own space above, so none leave no gap */}
      {hasCardGroup ? (
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
            {!showWithdrawPathCards && waysOutStandIn ? (
              <YStack pt={offerSwitch ? '$2' : undefined}>
                <WithdrawPathCardsPlaceholder boxes={waysOutStandIn} />
              </YStack>
            ) : null}
          </HeightTransition>
          {amountErrorLine}
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
      {/* The check's notes (Pendle's "The min fiat value is $0.01") open
          and close over the form's moment, the rows below moving with
          them; always there, so their margin takes back the form's gap
          while they are closed */}
      <YStack mb="$-4">
        <HeightTransition
          duration={AMOUNT_LINE_MS}
          hide={!checkAmountAlerts.length}
        >
          <YStack pb="$4" gap="$4" aria-hidden={!checkAmountAlerts.length}>
            {shownCheckAmountAlerts.map((alert, index) => (
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
          </YStack>
        </HeightTransition>
      </YStack>
      {/* What reaches the wallet, then the withdrawal's own rows */}
      <EarnFormSummary
        outcome={outcome}
        isLoading={isQuoteUpdating}
        isDimmed={isHoldingSettled}
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
      <EarnFormFooter
        isInModalContext={isInModalContext}
        progress={withdrawProgress}
        confirmText={effectiveConfirmText}
        confirmButtonProps={{
          onPress: handleConfirmPress,
          loading: buttonLoading,
          disabled: buttonDisabled,
          ...EARN_BUTTON_LOOK_TRANSITION,
        }}
        keyboardStage={
          <PercentageStageOnKeyboard
            onSelectPercentageStage={onSelectPercentageStage}
            reserveSpaceUntilKeyboardShown={!amountInputDisabled}
          />
        }
      />
    </StakingFormWrapper>
  );
}
