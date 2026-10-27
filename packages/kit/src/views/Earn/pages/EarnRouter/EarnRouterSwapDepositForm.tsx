import type { ReactNode } from 'react';
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Alert,
  HeightTransition,
  Page,
  SizableText,
  Stack,
  Toast,
  YStack,
  useDeepCompareEffect,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IAmountInputFormItemProps } from '@onekeyhq/kit/src/components/AmountInput';
import { PercentageStageOnKeyboard } from '@onekeyhq/kit/src/components/PercentageStageOnKeyboard';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { convertFiat } from '@onekeyhq/kit/src/utils/fiatConvert';
import {
  fillLeadingZero,
  validateAmountInputForStaking,
} from '@onekeyhq/kit/src/utils/validateAmountInput';
import {
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import tokenRebaseUtils from '@onekeyhq/shared/src/utils/tokenRebaseUtils';
import { ECheckAmountActionType } from '@onekeyhq/shared/types/staking';
import type {
  IBorrowTransactionConfirmation,
  IEarnTooltip,
  IStakeTransactionConfirmation,
} from '@onekeyhq/shared/types/staking';
import type { IFetchQuoteResult } from '@onekeyhq/shared/types/swap/types';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { EarnLendingSummary } from '../../../Borrow/components/ManagePosition/modules/InfoDisplaySection/EarnLendingSummary';
import { EarnFooterFade } from '../../../Staking/components/EarnFooterFade';
import { EarnText } from '../../../Staking/components/ProtocolDetails/EarnText';
import { usePendleTransactionDetails } from '../../../Staking/components/ProtocolDetails/PendleSharedComponents';
import {
  EStakeProgressStep,
  StakeProgress,
} from '../../../Staking/components/StakeProgress';
import {
  StakingAmountInput,
  useOnBlurAmountValue,
} from '../../../Staking/components/StakingAmountInput';
import { StakingAmountResultLine } from '../../../Staking/components/StakingAmountResultLine';
import StakingFormWrapper from '../../../Staking/components/StakingFormWrapper';
import {
  EarnFormRow,
  EarnFormSummary,
  EarnFormSwitchingContext,
  buildOutcomeValueFromText,
  buildResultLinesKey,
  buildRewardNoteRows,
  buildRewardsOutcome,
  buildRowKeys,
  splitPendleRewardRows,
} from '../../../Staking/components/UniversalStake/EarnFormSummary';
import {
  EARN_EMPTIED_HOLD_MS,
  getTypedAmountValue,
} from '../../../Staking/utils/utils';
import { completeBroadcastedSwapSuccess } from '../../../Swap/hooks/swapBroadcastSuccess';
import { generateSwapHistoryItemForContext } from '../../../Swap/hooks/useSwapTxHistory';
import { EARN_DESKTOP_DEMO_COPY } from '../../components/desktopHome/earnDesktopHomeCopy';
import { buildKeyboardPressProps } from '../../components/desktopHome/earnDesktopPressable';

import {
  buildEmptyAmountFirstFrameKey,
  buildSupplyEmptyFirstFrameKey,
  keepFirstFrame,
  readFirstFrame,
} from './earnFirstFrameCache';
import {
  EARN_ROUTER_SWAP_IDLE,
  buildEarnSwapToken,
  earnRouterSwapReducer,
  getEarnSwapDepositAmount,
  getEarnSwapPayMax,
  keepPendleMarketRows,
} from './earnRouter.utils';
import {
  EarnSwapError,
  fetchEarnSwapQuote,
  prepareEarnSwap,
  readEarnSwapBalance,
  waitForEarnSwap,
  waitForEarnSwapBalance,
} from './earnRouterSwap';

import type {
  IEarnRouterPayToken,
  IEarnRouterSwapState,
} from './earnRouter.utils';
import type {
  IEarnSwapAccount,
  IEarnSwapPrepared,
  IEarnSwapReason,
} from './earnRouterSwap';
import type { IEarnOutcome } from '../../../Staking/components/UniversalStake/EarnFormSummary';
import type { IManagePositionFooterAction } from '../../../Staking/pages/ManagePosition/components/ManagePositionContent';

// The deposit estimate keeps at most this many decimals, rounded down
const RECEIVE_DECIMALS = 6;
// A fill from the percent chips or Max keeps at most this many decimals, so
// the box shows a number that fits; what it leaves out is dust
const FILL_DECIMALS = 8;
// As the deposit forms wait before asking for their card again
const SUMMARY_DEBOUNCE_MS = 350;
// The line under the box grows in this long, as the amount error line does
const DEPOSIT_LINE_MS = 200;
// Typing settles before the swap service is asked
const QUOTE_DEBOUNCE_MS = 500;
// How long after the box moved off an amount its figures can be taken back
const TAKE_BACK_MS = 3000;

/**
 * What the provider's own deposit form asks the server for its card: a
 * staking provider's summary, a lending market's info, or Pendle's quote for
 * buying with what the swap brings
 */
export type IEarnRouterSummaryRequest =
  | {
      kind: 'staking';
      provider: string;
      symbol: string;
      vault: string;
      accountAddress: string;
      inputTokenAddress?: string;
      outputTokenAddress?: string;
    }
  | {
      // Pendle's buy: the form keeps Pendle's own line (the PT bought) and
      // card (what you get at maturity, the rates)
      kind: 'pendle';
      provider: string;
      symbol: string;
      vault: string;
      accountAddress: string;
      inputTokenAddress: string;
      outputTokenAddress: string;
      // The PT's symbol, for the line under the box
      receiveSymbol: string;
      slippage?: number;
    }
  | {
      kind: 'lending';
      provider: string;
      marketAddress: string;
      reserveAddress: string;
      accountId: string;
    };

type IDepositSummary = {
  staking?: IStakeTransactionConfirmation;
  // The amount the staking summary answers for ("0" for none)
  stakingAmount?: string;
  // The answer for that amount failed: the rows keep the labels they had,
  // with dashes
  isStakingFailed?: boolean;
  lending?: IBorrowTransactionConfirmation;
  // The amount the lending summary answers for
  lendingAmount?: string;
  lendingLoading: boolean;
};

const NO_SUMMARY: IDepositSummary = { lendingLoading: false };

type IPendleRowLabel = { title: string; tooltip?: IEarnTooltip };

// The labels of Pendle's result and rows as last answered, holding their
// places before the next answer
let lastPendleSwapLabels:
  | { outcome?: IPendleRowLabel; rows: IPendleRowLabel[] }
  | undefined;

// The provider form's rows for what reaches the provider, asked the way that
// form asks: for an empty amount too, so the rows hold their places, and the
// last answer kept while the next one loads
function useDepositSummary({
  networkId,
  request,
  amount,
  isDisabled,
}: {
  networkId: string;
  request?: IEarnRouterSummaryRequest;
  amount: string;
  isDisabled?: boolean;
}) {
  // The rows for an empty amount, as the provider's own form last read them,
  // so they are in place from the first frame
  const [summary, setSummary] = useState<IDepositSummary>(() => {
    if (request?.kind !== 'staking' || isDisabled) {
      return NO_SUMMARY;
    }
    const staking = readFirstFrame<IStakeTransactionConfirmation>(
      buildEmptyAmountFirstFrameKey({
        networkId,
        providerName: request.provider,
        symbol: request.symbol,
        vault: request.vault,
      }),
      { orOlder: true },
    );
    return staking
      ? { staking, stakingAmount: '0', lendingLoading: false }
      : NO_SUMMARY;
  });
  const summaryRef = useRef(summary);
  summaryRef.current = summary;
  // The answers on screen as the estimate moved off their amounts (a digit
  // deleted and typed back), each kept a moment: the same estimate again
  // takes its answer back at once, with the quote. No estimate (dashes), or
  // another request, lets them go
  const leftSummariesRef = useRef(
    new Map<string, { summary: IDepositSummary; at: number }>(),
  );
  const requestKey = JSON.stringify(request ?? null);
  const lastRequestKeyRef = useRef(requestKey);
  if (lastRequestKeyRef.current !== requestKey) {
    lastRequestKeyRef.current = requestKey;
    leftSummariesRef.current.clear();
  }
  useDeepCompareEffect(() => {
    if (!request || isDisabled) {
      setSummary(NO_SUMMARY);
      return;
    }
    const hasAmount = new BigNumber(amount).gt(0);
    const leftSummaries = leftSummariesRef.current;
    if (hasAmount) {
      const now = Date.now();
      leftSummaries.forEach((entry, key) => {
        if (now - entry.at > TAKE_BACK_MS) {
          leftSummaries.delete(key);
        }
      });
      const current = summaryRef.current;
      const currentAmount =
        request.kind === 'lending'
          ? current.lendingAmount
          : current.stakingAmount;
      const hasAnswer =
        request.kind === 'lending'
          ? Boolean(current.lending)
          : Boolean(current.staking) && !current.isStakingFailed;
      if (
        hasAnswer &&
        currentAmount &&
        currentAmount !== '0' &&
        currentAmount !== amount
      ) {
        leftSummaries.set(currentAmount, {
          summary: { ...current, lendingLoading: false },
          at: now,
        });
      }
      const left = leftSummaries.get(amount);
      if (left) {
        leftSummaries.delete(amount);
        setSummary(left.summary);
        return;
      }
    } else {
      leftSummaries.clear();
    }
    // Pendle quotes nothing for no amount: its rows hold their labels
    if (request.kind === 'pendle' && !hasAmount) {
      setSummary(NO_SUMMARY);
      return;
    }
    const requestAmount = hasAmount ? amount : '0';
    if (request.kind === 'lending') {
      setSummary((prev) => ({ ...prev, lendingLoading: true }));
    }
    let isCurrent = true;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          if (request.kind === 'lending') {
            const lending =
              await backgroundApiProxy.serviceStaking.getBorrowTransactionConfirmation(
                {
                  networkId,
                  provider: request.provider,
                  marketAddress: request.marketAddress,
                  reserveAddress: request.reserveAddress,
                  accountId: request.accountId,
                  action: 'supply',
                  amount: requestAmount,
                },
              );
            if (requestAmount === '0') {
              keepFirstFrame(
                buildSupplyEmptyFirstFrameKey({
                  accountId: request.accountId,
                  networkId,
                  provider: request.provider,
                  marketAddress: request.marketAddress,
                  reserveAddress: request.reserveAddress,
                }),
                lending,
              );
            }
            if (isCurrent) {
              setSummary({
                lending,
                lendingAmount: requestAmount,
                lendingLoading: false,
              });
            }
            return;
          }
          const staking =
            await backgroundApiProxy.serviceStaking.getTransactionConfirmation({
              networkId,
              provider: request.provider,
              symbol: request.symbol,
              vault: request.vault,
              accountAddress: request.accountAddress,
              action: ECheckAmountActionType.STAKING,
              amount: requestAmount,
              inputTokenAddress: request.inputTokenAddress,
              outputTokenAddress: request.outputTokenAddress,
              slippage:
                request.kind === 'pendle' ? request.slippage : undefined,
            });
          if (requestAmount === '0') {
            keepFirstFrame(
              buildEmptyAmountFirstFrameKey({
                networkId,
                providerName: request.provider,
                symbol: request.symbol,
                vault: request.vault,
              }),
              staking,
            );
          }
          if (isCurrent) {
            setSummary({
              staking,
              stakingAmount: requestAmount,
              lendingLoading: false,
            });
          }
        } catch {
          // Dashes rather than another amount's figures, as the provider's
          // own form shows: a vault's rows keep the labels they had, the
          // market's and Pendle's keep theirs on their own
          if (isCurrent) {
            setSummary((prev) => ({
              ...prev,
              staking: request.kind === 'pendle' ? undefined : prev.staking,
              stakingAmount: requestAmount,
              isStakingFailed: request.kind === 'staking',
              lending: request.kind === 'lending' ? undefined : prev.lending,
              lendingAmount:
                request.kind === 'lending' ? requestAmount : prev.lendingAmount,
              lendingLoading: false,
            }));
          }
        }
      })();
    }, SUMMARY_DEBOUNCE_MS);
    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [networkId, request, amount, isDisabled]);
  // An answer moved off, taken back from the frame its estimate is in again
  if (request && !isDisabled && new BigNumber(amount).gt(0)) {
    const answeredAmount =
      request.kind === 'lending'
        ? summary.lendingAmount
        : summary.stakingAmount;
    const left = leftSummariesRef.current.get(amount);
    if (
      left &&
      Date.now() - left.at <= TAKE_BACK_MS &&
      (answeredAmount !== amount || summary.lendingLoading)
    ) {
      return left.summary;
    }
  }
  // Before its own answer, the rows for an empty amount as the provider's
  // own form last read them: the request can come a moment after the form,
  // and a form built again for another Pay with token keeps its rows
  if (request && !isDisabled && !new BigNumber(amount).gt(0)) {
    if (request.kind === 'lending' && !summary.lending) {
      const lending = readFirstFrame<IBorrowTransactionConfirmation>(
        buildSupplyEmptyFirstFrameKey({
          accountId: request.accountId,
          networkId,
          provider: request.provider,
          marketAddress: request.marketAddress,
          reserveAddress: request.reserveAddress,
        }),
      );
      if (lending) {
        return { ...summary, lending, lendingAmount: '0' };
      }
    }
    if (request.kind === 'staking' && !summary.staking) {
      const staking = readFirstFrame<IStakeTransactionConfirmation>(
        buildEmptyAmountFirstFrameKey({
          networkId,
          providerName: request.provider,
          symbol: request.symbol,
          vault: request.vault,
        }),
        { orOlder: true },
      );
      if (staking) {
        return { ...summary, staking, stakingAmount: '0' };
      }
    }
  }
  return summary;
}

