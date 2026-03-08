import { useCallback, useEffect, useMemo, useState } from 'react';

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
    async (value?: string) => {
      const resp = await fetchTransactionConfirmation(value || '0');
      setTransactionConfirmation(resp);
    },
    350,
  );

  useEffect(() => {
    if (!isReady || isDisabled) {
      setTransactionConfirmation(undefined);
      return;
    }

    void debouncedFetchTransactionConfirmation(normalizedAmount);
  }, [
    debouncedFetchTransactionConfirmation,
    isDisabled,
    isReady,
    normalizedAmount,
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
    async (value?: string) => {
      const resp = await fetchEstimateFeeResp(value || '0');
      setEstimateFeeResp(resp);
    },
    350,
  );

  useEffect(() => {
    if (!isReady || isDisabled) {
      setEstimateFeeResp(undefined);
      return;
    }

    if (!amount || isAmountInvalid(amount) || BigNumber(amount).lte(0)) {
      setEstimateFeeResp(undefined);
      return;
    }

    void debouncedFetchEstimateFeeResp(amount);
  }, [amount, debouncedFetchEstimateFeeResp, isDisabled, isReady]);

  const checkAmount = useDebouncedCallback(async (value: string) => {
    if (!isReady || isAmountInvalid(value)) {
      return;
    }
    setCheckAmountLoading(true);
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
      setCheckAmountLoading(false);
    }
  }, 300);

  useEffect(() => {
    if (!isReady || (amount && isAmountInvalid(amount))) {
      setCheckAmountMessage('');
      setCheckAmountAlerts([]);
      setCheckAmountLoading(false);
      setCheckAmountResult(undefined);
      setRiskOfLiquidationAlert(undefined);
      return;
    }

    void checkAmount(amount || '0');
  }, [amount, checkAmount, isReady, repayAll]);

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
