import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useDebouncedCallback } from 'use-debounce';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
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
  repayAll,
}: IUniversalBorrowActionParams): IUniversalBorrowActionState {
  const [estimateFeeResp, setEstimateFeeResp] = useState<
    IEarnEstimateFeeResp | undefined
  >();
  const [transactionConfirmation, setTransactionConfirmation] = useState<
    IBorrowTransactionConfirmation | undefined
  >();
  const [checkAmountMessage, setCheckAmountMessage] = useState('');
  const [checkAmountAlerts, setCheckAmountAlerts] = useState<
    ICheckAmountAlert[]
  >([]);
  const [checkAmountLoading, setCheckAmountLoading] = useState(false);
  const [checkAmountResult, setCheckAmountResult] = useState<
    boolean | undefined
  >(undefined);
  const [riskOfLiquidationAlert, setRiskOfLiquidationAlert] = useState<
    boolean | undefined
  >(undefined);
  const transactionConfirmationRequestNonceRef = useRef(0);
  const estimateFeeRequestNonceRef = useRef(0);
  const checkAmountRequestNonceRef = useRef(0);

  const isReady = useMemo(
    () =>
      Boolean(
        accountId && networkId && provider && marketAddress && reserveAddress,
      ),
    [accountId, networkId, provider, marketAddress, reserveAddress],
  );

  const normalizedAmount = useMemo(() => {
    if (!amount || isAmountInvalid(amount)) {
      return '0';
    }
    return amount;
  }, [amount]);

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
      reserveAddress,
    ],
  );

  const debouncedFetchTransactionConfirmation = useDebouncedCallback(
    async (value: string, requestNonce: number) => {
      if (transactionConfirmationRequestNonceRef.current !== requestNonce) {
        return;
      }
      const resp = await fetchTransactionConfirmation(value || '0');
      if (transactionConfirmationRequestNonceRef.current === requestNonce) {
        setTransactionConfirmation(resp);
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
    reserveAddress,
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
      reserveAddress,
    ],
  );

  const debouncedFetchEstimateFeeResp = useDebouncedCallback(
    async (value: string, requestNonce: number) => {
      if (estimateFeeRequestNonceRef.current !== requestNonce) {
        return;
      }
      const resp = await fetchEstimateFeeResp(value || '0');
      if (estimateFeeRequestNonceRef.current === requestNonce) {
        setEstimateFeeResp(resp);
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
    reserveAddress,
  ]);

  const checkAmount = useDebouncedCallback(
    async (value: string, requestNonce: number) => {
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
          setCheckAmountMessage('');
          setCheckAmountAlerts(response.data?.alerts || []);
          setCheckAmountResult(response.data?.result);
          setRiskOfLiquidationAlert(response.data?.riskOfLiquidationAlert);
        } else {
          setCheckAmountMessage(response.message);
          setCheckAmountAlerts([]);
          setCheckAmountResult(false);
          setRiskOfLiquidationAlert(undefined);
        }
      } finally {
        if (checkAmountRequestNonceRef.current === requestNonce) {
          setCheckAmountLoading(false);
        }
      }
    },
    300,
  );

  useEffect(() => {
    checkAmount.cancel();
    checkAmountRequestNonceRef.current += 1;
    const requestNonce = checkAmountRequestNonceRef.current;
    setCheckAmountMessage('');
    setCheckAmountAlerts([]);
    setCheckAmountResult(undefined);
    setRiskOfLiquidationAlert(undefined);

    if (!isReady || isDisabled || !amount || isAmountInvalid(amount)) {
      setCheckAmountLoading(false);
      return;
    }

    setCheckAmountLoading(true);
    void checkAmount(amount, requestNonce);
    return () => {
      checkAmount.cancel();
      checkAmountRequestNonceRef.current += 1;
    };
  }, [
    accountId,
    action,
    amount,
    checkAmount,
    isDisabled,
    isReady,
    marketAddress,
    networkId,
    provider,
    repayAll,
    reserveAddress,
  ]);

  const isCheckAmountMessageError = useMemo(
    () => amount.length > 0 && !!checkAmountMessage,
    [amount, checkAmountMessage],
  );

  return {
    estimateFeeResp,
    transactionConfirmation,
    checkAmountMessage,
    checkAmountAlerts,
    checkAmountLoading,
    isCheckAmountMessageError,
    checkAmountResult,
    riskOfLiquidationAlert,
  };
}
