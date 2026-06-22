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

const isAmountInvalid = (amount: string) =>
  BigNumber(amount).isNaN() ||
  (typeof amount === 'string' && amount.endsWith('.'));

function buildBorrowActionRequestKey({
  action,
  accountId,
  networkId,
  provider,
  marketAddress,
  reserveAddress,
  amount,
  isDisabled,
  withdrawAll,
  repayAll,
}: IUniversalBorrowActionParams) {
  return [
    action,
    accountId,
    networkId,
    provider,
    marketAddress,
    reserveAddress,
    amount,
    isDisabled ? 'disabled' : 'enabled',
    action === 'withdraw' ? String(!!withdrawAll) : '',
    action === 'repay' ? String(!!repayAll) : '',
  ].join('|');
}

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
  const transactionConfirmationRequestKeyRef = useRef('');
  const estimateFeeRequestKeyRef = useRef('');
  const checkAmountRequestKeyRef = useRef('');

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
    async (value: string, requestKey: string) => {
      if (transactionConfirmationRequestKeyRef.current !== requestKey) {
        return;
      }
      try {
        const resp = await fetchTransactionConfirmation(value);
        if (transactionConfirmationRequestKeyRef.current === requestKey) {
          setTransactionConfirmation(resp);
        }
      } catch {
        if (transactionConfirmationRequestKeyRef.current === requestKey) {
          setTransactionConfirmation(undefined);
        }
      }
    },
    350,
  );

  useEffect(() => {
    debouncedFetchTransactionConfirmation.cancel();
    if (!isReady || isDisabled) {
      transactionConfirmationRequestKeyRef.current = '';
      setTransactionConfirmation(undefined);
      return;
    }

    const requestKey = buildBorrowActionRequestKey({
      action,
      accountId,
      networkId,
      provider,
      marketAddress,
      reserveAddress,
      amount: normalizedAmount,
      isDisabled,
      withdrawAll,
      repayAll,
    });
    transactionConfirmationRequestKeyRef.current = requestKey;
    setTransactionConfirmation(undefined);
    void debouncedFetchTransactionConfirmation(normalizedAmount, requestKey);
    return () => {
      debouncedFetchTransactionConfirmation.cancel();
    };
  }, [
    accountId,
    action,
    marketAddress,
    networkId,
    normalizedAmount,
    provider,
    repayAll,
    reserveAddress,
    withdrawAll,
    isDisabled,
    isReady,
    debouncedFetchTransactionConfirmation,
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
    async (value: string, requestKey: string) => {
      if (estimateFeeRequestKeyRef.current !== requestKey) {
        return;
      }
      try {
        const resp = await fetchEstimateFeeResp(value);
        if (estimateFeeRequestKeyRef.current === requestKey) {
          setEstimateFeeResp(resp);
        }
      } catch {
        if (estimateFeeRequestKeyRef.current === requestKey) {
          setEstimateFeeResp(undefined);
        }
      }
    },
    350,
  );

  useEffect(() => {
    debouncedFetchEstimateFeeResp.cancel();
    if (!isReady || isDisabled) {
      estimateFeeRequestKeyRef.current = '';
      setEstimateFeeResp(undefined);
      return;
    }

    if (!amount || isAmountInvalid(amount) || BigNumber(amount).lte(0)) {
      estimateFeeRequestKeyRef.current = '';
      setEstimateFeeResp(undefined);
      return;
    }

    const requestKey = buildBorrowActionRequestKey({
      action,
      accountId,
      networkId,
      provider,
      marketAddress,
      reserveAddress,
      amount,
      isDisabled,
      withdrawAll,
      repayAll,
    });
    estimateFeeRequestKeyRef.current = requestKey;
    setEstimateFeeResp(undefined);
    void debouncedFetchEstimateFeeResp(amount, requestKey);
    return () => {
      debouncedFetchEstimateFeeResp.cancel();
    };
  }, [
    accountId,
    action,
    amount,
    marketAddress,
    networkId,
    provider,
    repayAll,
    reserveAddress,
    withdrawAll,
    isDisabled,
    isReady,
    debouncedFetchEstimateFeeResp,
  ]);

  const checkAmount = useDebouncedCallback(
    async (value: string, requestKey: string) => {
      if (
        checkAmountRequestKeyRef.current !== requestKey ||
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

        if (checkAmountRequestKeyRef.current !== requestKey) {
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
      } catch {
        if (checkAmountRequestKeyRef.current === requestKey) {
          setCheckAmountMessage(
            intl.formatMessage({ id: ETranslations.global_network_error }),
          );
          setCheckAmountAlerts([]);
          setCheckAmountResult(false);
          setRiskOfLiquidationAlert(undefined);
        }
      } finally {
        if (checkAmountRequestKeyRef.current === requestKey) {
          setCheckAmountLoading(false);
        }
      }
    },
    300,
  );

  useEffect(() => {
    checkAmount.cancel();
    const amountBN = new BigNumber(amount || '0');
    if (
      !isReady ||
      isDisabled ||
      !amount ||
      isAmountInvalid(amount) ||
      amountBN.isNaN() ||
      amountBN.lte(0)
    ) {
      checkAmountRequestKeyRef.current = '';
      setCheckAmountMessage('');
      setCheckAmountAlerts([]);
      setCheckAmountLoading(false);
      setCheckAmountResult(undefined);
      setRiskOfLiquidationAlert(undefined);
      return;
    }

    const requestKey = buildBorrowActionRequestKey({
      action,
      accountId,
      networkId,
      provider,
      marketAddress,
      reserveAddress,
      amount,
      isDisabled,
      withdrawAll,
      repayAll,
    });
    checkAmountRequestKeyRef.current = requestKey;
    setCheckAmountMessage('');
    setCheckAmountAlerts([]);
    setCheckAmountLoading(true);
    setCheckAmountResult(undefined);
    setRiskOfLiquidationAlert(undefined);
    void checkAmount(amount, requestKey);
    return () => {
      checkAmount.cancel();
    };
  }, [
    accountId,
    action,
    amount,
    marketAddress,
    networkId,
    provider,
    repayAll,
    reserveAddress,
    withdrawAll,
    isDisabled,
    isReady,
    checkAmount,
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
