import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IBorrowTransactionConfirmation,
  ICheckAmountAlert,
  IEarnEstimateFeeResp,
} from '@onekeyhq/shared/types/staking';

import {
  buildSupplyEmptyFirstFrameKey,
  keepFirstFrame,
  readFirstFrame,
} from '../../../Earn/pages/EarnRouter/earnFirstFrameCache';

export type IBorrowActionType = 'supply' | 'withdraw' | 'borrow' | 'repay';

export type IUniversalBorrowActionParams = {
  action: IBorrowActionType;
  accountId: string;
  networkId: string;
  provider: string;
  marketAddress: string;
  reserveAddress: string;
  amount: string;
  isDisabled?: boolean;
  withdrawAll?: boolean;
  repayAll?: boolean;
};

export type IUniversalBorrowActionState = {
  estimateFeeResp?: IEarnEstimateFeeResp;
  transactionConfirmation?: IBorrowTransactionConfirmation;
  transactionConfirmationLoading: boolean;
  checkAmountMessage: string;
  checkAmountAlerts: ICheckAmountAlert[];
  checkAmountLoading: boolean;
  isCheckAmountMessageError: boolean;
  checkAmountResult?: boolean;
  riskOfLiquidationAlert?: boolean;
};

type IBorrowCheckAmountState = {
  requestKey: string;
  checkAmountMessage: string;
  checkAmountAlerts: ICheckAmountAlert[];
  checkAmountLoading: boolean;
  checkAmountResult?: boolean;
  riskOfLiquidationAlert?: boolean;
};

type IBorrowTransactionConfirmationState = {
  requestKey: string;
  transactionConfirmation?: IBorrowTransactionConfirmation;
  transactionConfirmationLoading: boolean;
};

function createEmptyBorrowTransactionConfirmationState({
  requestKey,
}: {
  requestKey: string;
}): IBorrowTransactionConfirmationState {
  return {
    requestKey,
    transactionConfirmation: undefined,
    transactionConfirmationLoading: false,
  };
}

// As long as an emptied box keeps its figures (EarnLendingSummary)
const EMPTIED_HOLD_MS = 350;
// How long after the box was emptied its answer can still be taken back
const TAKE_BACK_MS = 3000;

type IEmptiedAnswer = {
  requestKey: string;
  transactionConfirmation: IBorrowTransactionConfirmation;
  at: number;
  // Typed into while it still kept its figures
  refilled: boolean;
};
const canTakeBack = (
  emptied: IEmptiedAnswer | undefined,
  requestKey: string,
): emptied is IEmptiedAnswer =>
  emptied?.requestKey === requestKey &&
  Date.now() - emptied.at <= TAKE_BACK_MS &&
  (emptied.refilled || Date.now() - emptied.at <= EMPTIED_HOLD_MS);

export function resolveBorrowTransactionConfirmationStateForRequest({
  requestKey,
  shouldFetch,
  state,
}: {
  requestKey: string;
  shouldFetch: boolean;
  state: IBorrowTransactionConfirmationState;
}): IBorrowTransactionConfirmationState {
  if (!shouldFetch) {
    return createEmptyBorrowTransactionConfirmationState({
      requestKey,
    });
  }

  if (state.requestKey !== requestKey) {
    return {
      requestKey,
      transactionConfirmation: undefined,
      transactionConfirmationLoading: true,
    };
  }

  return state;
}

function createEmptyBorrowCheckAmountState({
  requestKey,
  loading = false,
}: {
  requestKey: string;
  loading?: boolean;
}): IBorrowCheckAmountState {
  return {
    requestKey,
    checkAmountMessage: '',
    checkAmountAlerts: [],
    checkAmountLoading: loading,
    checkAmountResult: undefined,
    riskOfLiquidationAlert: undefined,
  };
}

