import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ToastManager } from '@onekeyhq/components';
import type { Account } from '@onekeyhq/engine/src/types/account';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector, useDebounce } from '../../../hooks';
import { updateLimitOrderTransaction } from '../../../store/reducers/swapTransactions';
import {
  selectLimitOrderActiveAccount,
  selectLimitOrderInstantRate,
  selectLimitOrderTokenIn,
  selectLimitOrderTokenOut,
  selectLimitOrderTypedValue,
  selectSwapTransactionsLimitOrderDetails,
} from '../../../store/selectors';
import { gt, lt, multiply } from '../utils';

import { useSwapSend } from './useSwapSend';
import { useTokenBalance } from './useSwapTokenUtils';

import type {
  ILimitOrderQuoteParams,
  LimitOrderTransactionDetails,
} from '../typings';

export function useLimitOrderParams(): ILimitOrderQuoteParams | undefined {
  const tokenIn = useAppSelector(selectLimitOrderTokenIn);

  const tokenOut = useAppSelector(selectLimitOrderTokenOut);
  const typedValue = useAppSelector(selectLimitOrderTypedValue);
  const activeAccount = useAppSelector(selectLimitOrderActiveAccount);
  const params = useMemo(() => {
    if (
      tokenIn &&
      tokenOut &&
      typedValue &&
      gt(typedValue, 0) &&
      activeAccount
    ) {
      return {
        tokenIn,
        tokenOut,
        tokenInValue: typedValue,
        activeAccount,
      };
    }
    return undefined;
  }, [tokenIn, tokenOut, typedValue, activeAccount]);
  return useDebounce(params, 500);
}

export function useLimitOrderOutput() {
  const instantRate = useAppSelector(selectLimitOrderInstantRate);
  const typedValue = useAppSelector(selectLimitOrderTypedValue);
  return useMemo(() => {
    if (instantRate && typedValue) {
      return multiply(typedValue, instantRate);
    }
    return '0';
  }, [instantRate, typedValue]);
}

export function useLimitOrders(accountId?: string, networkId?: string) {
  const limitOrderDetails = useAppSelector(
    selectSwapTransactionsLimitOrderDetails,
  );
  return useMemo(() => {
    if (!limitOrderDetails || !accountId) {
      return [];
    }
    if (accountId && networkId) {
      return limitOrderDetails[accountId]?.[networkId];
    }
    const details = limitOrderDetails[accountId];
    if (!details) {
      return [];
    }
    const txs = Object.values(details).reduce(
      (result, item) => result.concat(item),
      [] as LimitOrderTransactionDetails[],
    );
    return txs.sort((a, b) => b.createdAt - a.createdAt);
  }, [limitOrderDetails, accountId, networkId]);
}

export function useAllLimitOrders(): LimitOrderTransactionDetails[] {
  const limitOrderDetails = useAppSelector(
    selectSwapTransactionsLimitOrderDetails,
  );
  return useMemo(() => {
    if (!limitOrderDetails) {
      return [];
    }
    const limitOrderDetailsValues = Object.values(limitOrderDetails);
    const txs = limitOrderDetailsValues.reduce(
      (result, item) => result.concat(...Object.values(item)),
      [] as LimitOrderTransactionDetails[],
    );
    return txs.sort((a, b) => b.createdAt - a.createdAt);
  }, [limitOrderDetails]);
}

export const useCheckLimitOrderInputBalance = () => {
  const tokenIn = useAppSelector(selectLimitOrderTokenIn);
  const sendingAccount = useAppSelector(selectLimitOrderActiveAccount);
  const typedValue = useAppSelector(selectLimitOrderTypedValue);
  const tokenBalance = useTokenBalance(
    gt(typedValue, 0) ? tokenIn : undefined,
    sendingAccount?.id,
  );
  return useMemo(() => {
    if (tokenIn && tokenBalance && typedValue) {
      return { insufficient: lt(tokenBalance, typedValue), token: tokenIn };
    }
  }, [tokenIn, tokenBalance, typedValue]);
};

export const useCancelLimitOrderCallback = () => {
  const intl = useIntl();
  const sendTx = useSwapSend();
  return useCallback(
    async ({
      activeAccount,
      details,
    }: {
      activeAccount: Account;
      details: LimitOrderTransactionDetails;
    }) => {
      const accountInWallets =
        await backgroundApiProxy.serviceSwap.checkAccountInWallets(
          activeAccount.id,
        );

      if (!accountInWallets) {
        ToastManager.show(
          {
            title: intl.formatMessage(
              { id: 'msg__account_deleted' },
              { '0': activeAccount.name },
            ),
          },
          { type: 'error' },
        );
        return;
      }

      let { limitOrder } = details;
      if (!limitOrder) {
        const orderDetails =
          await backgroundApiProxy.serviceLimitOrder.fetchOrderState({
            networkId: details.networkId,
            orderHash: details.orderHash,
          });
        limitOrder = orderDetails.order;
      }
      if (limitOrder) {
        const tx =
          await backgroundApiProxy.serviceLimitOrder.buildCancelLimitOrderTx(
            limitOrder,
          );

        await sendTx({
          accountId: details.accountId,
          networkId: details.networkId,
          encodedTx: {
            from: activeAccount.address,
            to: tx.to,
            data: tx.data,
            value: '0x00',
          },
          // eslint-disable-next-line @typescript-eslint/require-await
          onSuccess: async () => {
            backgroundApiProxy.dispatch(
              updateLimitOrderTransaction({
                networkId: details.networkId,
                accountId: details.accountId,
                orderHash: details.orderHash,
                details: {
                  canceled: true,
                },
              }),
            );
            ToastManager.show({
              title: intl.formatMessage({ id: 'msg__success' }),
            });
          },
        });
      }
    },
    [intl, sendTx],
  );
};
