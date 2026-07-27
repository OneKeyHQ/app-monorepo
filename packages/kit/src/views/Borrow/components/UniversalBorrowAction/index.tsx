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
  const [transactionConfirmation, setTransactionConfirmation] = useState<
    IBorrowTransactionConfirmation | undefined
  >();
  const [checkAmountState, setCheckAmountState] =
    useState<IBorrowCheckAmountState>(() =>
      createEmptyBorrowCheckAmountState({ requestKey: '' }),
    );
  const transactionConfirmationRequestNonceRef = useRef(0);
  const estimateFeeRequestNonceRef = useRef(0);
  const checkAmountRequestNonceRef = useRef(0);

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
    async (value: string, requestNonce: number) => {
      if (transactionConfirmationRequestNonceRef.current !== requestNonce) {
        return;
      }
      try {
        const resp = await fetchTransactionConfirmation(value);
        if (transactionConfirmationRequestNonceRef.current === requestNonce) {
          setTransactionConfirmation(resp);
        }
      } catch {
        if (transactionConfirmationRequestNonceRef.current === requestNonce) {
          setTransactionConfirmation(undefined);
        }
      }
    },
    350,
  );

  useEffect(() => {
    debouncedFetchTransactionConfirmation.cancel();
    transactionConfirmationRequestNonceRef.current += 1;
    const requestNonce = transactionConfirmationRequestNonceRef.current;
    setTransactionConfirmation(undefined);

    if (!isReady || isDisabled) {
      return;
    }

    void debouncedFetchTransactionConfirmation(normalizedAmount, requestNonce);
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

  const isCheckAmountMessageError = useMemo(
    () => amount.length > 0 && !!effectiveCheckAmountState.checkAmountMessage,
    [amount, effectiveCheckAmountState.checkAmountMessage],
  );

  return {
    estimateFeeResp,
    transactionConfirmation,
    checkAmountMessage: effectiveCheckAmountState.checkAmountMessage,
    checkAmountAlerts: effectiveCheckAmountState.checkAmountAlerts,
    checkAmountLoading: effectiveCheckAmountState.checkAmountLoading,
    isCheckAmountMessageError,
    checkAmountResult: effectiveCheckAmountState.checkAmountResult,
    riskOfLiquidationAlert: effectiveCheckAmountState.riskOfLiquidationAlert,
  };
}
