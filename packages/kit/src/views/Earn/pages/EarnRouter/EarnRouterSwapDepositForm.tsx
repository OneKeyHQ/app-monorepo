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
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import tokenRebaseUtils from '@onekeyhq/shared/src/utils/tokenRebaseUtils';
import { ECheckAmountActionType } from '@onekeyhq/shared/types/staking';
import type {
  IBorrowTransactionConfirmation,
  IStakeTransactionConfirmation,
} from '@onekeyhq/shared/types/staking';
import type { IFetchQuoteResult } from '@onekeyhq/shared/types/swap/types';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { EarnLendingSummary } from '../../../Borrow/components/ManagePosition/modules/InfoDisplaySection/EarnLendingSummary';
import { EarnFooterFade } from '../../../Staking/components/EarnFooterFade';
import { EarnText } from '../../../Staking/components/ProtocolDetails/EarnText';
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
  buildRewardNoteRows,
  buildRewardsOutcome,
} from '../../../Staking/components/UniversalStake/EarnFormSummary';
import { completeBroadcastedSwapSuccess } from '../../../Swap/hooks/swapBroadcastSuccess';
import { generateSwapHistoryItemForContext } from '../../../Swap/hooks/useSwapTxHistory';
import { EARN_DESKTOP_DEMO_COPY } from '../../components/desktopHome/earnDesktopHomeCopy';
import { buildKeyboardPressProps } from '../../components/desktopHome/earnDesktopPressable';

import {
  buildEmptyAmountFirstFrameKey,
  keepFirstFrame,
  readFirstFrame,
} from './earnFirstFrameCache';
import {
  EARN_ROUTER_SWAP_IDLE,
  buildEarnSwapToken,
  earnRouterSwapReducer,
  getEarnSwapDepositAmount,
  getEarnSwapPayMax,
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

/**
 * What the provider's own deposit form asks the server for its card: a
 * staking provider's summary, or a lending market's info. Pendle's form
 * reads its card off a swap quote, so it has none here
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
  lending?: IBorrowTransactionConfirmation;
  lendingLoading: boolean;
};

const NO_SUMMARY: IDepositSummary = { lendingLoading: false };

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
    );
    return staking
      ? { staking, stakingAmount: '0', lendingLoading: false }
      : NO_SUMMARY;
  });
  useDeepCompareEffect(() => {
    if (!request || isDisabled) {
      setSummary(NO_SUMMARY);
      return;
    }
    const hasAmount = new BigNumber(amount).gt(0);
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
            if (isCurrent) {
              setSummary({ lending, lendingLoading: false });
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
          // The last rows stay
          if (isCurrent) {
            setSummary((prev) => ({
              ...prev,
              stakingAmount: requestAmount,
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
  const [amount, setAmount] = useState(initialAmount ?? '');
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
  const canQuote = hasAmount && isSwappable;
  useEffect(() => {
    // While the swap runs the estimate stays as it went to the wallet
    if (!isIdle) {
      return;
    }
    if (!canQuote) {
      setQuoteState(NO_QUOTE);
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
        fromToken,
        toToken,
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
  }, [account, amount, canQuote, fromToken, isIdle, toToken]);
  const quote = quoteState.amount === amount ? quoteState.quote : undefined;
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
  if (depositAmount) {
    lastDepositRef.current = depositAmount;
  } else if (!isQuoting) {
    lastDepositRef.current = '';
  }
  const shownDeposit = depositAmount || lastDepositRef.current;
  const payFiat = hasAmount
    ? toFiat(amountValue.times(payToken.priceUsd).toFixed())
    : '';
  const depositSummary = useDepositSummary({
    networkId,
    request: summaryRequest,
    amount: shownDeposit,
    isDisabled,
  });

  // With no card to ask for: a year at the provider's rate, in the token
  // deposited and in money
  const rewards = useMemo(() => {
    if (summaryRequest || !depositAmount || !apr || apr <= 0) {
      return undefined;
    }
    const tokens = new BigNumber(depositAmount).times(apr).div(100);
    return {
      amount: tokens.toFixed(),
      fiat: toFiat(tokens.times(depositToken.priceUsd).toFixed()),
    };
  }, [apr, depositAmount, depositToken.priceUsd, summaryRequest, toFiat]);

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
  const canStart =
    !isDisabled &&
    hasAmount &&
    !isInsufficient &&
    Boolean(depositAmount) &&
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
  // else a year at the provider's rate. With nothing typed the rows keep
  // their places with a dash
  const stakingSummary = depositSummary.staking;
  // No figures yet: nothing typed, no route, or the rows still the empty
  // amount's (the first estimate's are on their way)
  const isSummaryPlaceholder =
    !hasAmount ||
    hasNoRoute ||
    !shownDeposit ||
    (summaryRequest?.kind === 'staking' &&
      depositSummary.stakingAmount === '0');
  let summary: ReactNode;
  if (summaryRequest?.kind === 'lending') {
    summary = isDisabled ? null : (
      <EarnLendingSummary
        amountValue={shownDeposit}
        tokenSymbol={depositToken.symbol}
        price={depositToken.priceUsd}
        currencySymbol={currencyInfo.symbol}
        transactionConfirmation={depositSummary.lending}
        transactionConfirmationLoading={depositSummary.lendingLoading}
      />
    );
  } else {
    const isStakingUpdating =
      summaryRequest?.kind === 'staking' &&
      Boolean(shownDeposit) &&
      depositSummary.stakingAmount !== shownDeposit;
    const outcome: IEarnOutcome =
      summaryRequest?.kind === 'staking'
        ? buildRewardsOutcome({
            transactionConfirmation: stakingSummary,
            placeholderLabel: EARN_DESKTOP_DEMO_COPY.estAnnualRewards,
            withoutValues: isSummaryPlaceholder,
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
        isLoading={isQuoting || isStakingUpdating}
        rows={rows}
      />
    );
  }

  // The deposit line: the swap's estimate once quoted (the last one, dimmed,
  // while the next is); a dash before an amount or with no route
  let depositLine = '–';
  if (shownDeposit) {
    depositLine = `≈ ${numberFormat(shownDeposit, {
      formatter: 'balance',
    })} ${depositToken.symbol}`;
  }

  // A route problem is not the amount's: it stays a notice under the
  // protocol
  const routeAlert =
    !isInsufficient && (hasNoRoute || (hasAmount && !isSwappable)) ? (
      <Alert
        icon="InfoCircleOutline"
        type="warning"
        title={intl.formatMessage({
          id: ETranslations.swap_page_alert_no_provider_supports_trade,
        })}
      />
    ) : null;

  return (
    <StakingFormWrapper>
      <YStack>
        <StakingAmountInput
          title={EARN_DESKTOP_DEMO_COPY.payWith}
          disabled={isLocked}
          hasError={isInsufficient}
          value={amount}
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
                testID="earn-router-swap-deposit-amount"
                label={depositLineLabel}
                value={depositLine}
                isPlaceholder={!shownDeposit}
                loading={isQuoting}
              />
            )}
          </YStack>
        </HeightTransition>
      </YStack>
      {/* The protocol stays under the amount; what typing brings up goes
          below it */}
      {protocolSwitch ?? offerSwitch}
      {routeAlert}
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