export function resolveBorrowCheckAmountStateForRequest({
  requestKey,
  shouldCheckAmount,
  state,
}: {
  requestKey: string;
  shouldCheckAmount: boolean;
  state: IBorrowCheckAmountState;
}): IBorrowCheckAmountState {
  if (!shouldCheckAmount) {
    return createEmptyBorrowCheckAmountState({ requestKey });
  }

  if (state.requestKey !== requestKey) {
    return createEmptyBorrowCheckAmountState({
      requestKey,
      loading: true,
    });
  }

  return state;
}

const isAmountInvalid = (amount: string) =>
  BigNumber(amount).isNaN() ||
  (typeof amount === 'string' && amount.endsWith('.'));

export function useUniversalBorrowAction({
  action,
  accountId,
  networkId,
  provider,
  marketAddress,
  reserveAddress,
  amount,
  isDisabled = false,
  withdrawAll,
  repayAll,
}: IUniversalBorrowActionParams): IUniversalBorrowActionState {
  const intl = useIntl();
  const [estimateFeeResp, setEstimateFeeResp] = useState<
    IEarnEstimateFeeResp | undefined
  >();
  const [transactionConfirmationState, setTransactionConfirmationState] =
    useState<IBorrowTransactionConfirmationState>(() =>
      createEmptyBorrowTransactionConfirmationState({
        requestKey: '',
      }),
    );
  const [checkAmountState, setCheckAmountState] =
    useState<IBorrowCheckAmountState>(() =>
      createEmptyBorrowCheckAmountState({ requestKey: '' }),
    );
  const transactionConfirmationRequestNonceRef = useRef(0);
  const estimateFeeRequestNonceRef = useRef(0);
  const checkAmountRequestNonceRef = useRef(0);
  // The answer on screen when the box was emptied. The same amount typed
  // again while the emptied box still keeps its figures takes it back at
  // once, also through the other amounts on the way to it ("1" and "1."
  // before "1.5"), rather than waiting for the market to say it again
  const transactionConfirmationStateRef = useRef(transactionConfirmationState);
  transactionConfirmationStateRef.current = transactionConfirmationState;
  const emptiedAnswerRef = useRef<IEmptiedAnswer | undefined>(undefined);
  const lastNormalizedAmountRef = useRef('0');

  const isReady = useMemo(
    () =>
      Boolean(
        accountId &&
        networkId &&
        provider &&
        marketAddress &&
        reserveAddress !== undefined,
      ),
    [accountId, networkId, provider, marketAddress, reserveAddress],
  );

  const normalizedAmount = useMemo(() => {
    if (!amount || isAmountInvalid(amount)) {
      return '0';
    }
    return amount;
  }, [amount]);

  const shouldFetchTransactionConfirmation = isReady && !isDisabled;
  // A supply's answer for an empty amount is kept for the next form on this
  // market (this one built again, or paying with another token)
  const supplyEmptyKey =
    action === 'supply' && isReady
      ? buildSupplyEmptyFirstFrameKey({
          accountId,
          networkId,
          provider,
          marketAddress,
          reserveAddress,
        })
      : undefined;

  const transactionConfirmationScopeKey = useMemo(
    () =>
      JSON.stringify([
        accountId,
        networkId,
        provider,
        marketAddress,
        reserveAddress,
        action,
      ]),
    [accountId, action, marketAddress, networkId, provider, reserveAddress],
  );

  const transactionConfirmationRequestKey = useMemo(
    () =>
      JSON.stringify([
        transactionConfirmationScopeKey,
        normalizedAmount,
        isDisabled,
        withdrawAll,
        repayAll,
      ]),
    [
      isDisabled,
      normalizedAmount,
      repayAll,
      transactionConfirmationScopeKey,
      withdrawAll,
    ],
  );

  const shouldCheckAmount = useMemo(() => {
    const amountBN = new BigNumber(amount || '0');
    return Boolean(
      isReady &&
      !isDisabled &&
      amount &&
      !isAmountInvalid(amount) &&
      !amountBN.isNaN() &&
      amountBN.gt(0),
    );
  }, [amount, isDisabled, isReady]);

  const checkAmountRequestKey = useMemo(
    () =>
      JSON.stringify([
        accountId,
        networkId,
        provider,
        marketAddress,
        reserveAddress,
        action,
        amount,
        isDisabled,
        withdrawAll,
        repayAll,
      ]),
    [
      accountId,
      action,
      amount,
      isDisabled,
      marketAddress,
      networkId,
      provider,
      repayAll,
      reserveAddress,
      withdrawAll,
    ],
  );

  const fetchTransactionConfirmation = useCallback(
    async (value: string) => {
      if (!isReady || isDisabled) {
        return undefined;
      }

      return backgroundApiProxy.serviceStaking.getBorrowTransactionConfirmation(
        {
          networkId,
          provider,
          marketAddress,
          reserveAddress,
          accountId,
          action,
          amount: value,
          withdrawAll: action === 'withdraw' ? withdrawAll : undefined,
          repayAll: action === 'repay' ? repayAll : undefined,
        },
      );
    },
    [
      accountId,
      action,
      isDisabled,
      isReady,
      marketAddress,
      networkId,
      provider,
      repayAll,
      reserveAddress,
      withdrawAll,
    ],
  );

  const debouncedFetchTransactionConfirmation = useDebouncedCallback(
    async (value: string, requestNonce: number, requestKey: string) => {
      if (transactionConfirmationRequestNonceRef.current !== requestNonce) {
        return;
      }
      try {
        const resp = await fetchTransactionConfirmation(value);
        if (supplyEmptyKey && value === '0') {
          keepFirstFrame(supplyEmptyKey, resp);
        }
        if (transactionConfirmationRequestNonceRef.current === requestNonce) {
          setTransactionConfirmationState({
            requestKey,
            transactionConfirmation: resp,
            transactionConfirmationLoading: false,
          });
        }
      } catch {
        if (transactionConfirmationRequestNonceRef.current === requestNonce) {
          setTransactionConfirmationState(
            createEmptyBorrowTransactionConfirmationState({
              requestKey,
            }),
          );
        }
      }
    },
    350,
  );

  useEffect(() => {
    debouncedFetchTransactionConfirmation.cancel();
    transactionConfirmationRequestNonceRef.current += 1;
    const requestNonce = transactionConfirmationRequestNonceRef.current;
    const previousState = transactionConfirmationStateRef.current;
    const previousAmount = lastNormalizedAmountRef.current;
    lastNormalizedAmountRef.current = normalizedAmount;
    if (
      normalizedAmount === '0' &&
      previousAmount !== '0' &&
      previousState.transactionConfirmation
    ) {
      emptiedAnswerRef.current = {
        requestKey: previousState.requestKey,
        transactionConfirmation: previousState.transactionConfirmation,
        at: Date.now(),
        refilled: false,
      };
    } else if (
      normalizedAmount !== '0' &&
      previousAmount === '0' &&
      emptiedAnswerRef.current &&
      !emptiedAnswerRef.current.refilled
    ) {
      // Typed into after it had gone to dashes: nothing to take back
      if (Date.now() - emptiedAnswerRef.current.at <= EMPTIED_HOLD_MS) {
        emptiedAnswerRef.current.refilled = true;
      } else {
        emptiedAnswerRef.current = undefined;
      }
    }
    const emptiedAnswer = emptiedAnswerRef.current;
    if (
      shouldFetchTransactionConfirmation &&
      canTakeBack(emptiedAnswer, transactionConfirmationRequestKey)
    ) {
      emptiedAnswerRef.current = undefined;
      setTransactionConfirmationState({
        requestKey: transactionConfirmationRequestKey,
        transactionConfirmation: emptiedAnswer.transactionConfirmation,
        transactionConfirmationLoading: false,
      });
      return;
    }
    setTransactionConfirmationState((currentState) =>
      resolveBorrowTransactionConfirmationStateForRequest({
        requestKey: transactionConfirmationRequestKey,
        shouldFetch: shouldFetchTransactionConfirmation,
        state: currentState,
      }),
    );

    if (!shouldFetchTransactionConfirmation) {
      return;
    }

    void debouncedFetchTransactionConfirmation(
      normalizedAmount,
      requestNonce,
      transactionConfirmationRequestKey,
    );
    return () => {
      debouncedFetchTransactionConfirmation.cancel();
      transactionConfirmationRequestNonceRef.current += 1;
    };
  }, [
    accountId,
    action,
    debouncedFetchTransactionConfirmation,
    isDisabled,
    isReady,
    marketAddress,
    networkId,
    normalizedAmount,
    provider,
    repayAll,
    reserveAddress,
    shouldFetchTransactionConfirmation,
    transactionConfirmationRequestKey,
    withdrawAll,
  ]);

  const fetchEstimateFeeResp = useCallback(
    async (value: string) => {
      if (!isReady || isDisabled) {
        return undefined;
      }

      if (isAmountInvalid(value)) {
        return undefined;
      }

      const amountNumber = BigNumber(value || '0');
      if (amountNumber.isNaN() || amountNumber.lte(0)) {
        return undefined;
      }

      return backgroundApiProxy.serviceStaking.getBorrowEstimateFee({
        networkId,
        provider,
        marketAddress,
        reserveAddress,
        accountId,
        action,
        amount: amountNumber.toFixed(),
        withdrawAll: action === 'withdraw' ? withdrawAll : undefined,
        repayAll: action === 'repay' ? repayAll : undefined,
      });
    },
    [
      accountId,
      action,
      isDisabled,
      isReady,
      marketAddress,
      networkId,
      provider,
      repayAll,
      reserveAddress,
      withdrawAll,
    ],
  );

  const debouncedFetchEstimateFeeResp = useDebouncedCallback(
    async (value: string, requestNonce: number) => {
      if (estimateFeeRequestNonceRef.current !== requestNonce) {
        return;
      }
      try {
        const resp = await fetchEstimateFeeResp(value);
        if (estimateFeeRequestNonceRef.current === requestNonce) {
          setEstimateFeeResp(resp);
        }
      } catch {
        if (estimateFeeRequestNonceRef.current === requestNonce) {
          setEstimateFeeResp(undefined);
        }
      }
    },
    350,
  );

  useEffect(() => {
    debouncedFetchEstimateFeeResp.cancel();
    estimateFeeRequestNonceRef.current += 1;
    const requestNonce = estimateFeeRequestNonceRef.current;
    setEstimateFeeResp(undefined);

    if (!isReady || isDisabled) {
      return;
    }

    if (!amount || isAmountInvalid(amount) || BigNumber(amount).lte(0)) {
      return;
    }

    void debouncedFetchEstimateFeeResp(amount, requestNonce);
    return () => {
      debouncedFetchEstimateFeeResp.cancel();
      estimateFeeRequestNonceRef.current += 1;
    };
  }, [
    accountId,
    action,
    amount,
    debouncedFetchEstimateFeeResp,
    isDisabled,
    isReady,
    marketAddress,
    networkId,
    provider,
    repayAll,
    reserveAddress,
    withdrawAll,
  ]);

  const checkAmount = useDebouncedCallback(
    async (value: string, requestNonce: number, requestKey: string) => {
      if (
        checkAmountRequestNonceRef.current !== requestNonce ||
        !isReady ||
        isDisabled ||
        isAmountInvalid(value)
      ) {
        return;
      }
      try {
        const response =
          await backgroundApiProxy.serviceStaking.getBorrowCheckAmount({
            networkId,
            provider,
            marketAddress,
            reserveAddress,
            accountId,
            action,
            amount: value,
            repayAll: action === 'repay' ? repayAll : undefined,
          });

        if (checkAmountRequestNonceRef.current !== requestNonce) {
          return;
        }

        if (Number(response.code) === 0) {
          setCheckAmountState({
            requestKey,
            checkAmountMessage: '',
            checkAmountAlerts: response.data?.alerts || [],
            checkAmountLoading: false,
            checkAmountResult: response.data?.result,
            riskOfLiquidationAlert: response.data?.riskOfLiquidationAlert,
          });
        } else {
          setCheckAmountState({
            requestKey,
            checkAmountMessage: response.message,
            checkAmountAlerts: [],
            checkAmountLoading: false,
            checkAmountResult: false,
            riskOfLiquidationAlert: undefined,
          });
        }
      } catch {
        if (checkAmountRequestNonceRef.current === requestNonce) {
          setCheckAmountState({
            requestKey,
            checkAmountMessage: intl.formatMessage({
              id: ETranslations.global_network_error,
            }),
            checkAmountAlerts: [],
            checkAmountLoading: false,
            checkAmountResult: false,
            riskOfLiquidationAlert: undefined,
          });
        }
      }
    },
    300,
  );

  useEffect(() => {
    checkAmount.cancel();
    checkAmountRequestNonceRef.current += 1;
    const requestNonce = checkAmountRequestNonceRef.current;
    setCheckAmountState(
      createEmptyBorrowCheckAmountState({
        requestKey: checkAmountRequestKey,
        loading: shouldCheckAmount,
      }),
    );

    if (!shouldCheckAmount) {
      return;
    }

    void checkAmount(amount, requestNonce, checkAmountRequestKey);
    return () => {
      checkAmount.cancel();
      checkAmountRequestNonceRef.current += 1;
    };
  }, [
    accountId,
    action,
    amount,
    checkAmount,
    checkAmountRequestKey,
    isDisabled,
    isReady,
    marketAddress,
    networkId,
    provider,
    repayAll,
    reserveAddress,
    shouldCheckAmount,
    withdrawAll,
  ]);

  const effectiveCheckAmountState = resolveBorrowCheckAmountStateForRequest({
    requestKey: checkAmountRequestKey,
    shouldCheckAmount,
    state: checkAmountState,
  });

  // Taken back from the frame the amount is typed again in
  const emptiedAnswer = emptiedAnswerRef.current;
  const effectiveTransactionConfirmationState =
    shouldFetchTransactionConfirmation &&
    transactionConfirmationState.requestKey !==
      transactionConfirmationRequestKey &&
    canTakeBack(emptiedAnswer, transactionConfirmationRequestKey)
      ? {
          requestKey: transactionConfirmationRequestKey,
          transactionConfirmation: emptiedAnswer.transactionConfirmation,
          transactionConfirmationLoading: false,
        }
      : resolveBorrowTransactionConfirmationStateForRequest({
          requestKey: transactionConfirmationRequestKey,
          shouldFetch: shouldFetchTransactionConfirmation,
          state: transactionConfirmationState,
        });

  const isCheckAmountMessageError = useMemo(
    () => amount.length > 0 && !!effectiveCheckAmountState.checkAmountMessage,
    [amount, effectiveCheckAmountState.checkAmountMessage],
  );

  // Supplying with nothing typed: until the market first answers, its last
  // answer for an empty amount, so the form opens with the market's rows.
  // Only until then: a box emptied later keeps its last figures a moment
  // (dimmed), which this answer would replace at once
  let { transactionConfirmation } = effectiveTransactionConfirmationState;
  const hasAnsweredRef = useRef(false);
  if (transactionConfirmation) {
    hasAnsweredRef.current = true;
  }
  if (
    !transactionConfirmation &&
    !hasAnsweredRef.current &&
    supplyEmptyKey &&
    normalizedAmount === '0' &&
    shouldFetchTransactionConfirmation
  ) {
    transactionConfirmation =
      readFirstFrame<IBorrowTransactionConfirmation>(supplyEmptyKey);
  }

  return {
    estimateFeeResp,
    transactionConfirmation,
    transactionConfirmationLoading:
      effectiveTransactionConfirmationState.transactionConfirmationLoading,
    checkAmountMessage: effectiveCheckAmountState.checkAmountMessage,
    checkAmountAlerts: effectiveCheckAmountState.checkAmountAlerts,
    checkAmountLoading: effectiveCheckAmountState.checkAmountLoading,
    isCheckAmountMessageError,
    checkAmountResult: effectiveCheckAmountState.checkAmountResult,
    riskOfLiquidationAlert: effectiveCheckAmountState.riskOfLiquidationAlert,
  };
}
