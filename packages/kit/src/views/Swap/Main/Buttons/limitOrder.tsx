import { useCallback, useRef } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Button, ToastManager } from '@onekeyhq/components';
import { getWalletIdFromAccountId } from '@onekeyhq/engine/src/managers/account';
import { ethers } from '@onekeyhq/engine/src/vaults/impl/evm/sdk/ethers';
import type { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useNavigation } from '../../../../hooks';
import { useAppSelector } from '../../../../hooks/redux';
import { ModalRoutes, RootRoutes } from '../../../../routes/routesEnum';
import { addLimitOrderTransaction } from '../../../../store/reducers/swapTransactions';
import { showOverlay } from '../../../../utils/overlayUtils';
import { SwapTransactionsCancelApprovalBottomSheetModal } from '../../components/CancelApprovalModal';
import { ZeroExchangeAddress } from '../../config';
import {
  useCheckLimitOrderInputBalance,
  useLimitOrderOutput,
  useLimitOrderParams,
} from '../../hooks/useLimitOrder';
import { useSwapSend, useSwapSignMessage } from '../../hooks/useSwapSend';
import { SwapRoutes } from '../../typings';
import {
  combinedTasks,
  getTokenAmountString,
  getTokenAmountValue,
  lte,
} from '../../utils';

import { LimitOrderProgressButton } from './progress';

import type { Task } from '../../utils';

const LimitOrderButton = () => {
  const intl = useIntl();
  const ref = useRef(false);
  const navigation = useNavigation();
  const params = useLimitOrderParams();
  const progressStatus = useAppSelector((s) => s.limitOrder.progressStatus);
  const instantRate = useAppSelector((s) => s.limitOrder.instantRate);
  const sendSwapTx = useSwapSend();
  const sendSignMessage = useSwapSignMessage();

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
    const walletId = getWalletIdFromAccountId(params.activeAccount.id);
    const wallet = await backgroundApiProxy.engine.getWallet(walletId);
    backgroundApiProxy.serviceLimitOrder.setProgressStatus({
      title: intl.formatMessage(
        { id: 'action__building_transaction_data_str' },
        { '0': '' },
      ),
    });
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
      backgroundApiProxy.serviceLimitOrder.setProgressStatus({
        title: intl.formatMessage(
          { id: 'action__submitting_order_str' },
          { '0': '' },
        ),
      });
      await sendSignMessage({
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
          appUIEventBus.emit(AppUIEventBusNames.LimitOrderCompleted);
          backgroundApiProxy.serviceLimitOrder.resetState();
          setTimeout(() => {
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.Swap,
              params: {
                screen: SwapRoutes.TransactionSubmitted,
                params: {
                  orderHash,
                },
              },
            });
          }, 650);
        },
        onFail: () => {
          appUIEventBus.emit(AppUIEventBusNames.LimitOrderError);
        },
      });
    };
    tasks.unshift(doLimitOrder);

    let needApproved = false;
    let approveTx: IEncodedTxEvm | undefined;
    let cancelApproveTx: IEncodedTxEvm | undefined;

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
    const needToResetApproval =
      await backgroundApiProxy.serviceSwap.needToResetApproval(params.tokenIn);
    const needCancelApproval =
      needApproved && needToResetApproval && Number(allowance || '0') > 0;
    if (needCancelApproval) {
      cancelApproveTx =
        (await backgroundApiProxy.engine.buildEncodedTxFromApprove({
          spender: ZeroExchangeAddress,
          networkId: params.tokenIn.networkId,
          accountId: params.activeAccount.id,
          token: params.tokenIn.tokenIdOnNetwork,
          amount: '0',
        })) as IEncodedTxEvm;
    }

    if (needApproved) {
      approveTx = (await backgroundApiProxy.engine.buildEncodedTxFromApprove({
        spender: ZeroExchangeAddress,
        networkId: params.tokenIn.networkId,
        accountId: params.activeAccount.id,
        token: params.tokenIn.tokenIdOnNetwork,
        amount: getTokenAmountValue(
          params.tokenIn,
          order.makerAmount,
        ).toFixed(),
      })) as IEncodedTxEvm;

      if (cancelApproveTx && cancelApproveTx.nonce) {
        approveTx.nonce = Number(cancelApproveTx.nonce) + 1;
      }
    }

    if (approveTx) {
      const doApprove = async (nextTask?: Task) => {
        backgroundApiProxy.serviceLimitOrder.setProgressStatus({
          title: intl.formatMessage(
            { id: 'action__authorizing_str' },
            { '0': '' },
          ),
        });
        await sendSwapTx({
          accountId: params.activeAccount.id,
          networkId: params.tokenIn.networkId,
          encodedTx: approveTx as IEncodedTxEvm,
          gasEstimateFallback: Boolean(cancelApproveTx),
          onSuccess: async () => {
            if (wallet.type === 'hw') {
              navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.Swap,
                params: {
                  screen: SwapRoutes.HardwareContinue,
                },
              });
            }
            await nextTask?.();
          },
        });
      };
      tasks.unshift(doApprove);
    }

    if (cancelApproveTx) {
      const doCancelApprove = async (nextTask?: Task) => {
        backgroundApiProxy.serviceLimitOrder.setProgressStatus({
          title: intl.formatMessage(
            { id: 'action__resetting_authorizing_str' },
            { '0': '' },
          ),
        });
        await sendSwapTx({
          accountId: params.activeAccount.id,
          networkId: params.tokenIn.networkId,
          encodedTx: cancelApproveTx as IEncodedTxEvm,
          onSuccess: async () => {
            await nextTask?.();
          },
        });
      };
      tasks.unshift(doCancelApprove);
    }
    if (cancelApproveTx) {
      showOverlay((close) => (
        <SwapTransactionsCancelApprovalBottomSheetModal
          close={close}
          onSubmit={async () => {
            try {
              backgroundApiProxy.serviceLimitOrder.openProgressStatus();
              await combinedTasks(tasks);
            } finally {
              backgroundApiProxy.serviceLimitOrder.closeProgressStatus();
            }
          }}
        />
      ));
    } else {
      await combinedTasks(tasks);
    }
  }, [params, instantRate, intl, sendSignMessage, sendSwapTx, navigation]);

  const onPress = useCallback(async () => {
    if (ref.current) {
      return;
    }

    ref.current = true;
    try {
      backgroundApiProxy.serviceLimitOrder.openProgressStatus();
      await onSubmit();
    } finally {
      ref.current = false;
      backgroundApiProxy.serviceLimitOrder.closeProgressStatus();
    }
  }, [onSubmit]);

  if (progressStatus) {
    return <LimitOrderProgressButton />;
  }

  return (
    <Button key="limit_order" size="xl" type="primary" onPress={onPress}>
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
  const intl = useIntl();
  const limitOrderMaintain = useAppSelector(
    (s) => s.swapTransactions.limitOrderMaintain,
  );
  if (limitOrderMaintain) {
    return (
      <Button size="xl" type="primary" isDisabled key="limitOrderMaintain">
        {intl.formatMessage({ id: 'action__under_maintaince' })}
      </Button>
    );
  }
  return <LimitOrderStateButton />;
};