// Where the path is, in the deposit form's own two-step indicator: the swap
// until its tokens are in, then the deposit
const getProgressStep = (flow: IEarnRouterSwapState) =>
  flow.status === 'swapped'
    ? EStakeProgressStep.deposit
    : EStakeProgressStep.approve;

type IQuoteState = {
  amount: string;
  quote?: IFetchQuoteResult;
  isLoading: boolean;
  reason?: IEarnSwapReason;
};

const NO_QUOTE: IQuoteState = { amount: '', isLoading: false };

const SWAP_ERROR_MESSAGE: Record<IEarnSwapReason, ETranslations | undefined> = {
  noRoute: ETranslations.swap_page_alert_no_provider_supports_trade,
  unsupported: ETranslations.swap_page_alert_no_provider_supports_trade,
  failed: ETranslations.swap_page_toast_swap_failed,
  cancelled: undefined,
};

export type IEarnRouterSwapDepositToken = {
  symbol: string;
  name?: string;
  logoURI?: string;
  priceUsd: string;
  address: string;
  decimals: number;
  isNative?: boolean;
  /** The decimals the provider takes, where they differ from the token's */
  inputDecimals?: number;
};

// Paying with a token the provider doesn't take, with no one-transaction
// route for it: swap, then deposit. It is the deposit form with a second box
// for what reaches the provider, the way the Pendle form shows a swap. One
// press runs the swap through the wallet's confirm and the chain; once its
// tokens are in the wallet the provider's own deposit form takes over with
// them (`onSwapped`) and carries on
export function EarnRouterSwapDepositForm({
  accountId,
  networkId,
  actionLabel,
  depositLineLabel,
  isDisabled,
  apr,
  payToken,
  depositToken,
  onOpenPayWith,
  onOpenPayWithFromKeyboard,
  onSwapped,
  beforeSwap,
  footerActionOverride,
  isInModalContext,
  protocolSwitch,
  offerSwitch,
  initialAmount,
  onAmountChange,
  summaryRequest,
  payWithTrigger,
  amountBoxBottom,
  amountBoxTestID,
  onRefreshBalance,
  revealsDepositLine,
}: {
  accountId: string;
  networkId: string;
  /** What the deposit form calls the action: Deposit, or Supply */
  actionLabel: string;
  /** The line under the Pay with box, in the same word: "You deposit", or
   * "You supply" */
  depositLineLabel: string;
  /** The provider takes no deposits now (paused, capped) */
  isDisabled?: boolean;
  /** The provider's rate, in percent, when known */
  apr?: number;
  payToken: IEarnRouterPayToken;
  depositToken: IEarnRouterSwapDepositToken;
  onOpenPayWith: () => void;
  // The same from the keyboard, which also focuses the list's first token
  onOpenPayWithFromKeyboard?: () => void;
  /** The swap's tokens are in the wallet: what to deposit, and the balance
   * read on chain */
  onSwapped: (result: { amount: string; balance?: string }) => void;
  /**
   * Before anything is sent: the provider's risk notice and its check of the
   * amount that will reach it, so a swap never strands its tokens. False
   * stops the press
   */
  beforeSwap?: (expectedAmount: string) => Promise<boolean>;
  /** The guide's preview: the press goes there and nothing is sent */
  footerActionOverride?: IManagePositionFooterAction;
  // In a modal the action goes in the page footer, as the deposit form's does
  isInModalContext?: boolean;
  // The deposit form's protocol switcher, where that form has one
  protocolSwitch?: ReactNode;
  // The caller's own selector (the Earn deposit modal's offers) in the same
  // place. Unlike the switcher it keeps the whole card under it
  offerSwitch?: ReactNode;
  // An amount of the pay token to start on (one carried from another offer)
  initialAmount?: string;
  onAmountChange?: (amount: string) => void;
  /**
   * Asked for the provider form's own card, for what reaches the provider.
   * Without it the card estimates the year at the provider's rate
   */
  summaryRequest?: IEarnRouterSummaryRequest;
  // Shown because another token was just picked in Pay with: the line
  // under the box grows in rather than appearing at once
  revealsDepositLine?: boolean;
  // Pay with's chip as the caller has it: the token just picked while its
  // list folds, the chevron turned while the list is open
  payWithTrigger?: Partial<
    NonNullable<IAmountInputFormItemProps['tokenSelectorTriggerProps']>
  >;
  // Inside the amount box under its balance line: Pay with's token list
  amountBoxBottom?: ReactNode;
  amountBoxTestID?: string;
  // The paying token's balance read again: Swap's refresh at a zero balance
  onRefreshBalance?: () => Promise<unknown> | void;
}) {
  const intl = useIntl();
  const [{ currencyInfo }] = useSettingsPersistAtom();
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const { result: network } = usePromiseResult(
    () => backgroundApiProxy.serviceNetwork.getNetwork({ networkId }),
    [networkId],
  );
  const { result: address } = usePromiseResult(
    async () =>
      accountId
        ? backgroundApiProxy.serviceAccount.getAccountAddressForApi({
            accountId,
            networkId,
          })
        : undefined,
    [accountId, networkId],
  );
  const account = useMemo<IEarnSwapAccount | undefined>(
    () =>
      accountId && address ? { accountId, networkId, address } : undefined,
    [accountId, address, networkId],
  );
  // What the network's coin keeps back for fees, as the Swap page's Max does
  const { result: nativeConfig } = usePromiseResult(
    async () =>
      payToken.token.isNative
        ? backgroundApiProxy.serviceSwap.fetchSwapNativeTokenConfig({
            networkId,
          })
        : undefined,
    [networkId, payToken.token.isNative],
  );
  const [typedAmount, setAmount] = useState(initialAmount ?? '');
  // "1." and "1.0" on the way to "1.05" are the amount 1: quoted, checked
  // and swapped as 1, while the box keeps what was typed
  const amount = getTypedAmountValue(typedAmount);
  // Told when the amount changes, not when the caller's callback does (the
  // guide passes a new one each render, which would undo a reported amount)
  const onAmountChangeRef = useRef(onAmountChange);
  onAmountChangeRef.current = onAmountChange;
  useEffect(() => {
    onAmountChangeRef.current?.(amount);
  }, [amount]);
  const onBlurAmount = useOnBlurAmountValue(amount, setAmount);
  // Typed as the deposit form takes it: digits and one dot, no more decimals
  // than the pay token has
  const onChangeAmount = useCallback(
    (text: string) => {
      const value = fillLeadingZero(text);
      if (validateAmountInputForStaking(value, payToken.token.decimals)) {
        setAmount(value);
      }
    },
    [payToken.token.decimals],
  );
  const [flow, dispatch] = useReducer(
    earnRouterSwapReducer,
    EARN_ROUTER_SWAP_IDLE,
  );

  const fromToken = useMemo(
    () =>
      buildEarnSwapToken({
        networkId,
        token: payToken.token,
        priceUsd: payToken.priceUsd,
      }),
    [networkId, payToken.priceUsd, payToken.token],
  );
  const toToken = useMemo(
    () =>
      buildEarnSwapToken({
        networkId,
        token: depositToken,
        priceUsd: depositToken.priceUsd,
      }),
    [depositToken, networkId],
  );
  // Swap carries no rebasing token's scaled balance
  const isSwappable = !tokenRebaseUtils.isScalingBalanceMultiplier(
    payToken.token.balanceMultiplier,
  );

  // USD to the currency the app shows
  const toFiat = useCallback(
    (valueUsd: string) =>
      convertFiat({
        value: valueUsd,
        sourceCurrency: USD_CURRENCY_ID,
        targetCurrency: currencyInfo.id,
        currencyMap,
      }),
    [currencyInfo.id, currencyMap],
  );

  const amountValue = new BigNumber(amount);
  const hasAmount = amountValue.isFinite() && amountValue.gt(0);
  const isInsufficient = hasAmount && amountValue.gt(payToken.amount);
  const isIdle = flow.status === 'idle';

  // What the swap service quotes for the amount, asked again as it changes.
  // More than the balance is quoted too, as the Swap page and the Pendle
  // form do: the line says what it would bring, the alert why it can't, and
  // a dash keeps meaning no route
  const [quoteState, setQuoteState] = useState<IQuoteState>(NO_QUOTE);
  const quoteStateRef = useRef(quoteState);
  quoteStateRef.current = quoteState;
  // The quotes on screen as the box moved off their amounts (emptied, or a
  // digit deleted), each kept a moment: the same amount typed again takes
  // its quote back as it was, so every figure returns at once, also through
  // the amounts typed on the way ("1" before "1.5"). Once an emptied box has
  // gone to dashes they go. The press asks for a fresh quote anyway
  const leftQuotesRef = useRef(
    new Map<string, { quote: IFetchQuoteResult; at: number }>(),
  );
  const canQuote = hasAmount && isSwappable;
  // Asked for the tokens and the amount, not for the token objects: a
  // refresh of the market's data (a new price) builds them again but asks
  // nothing new, so the figures don't dim on their own (the press asks for
  // a fresh quote anyway)
  const quoteTokensRef = useRef({ fromToken, toToken });
  quoteTokensRef.current = { fromToken, toToken };
  const quoteTokensKey = [fromToken, toToken]
    .map((token) =>
      [
        token.networkId,
        token.contractAddress,
        token.isNative ? 'native' : '',
        token.decimals,
      ].join(':'),
    )
    .join('>');
  useEffect(() => {
    // While the swap runs the estimate stays as it went to the wallet
    if (!isIdle) {
      return;
    }
    const now = Date.now();
    const leftQuotes = leftQuotesRef.current;
    leftQuotes.forEach((entry, key) => {
      if (now - entry.at > TAKE_BACK_MS) {
        leftQuotes.delete(key);
      }
    });
    const shown = quoteStateRef.current;
    if (shown.quote && shown.amount && shown.amount !== amount) {
      leftQuotes.set(shown.amount, { quote: shown.quote, at: now });
    }
    if (!canQuote) {
      setQuoteState(NO_QUOTE);
      return;
    }
    const left = leftQuotes.get(amount);
    if (left) {
      leftQuotes.delete(amount);
      setQuoteState({ amount, quote: left.quote, isLoading: false });
      return;
    }
    const controller = new AbortController();
    setQuoteState((prev) => ({
      amount,
      quote: prev.amount === amount ? prev.quote : undefined,
      isLoading: true,
    }));
    const timer = setTimeout(() => {
      fetchEarnSwapQuote({
        ...quoteTokensRef.current,
        amount,
        account,
        signal: controller.signal,
        onBest: (quote) => setQuoteState({ amount, quote, isLoading: true }),
      })
        .then((quote) => setQuoteState({ amount, quote, isLoading: false }))
        .catch((error: unknown) => {
          if (!controller.signal.aborted) {
            setQuoteState({
              amount,
              isLoading: false,
              reason: error instanceof EarnSwapError ? error.reason : 'noRoute',
            });
          }
        });
    }, QUOTE_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [account, amount, canQuote, isIdle, quoteTokensKey]);
  // A quote moved off, taken back from the frame its amount is typed again
  const leftQuote = leftQuotesRef.current.get(amount);
  const takenBackQuote =
    hasAmount && leftQuote && Date.now() - leftQuote.at <= TAKE_BACK_MS
      ? leftQuote.quote
      : undefined;
  const quote =
    quoteState.amount === amount ? quoteState.quote : takenBackQuote;
  const isQuoting =
    isIdle && canQuote && !quote && quoteState.reason === undefined;
  const hasNoRoute =
    isIdle &&
    canQuote &&
    !quoteState.isLoading &&
    quoteState.reason !== undefined;

  const depositAmountQuoted = useMemo(() => {
    const received = new BigNumber(quote?.toAmount ?? '');
    return received.isFinite() && received.gt(0)
      ? received
          .decimalPlaces(
            Math.min(RECEIVE_DECIMALS, depositToken.decimals),
            BigNumber.ROUND_DOWN,
          )
          .toFixed()
      : '';
  }, [depositToken.decimals, quote?.toAmount]);
  const depositAmount = depositAmountQuoted;
  // The last estimate stays (dimmed) while the next amount is quoted, and the
  // rows keep its figures until the new ones are in
  const lastDepositRef = useRef('');
  // What was last on screen: the estimate on the line under the box, the
  // estimate the provider's figures were for (Pendle's line, as the red
  // line can stand in its place, and the rows), the market's answer
  const lineShownDepositRef = useRef('');
  const lineShownSummaryAmountRef = useRef<string | undefined>(undefined);
  const shownSummaryAmountRef = useRef<string | undefined>(undefined);
  const shownLendingAmountRef = useRef<string | undefined>(undefined);
  // The provider's answer whose figures are on screen
  const shownSummaryRef = useRef<IDepositSummary | undefined>(undefined);
  // Emptied: what was on screen stays a moment (the figures dimmed, or the
  // placeholders of an estimate on its way), so a digit deleted and typed
  // again is a change rather than a blink or a restart; left empty, dashes
  // together, and the next amount starts from placeholders. A route's
  // dashes have nothing to keep
  const wasAmountRef = useRef(hasAmount);
  const wasNoRouteRef = useRef(false);
  const isEmptiedRef = useRef(false);
  if (wasAmountRef.current !== hasAmount) {
    wasAmountRef.current = hasAmount;
    isEmptiedRef.current = !hasAmount && !wasNoRouteRef.current;
  }
  wasNoRouteRef.current = hasNoRoute;
  const [, setSettleTick] = useState(0);
  // Each key typed into it while it still has no amount (the zeros of
  // "0.0003") keeps what was on screen a moment more: dashes come with a
  // pause, not mid-word
  useEffect(() => {
    if (hasAmount) {
      return undefined;
    }
    if (!isEmptiedRef.current) {
      leftQuotesRef.current.clear();
      return undefined;
    }
    const timer = setTimeout(() => {
      isEmptiedRef.current = false;
      leftQuotesRef.current.clear();
      setSettleTick((tick) => tick + 1);
    }, EARN_EMPTIED_HOLD_MS);
    return () => clearTimeout(timer);
  }, [hasAmount, typedAmount]);
  const isEmptySettling = !hasAmount && isEmptiedRef.current;
  if (depositAmount) {
    lastDepositRef.current = depositAmount;
  } else if (!isQuoting && !isEmptySettling) {
    lastDepositRef.current = '';
  }
  const shownDeposit = depositAmount || lastDepositRef.current;
  // The line's figure: an estimate made while the red line stood in its
  // place (over the balance) was never on screen, so coming back the line
  // waits for the next one with a placeholder rather than showing that one,
  // dimmed, as the last
  const lineDeposit =
    (Boolean(depositAmount) && !isQuoting) ||
    shownDeposit === lineShownDepositRef.current
      ? shownDeposit
      : '';
  if (lineDeposit && !isInsufficient) {
    lineShownDepositRef.current = lineDeposit;
  }
  const payFiat = hasAmount
    ? toFiat(amountValue.times(payToken.priceUsd).toFixed())
    : '';
  const answeredSummary = useDepositSummary({
    networkId,
    request: summaryRequest,
    amount: shownDeposit,
    isDisabled,
  });
  // An answer shows when it is for this amount's estimate, or is the one on
  // screen (dimmed while the next is worked out). One for an earlier
  // estimate that was never on screen (it came in after the amount
  // changed, or under the red line) doesn't take that one's place: the
  // figures on screen stay, dimmed, until this amount's replace them, as
  // the market's rows do. With none on screen, placeholders
  const answeredAmount = answeredSummary.stakingAmount;
  const keptSummary = shownSummaryRef.current;
  const canShowAnswered =
    (Boolean(depositAmount) && answeredAmount === depositAmount) ||
    (answeredAmount !== undefined &&
      answeredAmount === shownSummaryAmountRef.current);
  const depositSummary =
    !canShowAnswered &&
    keptSummary?.stakingAmount !== undefined &&
    keptSummary.stakingAmount === shownSummaryAmountRef.current
      ? {
          ...answeredSummary,
          staking: keptSummary.staking,
          stakingAmount: keptSummary.stakingAmount,
          isStakingFailed: keptSummary.isStakingFailed,
        }
      : answeredSummary;
  const summaryAmount = depositSummary.stakingAmount;
  const isSummaryCurrent =
    Boolean(depositAmount) && summaryAmount === depositAmount;
  const canShowSummary =
    isSummaryCurrent ||
    (summaryAmount !== undefined &&
      summaryAmount === shownSummaryAmountRef.current);
  const canShowLineSummary =
    isSummaryCurrent ||
    (summaryAmount !== undefined &&
      summaryAmount === lineShownSummaryAmountRef.current);
  const lendingAmount = depositSummary.lendingAmount;
  // Left empty, dashes: nothing of the last amount's is on screen any more,
  // so its answer can't come back as the one shown
  if (!hasAmount && !isEmptySettling) {
    shownLendingAmountRef.current = undefined;
  }
  const canShowLending =
    lendingAmount !== undefined &&
    (lendingAmount === shownLendingAmountRef.current ||
      (shownDeposit
        ? Boolean(depositAmount) && lendingAmount === depositAmount
        : lendingAmount === '0'));
  if (canShowLending) {
    shownLendingAmountRef.current = lendingAmount;
  }

  // With no card to ask for: a year at the provider's rate, in the token
  // deposited and in money. For the estimate shown, so the last one's stays
  // (dimmed) while the next amount is quoted, as the other figures do
  const rewards = useMemo(() => {
    if (summaryRequest || !shownDeposit || !apr || apr <= 0) {
      return undefined;
    }
    const tokens = new BigNumber(shownDeposit).times(apr).div(100);
    return {
      amount: tokens.toFixed(),
      fiat: toFiat(tokens.times(depositToken.priceUsd).toFixed()),
    };
  }, [apr, depositToken.priceUsd, shownDeposit, summaryRequest, toFiat]);

  // The wallet's confirm for the swap, as the Swap page sends one (with an
  // approval in the same confirm): what went out, nothing when rejected
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId,
    networkId,
  });
  const confirmSwap = useCallback(
    (prepared: IEarnSwapPrepared) =>
      new Promise<ISendTxOnSuccessData | undefined>((resolve, reject) => {
        let isSettled = false;
        const settle = (data?: ISendTxOnSuccessData) => {
          if (!isSettled) {
            isSettled = true;
            resolve(data);
          }
        };
        const fail = (error: unknown) => {
          if (!isSettled) {
            isSettled = true;
            reject(error);
          }
        };
        void navigationToTxConfirm({
          isInternalSwap: true,
          encodedTx: prepared.execution.encodedTx,
          approvesInfo: prepared.approvesInfo.length
            ? prepared.approvesInfo
            : undefined,
          swapInfo: prepared.execution.swapInfo,
          onSuccess: (data) =>
            settle(
              data.find(
                (item) => item.signedTx.swapInfo && !item.approveInfo,
              ) ?? data[data.length - 1],
            ),
          onFail: fail,
          onCancel: () => settle(),
        }).catch(fail);
      }),
    [navigationToTxConfirm],
  );
  // In the Swap history, as any swap: the in-app notice follows it to the end
  const recordSwap = useCallback(
    async (sent: ISendTxOnSuccessData, prepared: IEarnSwapPrepared) => {
      const swapNetworks = await backgroundApiProxy.serviceSwap
        .fetchSwapNetworks()
        .catch(() => []);
      await completeBroadcastedSwapSuccess({
        txId: sent.signedTx.txid,
        swapInfo: prepared.execution.swapInfo,
        gasFeeFiatValue: sent.decodedTx.totalFeeFiatValue,
        gasFeeInNative: sent.decodedTx.totalFeeInNative,
        generateSwapHistoryItem: (params) =>
          generateSwapHistoryItemForContext(params, {
            swapNetworks,
            currencyInfo,
          }),
      });
    },
    [currencyInfo],
  );

  // A run outlives renders; closing the form stops waiting on it (a sent
  // swap goes on regardless)
  const runRef = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => runRef.current?.abort(), []);
  const onSwappedRef = useRef(onSwapped);
  onSwappedRef.current = onSwapped;
  const handleStart = useCallback(async () => {
    if (!account) {
      return;
    }
    const controller = new AbortController();
    runRef.current?.abort();
    runRef.current = controller;
    const { signal } = controller;
    dispatch({ type: 'prepare' });
    try {
      // A fresh quote: the one on screen may be a while old
      const freshQuote = await fetchEarnSwapQuote({
        fromToken,
        toToken,
        amount,
        account,
        signal,
      });
      setQuoteState({ amount, quote: freshQuote, isLoading: false });
      if (
        beforeSwap &&
        !(await beforeSwap(
          freshQuote.minToAmount || freshQuote.toAmount || '0',
        ))
      ) {
        dispatch({ type: 'stop' });
        return;
      }
      const prepared = await prepareEarnSwap({
        quote: freshQuote,
        fromToken,
        toToken,
        amount,
        account,
      });
      const balanceBefore = await readEarnSwapBalance({
        token: toToken,
        account,
      });
      if (signal.aborted) {
        throw new EarnSwapError('cancelled');
      }
      dispatch({ type: 'confirm' });
      const sent = await confirmSwap(prepared);
      if (!sent) {
        dispatch({ type: 'stop' });
        return;
      }
      dispatch({ type: 'sent' });
      void recordSwap(sent, prepared);
      const leastReceived =
        freshQuote.minToAmount || freshQuote.toAmount || '0';
      const { receivedAmount } = await waitForEarnSwap({
        txId: sent.signedTx.txid,
        prepared,
        toToken,
        account,
        landedBalance:
          balanceBefore === undefined
            ? undefined
            : new BigNumber(balanceBefore).plus(leastReceived).toFixed(),
        signal,
      });
      const expected = receivedAmount || leastReceived;
      const balanceAfter = await waitForEarnSwapBalance({
        token: toToken,
        atLeast: new BigNumber(balanceBefore ?? 0).plus(expected).toFixed(),
        account,
        signal,
      });
      const deposit = getEarnSwapDepositAmount({
        receivedAmount,
        balanceBefore,
        balanceAfter,
        minToAmount: freshQuote.minToAmount,
        decimals: depositToken.inputDecimals ?? depositToken.decimals,
      });
      dispatch({ type: 'landed', amount: deposit, balance: balanceAfter });
      onSwappedRef.current({ amount: deposit, balance: balanceAfter });
    } catch (error: unknown) {
      dispatch({ type: 'stop' });
      if (signal.aborted) {
        return;
      }
      // Errors the swap service raised have shown their own toast
      if ((error as IOneKeyError | undefined)?.autoToast) {
        return;
      }
      const reason = error instanceof EarnSwapError ? error.reason : 'failed';
      const messageId = SWAP_ERROR_MESSAGE[reason];
      if (messageId) {
        Toast.error({
          title: intl.formatMessage({ id: messageId }),
          message:
            error instanceof EarnSwapError && error.message !== reason
              ? error.message
              : undefined,
        });
      }
    }
  }, [
    account,
    amount,
    beforeSwap,
    confirmSwap,
    depositToken.decimals,
    depositToken.inputDecimals,
    fromToken,
    intl,
    recordSwap,
    toToken,
  ]);

  const isBusy = !isIdle;
  // Nothing to change while the swap runs, or while the provider is off
  const isLocked = isBusy || Boolean(isDisabled);
  // Pendle's line (the PT bought) comes with its own quote, after the swap's:
  // the button waits for it, as a vault's waits for its line, so it never
  // lights up beside a placeholder. An answer without a figure (an amount
  // too small for the market, or a failed quote) leaves the line a dash and
  // the button off: the buy after the swap would have nothing to go on
  const isPendleLineComing =
    summaryRequest?.kind === 'pendle' &&
    Boolean(depositAmount) &&
    depositSummary.stakingAmount !== depositAmount;
  const isPendleLineMissing =
    summaryRequest?.kind === 'pendle' &&
    !new BigNumber(
      earnUtils.extractAmountFromText(
        depositSummary.staking?.receive?.description,
      ),
    ).gt(0);
  const canStart =
    !isDisabled &&
    hasAmount &&
    !isInsufficient &&
    Boolean(depositAmount) &&
    !isPendleLineComing &&
    !isPendleLineMissing &&
    Boolean(account);

  const handleSelectPercentage = useCallback(
    (percent: number) => {
      const max = getEarnSwapPayMax({
        balance: payToken.amount,
        isNative: payToken.token.isNative,
        reserveGas: nativeConfig?.reserveGas,
        decimals: payToken.token.decimals,
      });
      setAmount(
        new BigNumber(percent >= 100 ? max : payToken.amount)
          .times(percent >= 100 ? 1 : percent / 100)
          .decimalPlaces(
            Math.min(payToken.token.decimals, FILL_DECIMALS),
            BigNumber.ROUND_DOWN,
          )
          .toFixed(),
      );
    },
    [
      nativeConfig?.reserveGas,
      payToken.amount,
      payToken.token.decimals,
      payToken.token.isNative,
    ],
  );
  const handleMax = useCallback(() => {
    setAmount(
      new BigNumber(
        getEarnSwapPayMax({
          balance: payToken.amount,
          isNative: payToken.token.isNative,
          reserveGas: nativeConfig?.reserveGas,
          decimals: payToken.token.decimals,
        }),
      )
        .decimalPlaces(
          Math.min(payToken.token.decimals, FILL_DECIMALS),
          BigNumber.ROUND_DOWN,
        )
        .toFixed(),
    );
  }, [
    nativeConfig?.reserveGas,
    payToken.amount,
    payToken.token.decimals,
    payToken.token.isNative,
  ]);

  // One press runs the swap, as "Approve and Deposit" runs both of its
  // steps; the deposit form carries on from there. The guide's preview takes
  // the press itself and sends nothing, as the deposit form's override does
  const overridesState =
    footerActionOverride && !footerActionOverride.isPressOnly;
  // What goes in is what the swap brings, as a landed swap hands it over
  const handleOverridePress = useCallback(() => {
    if (depositAmount) {
      onAmountChange?.(depositAmount);
    }
    footerActionOverride?.onPress();
  }, [depositAmount, footerActionOverride, onAmountChange]);
  // Picked another protocol a moment ago: this form is the one being left
  const isSwitchingOffer = useContext(EarnFormSwitchingContext);
  const handlePress = footerActionOverride ? handleOverridePress : handleStart;
  const confirmButtonProps = {
    testID: 'earn-router-swap-deposit',
    onPress: isSwitchingOffer ? undefined : handlePress,
    loading: footerActionOverride
      ? Boolean(footerActionOverride.loading)
      : isBusy,
    disabled: overridesState
      ? Boolean(footerActionOverride.disabled)
      : !canStart && !isBusy,
  };
  // While another protocol loads, the button waits under its own words
  const confirmText =
    overridesState && !footerActionOverride.isSwitchWait
      ? footerActionOverride.text
      : EARN_DESKTOP_DEMO_COPY.swapAnd(actionLabel);
  // The steps show once pressed: the button already names them
  const progress = isBusy ? (
    <StakeProgress
      currentStep={getProgressStep(flow)}
      step1Label={intl.formatMessage({ id: ETranslations.global_swap })}
      step2Label={actionLabel}
      isRunning
    />
  ) : null;

  // What it gets you, as the provider's own form shows it: the server's
  // rewards for a vault, a year at the supply rate for a lending market,
  // what Pendle pays at maturity and its rates, else a year at the
  // provider's rate. With nothing typed the rows keep their places with a
  // dash
  const stakingSummary = depositSummary.staking;
  const isPendle = summaryRequest?.kind === 'pendle';
  // No figures yet: nothing typed, no route, the rows still the empty
  // amount's (the first estimate's are on their way), no Pendle quote, or
  // an answer that never was on screen
  const isSummaryPlaceholder =
    (!hasAmount && !isEmptySettling) ||
    hasNoRoute ||
    !shownDeposit ||
    (summaryRequest?.kind === 'staking' &&
      (depositSummary.stakingAmount === '0' ||
        Boolean(depositSummary.isStakingFailed))) ||
    (isPendle && !stakingSummary) ||
    ((summaryRequest?.kind === 'staking' || isPendle) && !canShowSummary);
  // From the swap's new estimate until the provider's answer for it
  const isSummaryUpdating =
    (summaryRequest?.kind === 'staking' || isPendle) &&
    Boolean(shownDeposit) &&
    depositSummary.stakingAmount !== shownDeposit;
  // The provider's rows had settled for this estimate (its answer in, with
  // figures or without): through an emptied box's moment they stay as they
  // were, the figures dimmed and the dashes dashes, nothing being on its way.
  // Rows still waiting for their answer keep their placeholders
  const summarySettledRef = useRef(false);
  const isHoldingSettledSummary = isEmptySettling && summarySettledRef.current;
  const isSummaryLoading =
    isQuoting ||
    isSummaryUpdating ||
    (isEmptySettling && !isHoldingSettledSummary);
  if (hasAmount) {
    summarySettledRef.current = !isSummaryLoading;
  }
  if (!isSummaryPlaceholder) {
    shownSummaryAmountRef.current = summaryAmount;
    shownSummaryRef.current = depositSummary;
  } else if (!isSummaryLoading) {
    // Dashes: nothing of the last amount's is on screen any more
    shownSummaryAmountRef.current = undefined;
    lineShownSummaryAmountRef.current = undefined;
    shownSummaryRef.current = undefined;
  }
  // Pendle's quote split as its own form splits it: what you get at
  // maturity is the result, the rates are rows
  const pendleQuote = isPendle ? stakingSummary : undefined;
  const pendleRewardRows = useMemo(
    () =>
      splitPendleRewardRows(
        (pendleQuote?.rewards ?? []).filter(
          (reward) =>
            !!reward?.title?.text?.trim() &&
            !!reward?.description?.text?.trim(),
        ),
      ),
    [pendleQuote?.rewards],
  );
  const pendleMarketQuote = useMemo(
    () => keepPendleMarketRows(pendleQuote),
    [pendleQuote],
  );
  const pendleMarketRows = usePendleTransactionDetails({
    transactionConfirmation: pendleMarketQuote,
    amountValue: depositSummary.stakingAmount ?? '',
    isPendleLikeLayout: isPendle,
    placeholder: isSummaryPlaceholder,
  });
  if (pendleQuote) {
    const { outcomeRow, detailRows } = pendleRewardRows;
    lastPendleSwapLabels = {
      outcome: outcomeRow
        ? { title: outcomeRow.title.text.trim(), tooltip: outcomeRow.tooltip }
        : lastPendleSwapLabels?.outcome,
      rows: [
        ...detailRows.map((row) => ({
          title: row.title.text,
          tooltip: row.tooltip,
        })),
        ...(
          pendleMarketQuote?.transactionDetails?.data?.transactionDetails ?? []
        ).map((row) => ({ title: row.title.text, tooltip: row.tooltip })),
      ],
    };
  }
  // From the swap's new estimate until the market's answer for it
  const isLendingLoading =
    depositSummary.lendingLoading ||
    (Boolean(shownDeposit) && depositSummary.lendingAmount !== shownDeposit);
  // The market's answer for this estimate failed: through an emptied box's
  // moment its dashes stay, and the figures there dim
  const lendingShowedDashesRef = useRef(false);
  if (hasAmount) {
    lendingShowedDashesRef.current =
      !isQuoting &&
      canShowLending &&
      !depositSummary.lending &&
      !isLendingLoading;
  }
  const isHoldingLendingDashes =
    isEmptySettling && lendingShowedDashesRef.current;
  let summary: ReactNode;
  if (summaryRequest?.kind === 'lending') {
    summary = isDisabled ? null : (
      <EarnLendingSummary
        amountValue={shownDeposit}
        tokenSymbol={depositToken.symbol}
        price={depositToken.priceUsd}
        currencySymbol={currencyInfo.symbol}
        transactionConfirmation={
          canShowLending ? depositSummary.lending : undefined
        }
        // Until the market's first answer here (it comes after the swap's
        // estimate): its rows for an empty amount, as last read, so the
        // rows are in place from the first frame
        rowsStandIn={readFirstFrame<IBorrowTransactionConfirmation>(
          buildSupplyEmptyFirstFrameKey({
            accountId: summaryRequest.accountId,
            networkId,
            provider: summaryRequest.provider,
            marketAddress: summaryRequest.marketAddress,
            reserveAddress: summaryRequest.reserveAddress,
          }),
        )}
        transactionConfirmationLoading={isLendingLoading}
        // The amount supplied comes with the swap's estimate: until then
        // the figures wait (dimmed, or placeholders), as the line does
        isAmountComing={
          isQuoting || (isEmptySettling && !isHoldingLendingDashes)
        }
        isDimmed={isHoldingLendingDashes}
        // The estimate itself stays a moment through an emptied box
        keepsFiguresWhenEmptied={false}
      />
    );
  } else if (isPendle) {
    const { outcomeRow, detailRows } = pendleRewardRows;
    const outcomeValue = isSummaryPlaceholder
      ? undefined
      : buildOutcomeValueFromText(outcomeRow?.description);
    const outcome: IEarnOutcome = {
      label:
        outcomeRow?.title.text.trim() ||
        lastPendleSwapLabels?.outcome?.title ||
        EARN_DESKTOP_DEMO_COPY.atMaturityYouGet,
      tooltip: outcomeRow?.tooltip ?? lastPendleSwapLabels?.outcome?.tooltip,
      values: outcomeValue ? [outcomeValue] : [],
      isEarning: true,
      // Under the amount at maturity, the gain
      hasNoteLine: true,
    };
    const reservedRows: IPendleRowLabel[] =
      lastPendleSwapLabels?.rows ??
      EARN_DESKTOP_DEMO_COPY.pendleRateRowTitles.map((title) => ({ title }));
    // Keyed by label, as Pendle's market rows are: the rows holding their
    // places become the rows with their figures, which fade in there
    const rateRowKeys = buildRowKeys(detailRows.map((row) => row.title.text));
    const reservedRowKeys = buildRowKeys(reservedRows.map((row) => row.title));
    const rows = pendleQuote
      ? [
          ...detailRows.map((row, index) => (
            <EarnFormRow
              key={rateRowKeys[index]}
              label={row.title.text}
              tooltip={row.tooltip}
              value={
                isSummaryPlaceholder ? undefined : (
                  <EarnText
                    text={row.description}
                    size="$bodyMdMedium"
                    textAlign="right"
                  />
                )
              }
            />
          )),
          ...pendleMarketRows,
        ]
      : reservedRows.map((row, index) => (
          <EarnFormRow
            key={reservedRowKeys[index]}
            label={row.title}
            tooltip={row.tooltip}
          />
        ));
    summary = isDisabled ? null : (
      <EarnFormSummary
        outcome={outcome}
        isLoading={isSummaryLoading}
        isDimmed={isHoldingSettledSummary}
        rows={rows}
      />
    );
  } else {
    const outcome: IEarnOutcome =
      summaryRequest?.kind === 'staking'
        ? buildRewardsOutcome({
            transactionConfirmation: stakingSummary,
            placeholderLabel: EARN_DESKTOP_DEMO_COPY.estAnnualRewards,
            withoutValues: isSummaryPlaceholder,
            linesKey: buildResultLinesKey({
              networkId,
              provider: summaryRequest.provider,
              vault: summaryRequest.vault,
              symbol: summaryRequest.symbol,
            }),
          })
        : {
            label: EARN_DESKTOP_DEMO_COPY.estAnnualRewards,
            values: rewards
              ? [
                  {
                    main: `${numberFormat(rewards.amount, {
                      formatter: 'balance',
                    })} ${depositToken.symbol}`,
                    suffix: numberFormat(rewards.fiat, {
                      formatter: 'value',
                      formatterOptions: { currency: currencyInfo.symbol },
                    }),
                  },
                ]
              : [],
            isEarning: true,
          };
    const receive =
      summaryRequest?.kind === 'staking' ? stakingSummary?.receive : undefined;
    const rows = [
      ...(summaryRequest?.kind === 'staking'
        ? buildRewardNoteRows({
            transactionConfirmation: stakingSummary,
            withoutValues: isSummaryPlaceholder,
          })
        : []),
      ...(receive
        ? [
            <EarnFormRow
              key="receive"
              label={receive.title.text}
              tooltip={receive.tooltip}
              value={
                isSummaryPlaceholder ? undefined : (
                  <EarnText
                    text={receive.description}
                    size="$bodyMdMedium"
                    textAlign="right"
                  />
                )
              }
            />,
          ]
        : []),
    ];
    summary = isDisabled ? null : (
      <EarnFormSummary
        outcome={outcome}
        isLoading={isSummaryLoading}
        isDimmed={isHoldingSettledSummary}
        rows={rows}
      />
    );
  }

  // The line under the box: the swap's estimate once quoted (the last one,
  // dimmed, while the next is), or for Pendle the PT its buy gets for that,
  // as Pendle's own form's line. A dash before an amount or with no route
  let depositLine = '–';
  if (summaryRequest?.kind === 'pendle') {
    const bought =
      isSummaryPlaceholder || !canShowLineSummary
        ? ''
        : earnUtils.extractAmountFromText(pendleQuote?.receive?.description);
    if (new BigNumber(bought).gt(0)) {
      depositLine = `≈ ${numberFormat(bought, {
        formatter: 'balance',
      })} ${summaryRequest.receiveSymbol}`;
    }
  } else if (lineDeposit) {
    depositLine = `≈ ${numberFormat(lineDeposit, {
      formatter: 'balance',
    })} ${depositToken.symbol}`;
  }
  const isDepositLinePlaceholder = !depositLine.startsWith('≈');
  if (isPendle && !isDepositLinePlaceholder && !isInsufficient) {
    lineShownSummaryAmountRef.current = summaryAmount;
  }

  // A route problem is not the amount's: it stays a notice under the
  // protocol. It opens and closes over the line's time, as everything under
  // the box does, and fades with it. It stays while the next amount's quote
  // is on its way (a second failure leaves it in place rather than closing
  // and opening it again) and closes once a quote comes; emptied, it stays
  // its moment as figures do (keys while the box has no amount keep it)
  const routeAlertShownRef = useRef(false);
  const isRouteAlertEmptiedRef = useRef(false);
  const routeAlertHadAmountRef = useRef(hasAmount);
  if (routeAlertHadAmountRef.current !== hasAmount) {
    routeAlertHadAmountRef.current = hasAmount;
    isRouteAlertEmptiedRef.current = !hasAmount && routeAlertShownRef.current;
  }
  const [, setRouteAlertTick] = useState(0);
  useEffect(() => {
    if (hasAmount || !isRouteAlertEmptiedRef.current) {
      return undefined;
    }
    const timer = setTimeout(() => {
      isRouteAlertEmptiedRef.current = false;
      setRouteAlertTick((tick) => tick + 1);
    }, EARN_EMPTIED_HOLD_MS);
    return () => clearTimeout(timer);
  }, [hasAmount, typedAmount]);
  // From the frame the amount is typed: the quote shown is another
  // amount's (or none) until this one's is asked for
  const isNextQuoteComing =
    hasAmount &&
    canQuote &&
    !quoteState.quote &&
    (quoteState.isLoading || quoteState.amount !== amount);
  const showsRouteAlert =
    !isInsufficient &&
    (hasNoRoute ||
      (hasAmount && !isSwappable) ||
      (routeAlertShownRef.current &&
        (isNextQuoteComing || isRouteAlertEmptiedRef.current)));
  routeAlertShownRef.current = showsRouteAlert;
  // There as the form mounts, it shows at once (decided once: the height
  // transition lays its content out by it)
  const [routeAlertFromStart] = useState(showsRouteAlert);
  const routeAlert = (
    <Alert
      icon="InfoCircleOutline"
      type="warning"
      title={intl.formatMessage({
        id: ETranslations.swap_page_alert_no_provider_supports_trade,
      })}
    />
  );

  return (
    <StakingFormWrapper>
      <YStack>
        <StakingAmountInput
          title={EARN_DESKTOP_DEMO_COPY.payWith}
          disabled={isLocked}
          hasError={isInsufficient}
          value={typedAmount}
          onChange={onChangeAmount}
          onBlur={onBlurAmount}
          tokenSelectorTriggerProps={{
            selectedTokenImageUri: payToken.token.logoURI,
            selectedTokenSymbol: payToken.token.symbol,
            selectedNetworkImageUri: network?.logoURI,
            disabled: isLocked,
            onPress: onOpenPayWith,
            ...buildKeyboardPressProps(
              isLocked
                ? undefined
                : (onOpenPayWithFromKeyboard ?? onOpenPayWith),
            ),
            ...payWithTrigger,
          }}
          balanceProps={{
            value: payToken.amount,
            onPress: isLocked ? undefined : handleMax,
          }}
          inputProps={{ placeholder: '0', autoFocus: !isLocked }}
          valueProps={{
            value: payFiat,
            // "$0.00" before an amount, as on the Swap page
            currency: currencyInfo.symbol,
          }}
          enableMaxAmount
          onSelectPercentageStage={handleSelectPercentage}
          bottomContent={amountBoxBottom}
          boxTestID={amountBoxTestID}
          onRefreshBalance={onRefreshBalance}
        />
        {/* What goes into the vault, under what pays for it; more than the
            balance says so in its place, in red. Brought in by a pick in
            Pay with, it grows in under the box */}
        <HeightTransition
          duration={DEPOSIT_LINE_MS}
          skipInitialAnimation={!revealsDepositLine}
        >
          <YStack pt="$2">
            {isInsufficient ? (
              <SizableText
                testID="earn-amount-error"
                px="$3.5"
                size="$bodyMd"
                color="$textCritical"
              >
                {intl.formatMessage({
                  id: ETranslations.earn_insufficient_balance,
                })}
              </SizableText>
            ) : (
              <StakingAmountResultLine
                testID={
                  isPendle
                    ? 'earn-pendle-receive-amount'
                    : 'earn-router-swap-deposit-amount'
                }
                label={depositLineLabel}
                value={depositLine}
                isPlaceholder={isDepositLinePlaceholder}
                loading={
                  isQuoting ||
                  isEmptySettling ||
                  (isPendle && isSummaryUpdating)
                }
              />
            )}
          </YStack>
        </HeightTransition>
      </YStack>
      {/* The protocol stays under the amount; what typing brings up goes
          below it */}
      {protocolSwitch ?? offerSwitch}
      {/* Always there, so the alert can open and close: its margin takes
          back the form's gap while it is closed */}
      <YStack mb="$-4">
        <HeightTransition
          duration={DEPOSIT_LINE_MS}
          hide={!showsRouteAlert}
          skipInitialAnimation={routeAlertFromStart}
        >
          <YStack pb="$4" aria-hidden={!showsRouteAlert}>
            {routeAlert}
          </YStack>
        </HeightTransition>
      </YStack>
      {summary}
      {isInModalContext ? (
        <Page.Footer>
          <EarnFooterFade>
            <Stack
              bg="$bgApp"
              flexDirection="column"
              $gtMd={{
                flexDirection: 'row',
                alignItems: 'center',
                jc: 'space-between',
              }}
            >
              {progress ? (
                <Stack pl="$5" $md={{ pt: '$5' }}>
                  {progress}
                </Stack>
              ) : (
                <Stack />
              )}
              <Page.FooterActions
                onConfirmText={confirmText}
                confirmButtonProps={confirmButtonProps}
              />
            </Stack>
            <PercentageStageOnKeyboard
              onSelectPercentageStage={
                isLocked ? undefined : handleSelectPercentage
              }
              reserveSpaceUntilKeyboardShown={!isLocked}
            />
          </EarnFooterFade>
        </Page.Footer>
      ) : (
        <YStack bg="$bgApp" gap="$5">
          {progress}
          <Page.FooterActions
            p={0}
            onConfirmText={confirmText}
            buttonContainerProps={{ $gtMd: { ml: '0' }, w: '100%' }}
            confirmButtonProps={{ ...confirmButtonProps, w: '100%' }}
          />
        </YStack>
      )}
    </StakingFormWrapper>
  );
}
