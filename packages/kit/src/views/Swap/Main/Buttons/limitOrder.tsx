import { useCallback, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';

import { useIntl } from 'react-intl';

import {
  Button,
  ToastManager,
  Box
} from '@onekeyhq/components';
import { ethers } from '@onekeyhq/engine/src/vaults/impl/evm/sdk/ethers';
import type { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useNavigation } from '../../../../hooks';
import { useAppSelector } from '../../../../hooks/redux';
import { ModalRoutes, RootRoutes } from '../../../../routes/types';
import {
  addLimitOrderTransaction,
} from '../../../../store/reducers/swapTransactions';
import { wait } from '../../../../utils/helper';
import { ZeroExchangeAddress } from '../../config';
import {
  useCheckLimitOrderInputBalance,
  useLimitOrderOutput,
  useLimitOrderParams,
} from '../../hooks/useLimitOrder';
import { useSwapSend, useSwapSignMessage } from '../../hooks/useSwapSend';
import { SwapRoutes } from '../../typings';
import {
  getTokenAmountString,
  getTokenAmountValue,
  lte,
} from '../../utils';
import type { Task } from './utils'
import { combinedTasks } from './utils'

const LimitOrderButton = () => {
  const intl = useIntl();
  const ref = useRef(false);
  const navigation = useNavigation();
  const params = useLimitOrderParams();
  const instantRate = useAppSelector((s) => s.limitOrder.instantRate);
  const sendSwapTx = useSwapSend();
  const sendSignMessage = useSwapSignMessage();
  const [loading, setLoading] = useState(false);

  const onSubmit = useCallback(async () => {
    if (!params || !instantRate) {
      ToastManager.show(
        {
          title: intl.formatMessage({ id: 'msg__unknown_error' }),
        },
        { type: 'error' },
      );
      return;
    }

    const order = await backgroundApiProxy.serviceLimitOrder.buildLimitOrder({
      params,
      instantRate,
    });
    const createdAt = Math.floor(Date.now() / 1000);

    if (!order) {
      ToastManager.show(
        {
          title: intl.formatMessage({ id: 'msg__unknown_error' }),
        },
        { type: 'error' },
      );
      return;
    }

    const tasks: Task[] = [];
    const doLimitOrder = async () => {
      const message =
        await backgroundApiProxy.serviceLimitOrder.getEIP712TypedData({
          domain: { networkId: params.tokenIn.networkId },
          message: order,
        });
      const accountId = params.activeAccount.id;
      const { networkId } = params.tokenIn;
      const { tokenIn } = params;
      const { tokenOut } = params;
      await wait(100);
      sendSignMessage({
        accountId,
        networkId,
        unsignedMessage: { type: 4, message: JSON.stringify(message) },
        onSuccess: async (signature: any) => {
          const orderHash = ethers.utils._TypedDataEncoder.hash(
            message.domain,
            { LimitOrder: message.types.LimitOrder },
            message.message,
          );

          await backgroundApiProxy.serviceLimitOrder.submitLimitOrder({
            order,
            networkId: params.tokenIn.networkId,
            signature,
          });

          backgroundApiProxy.dispatch(
            addLimitOrderTransaction({
              networkId: tokenIn.networkId,
              accountId,
              limitOrder: {
                networkId: tokenIn.networkId,
                accountId,
                orderHash,
                tokenIn,
                tokenInValue: order.makerAmount,
                tokenOut,
                tokenOutValue: order.takerAmount,
                remainingFillable: order.takerAmount,
                rate: instantRate,
                createdAt,
                expiredIn: Number(order.expiry),
              },
            }),
          );
          backgroundApiProxy.serviceLimitOrder.resetState();
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.Swap,
            params: {
              screen: SwapRoutes.TransactionSubmitted,
              params: {
                orderHash,
              },
            },
          });
        },
      });
    };
    tasks.unshift(doLimitOrder);
    let needApproved = false;
    const allowance = await backgroundApiProxy.engine.getTokenAllowance({
      networkId: params.tokenIn.networkId,
      accountId: params.activeAccount.id,
      tokenIdOnNetwork: params.tokenIn.tokenIdOnNetwork,
      spender: ZeroExchangeAddress,
    });
    if (allowance) {
      needApproved = new BigNumber(
        getTokenAmountString(params.tokenIn, allowance),
      ).lt(order.makerAmount);
    }
    if (needApproved) {
      const doApprove = async (nextTask?: Task) => {
        const approveTx =
          (await backgroundApiProxy.engine.buildEncodedTxFromApprove({
            spender: ZeroExchangeAddress,
            networkId: params.tokenIn.networkId,
            accountId: params.activeAccount.id,
            token: params.tokenIn.tokenIdOnNetwork,
            amount: getTokenAmountValue(
              params.tokenIn,
              order.makerAmount,
            ).toFixed(),
          })) as IEncodedTxEvm;
        await sendSwapTx({
          accountId: params.activeAccount.id,
          networkId: params.tokenIn.networkId,
          encodedTx: approveTx,
          onSuccess: async () => {
            await nextTask?.();
          },
        });
      };
      tasks.unshift(doApprove);
    }
    await combinedTasks(tasks);
  }, [params, instantRate, intl, sendSignMessage, sendSwapTx, navigation]);

  const onPress = useCallback(async () => {
    if (ref.current) {
      return;
    }
    setLoading(true);
    ref.current = true;
    try {
      await onSubmit();
    } finally {
      ref.current = false;
      setLoading(false);
    }
  }, [onSubmit]);

  return (
    <Button
      key="limit_order"
      size="xl"
      type="primary"
      isLoading={loading}
      onPress={onPress}
    >
      {intl.formatMessage({ id: 'action__place_limit_order' })}
    </Button>
  );
};

const LimitOrderStateButton = () => {
  const intl = useIntl();
  const loading = useAppSelector((s) => s.limitOrder.loading);
  const output = useLimitOrderOutput();
  const balanceInfo = useCheckLimitOrderInputBalance();
  const lessThanZero = lte(output, 0);
  if (loading || lessThanZero) {
    return (
      <Button
        key="limit_order"
        size="xl"
        type="primary"
        isDisabled={lessThanZero}
        isLoading={loading}
      >
        {intl.formatMessage({ id: 'action__place_limit_order' })}
      </Button>
    );
  }
  if (balanceInfo && balanceInfo.insufficient) {
    return (
      <Button
        size="xl"
        type="primary"
        isDisabled
        key="insufficient_balance_error"
      >
        {intl.formatMessage(
          { id: 'form__amount_invalid' },
          { '0': balanceInfo.token.symbol },
        )}
      </Button>
    );
  }
  return <LimitOrderButton />;
};

export const LimitOrderMainButton = () => {
  const intl = useIntl()
  const limitOrderMaintain = useAppSelector(s => s.swapTransactions.limitOrderMaintain);
  if (limitOrderMaintain) {
    return (
      <Button size="xl" type="primary" isDisabled key="limitOrderMaintain">
        {intl.formatMessage({ id: 'action__under_maintaince' })}
      </Button>
    );
  }
  return <LimitOrderStateButton />
}