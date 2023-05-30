/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { ToastManager } from '@onekeyhq/components';
import { getWalletIdFromAccountId } from '@onekeyhq/engine/src/managers/account';
import type { Account as BaseAccount } from '@onekeyhq/engine/src/types/account';
import type { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import type {
  IDecodedTx,
  IEncodedTx,
  ISwapInfo,
} from '@onekeyhq/engine/src/vaults/types';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNavigation } from '../../../hooks';
import {
  ModalRoutes,
  RootRoutes,
  SendModalRoutes,
} from '../../../routes/routesEnum';
import { appSelector } from '../../../store';
import { clearState } from '../../../store/reducers/swap';
import {
  addTransaction,
  setSlippage,
} from '../../../store/reducers/swapTransactions';
import { wait } from '../../../utils/helper';
import { showOverlay } from '../../../utils/overlayUtils';
import { SwapTransactionsCancelApprovalBottomSheetModal } from '../components/CancelApprovalModal';
import { SwapQuoter } from '../quoter';
import { SwapRoutes } from '../typings';
import {
  LoggerTimerTags,
  TokenAmount,
  calculateDecodedTxNetworkFee,
  combinedTasks,
  createLoggerTimer,
  formatAmount,
  getTokenAmountString,
  getTokenAmountValue,
} from '../utils';

import { useSwapSend } from './useSwapSend';

import type {
  BuildTransactionParams,
  BuildTransactionResponse,
  FetchQuoteParams,
  ProgressStatus,
  QuoteData,
  Recipient,
  TransactionToken,
} from '../typings';
import type { Task } from '../utils';
import type { SendSuccessCallback } from './useSwapSend';

type IConvertToSwapInfoOptions = {
  swapQuote: QuoteData;
  quoteParams: FetchQuoteParams;
  inputAmount: TokenAmount;
  outputAmount: TokenAmount;
  account: BaseAccount;
  receivingAddress?: string;
};

const addSwapTransaction = async ({
  hash,
  decodedTx,
  params,
  response,
  recipient,
  quote,
}: {
  hash: string;
  decodedTx?: IDecodedTx;
  params: BuildTransactionParams;
  response: BuildTransactionResponse;
  recipient: Recipient;
  quote: QuoteData;
}) => {
  const newQuote = response?.result;
  if (response === undefined || newQuote === undefined) {
    return;
  }
  const actions: any[] = [clearState()];
  // backgroundApiProxy.serviceSwap.clearState();
  const sellAmount = newQuote.sellAmount || quote.sellAmount;
  const buyAmount = newQuote.buyAmount || quote.buyAmount;
  const quoterType = quote.type;
  const quoterLogo = quote.quoterlogo;
  const fromNetwork = await backgroundApiProxy.engine.getNetwork(
    params.tokenIn.networkId,
  );
  const toNetwork = await backgroundApiProxy.engine.getNetwork(
    params.tokenIn.networkId,
  );
  const inputAmount = getTokenAmountValue(params.tokenIn, sellAmount);
  const outputAmount = getTokenAmountValue(params.tokenOut, buyAmount);
  const nonce = decodedTx?.nonce;

  let networkFee: string | undefined;
  if (decodedTx) {
    networkFee = calculateDecodedTxNetworkFee(decodedTx, fromNetwork);
  }

  const from: TransactionToken = {
    networkId: params.tokenIn.networkId,
    token: params.tokenIn,
    amount:
      formatAmount(
        new BigNumber(newQuote.sellAmount).shiftedBy(-params.tokenIn.decimals),
      ) || formatAmount(inputAmount),
  };
  const to: TransactionToken = {
    networkId: params.tokenOut.networkId,
    token: params.tokenOut,
    amount:
      formatAmount(
        new BigNumber(newQuote.buyAmount).shiftedBy(-params.tokenOut.decimals),
      ) || formatAmount(outputAmount),
  };
  actions.push(
    addTransaction({
      accountId: params.activeAccount.id,
      networkId: params.tokenIn.networkId,
      transaction: {
        hash,
        from: params.activeAccount.address,
        addedTime: Date.now(),
        status: 'pending',
        type: 'swap',
        accountId: params.activeAccount.id,
        networkId: params.tokenIn.networkId,
        quoterType,
        quoterLogo,
        nonce,
        attachment: response.attachment,
        receivingAccountId: recipient?.accountId,
        receivingAddress: recipient?.address,
        providers: newQuote?.sources ?? quote.providers,
        arrivalTime: quote.arrivalTime,
        percentageFee: quote.percentageFee,
        protocalFees: quote.protocolFees,
        networkFee,
        tokens: {
          from,
          to,
          rate: Number(newQuote?.instantRate ?? quote.instantRate),
        },
      },
    }),
  );
  // backgroundApiProxy.serviceSwap.resetSwapSlippage();
  const slippage = appSelector((s) => s.swapTransactions.slippage);
  if (slippage && slippage.autoReset) {
    actions.push(setSlippage({ mode: 'auto' }));
  }

  backgroundApiProxy.dispatch(...actions);

  backgroundApiProxy.serviceToken.addAccountToken(
    params.tokenIn.networkId,
    params.activeAccount.id,
    params.tokenIn.tokenIdOnNetwork,
  );
  if (params.tokenIn.networkId === params.tokenOut.networkId) {
    backgroundApiProxy.serviceToken.addAccountToken(
      params.tokenOut.networkId,
      params.activeAccount.id,
      params.tokenOut.tokenIdOnNetwork,
    );
  }
  if (
    response.result?.quoter === 'swftc' &&
    response.attachment?.swftcOrderId
  ) {
    SwapQuoter.client.swftModifyTxId(response.attachment?.swftcOrderId, hash);
  }
  const fromNetworkName = fromNetwork?.shortName;
  const toNetworkName = toNetwork?.shortName;
  backgroundApiProxy.serviceSwap.addRecord({
    txid: hash,
    from: {
      networkId: from.networkId,
      networkName: fromNetworkName ?? '',
      tokenAddress: from.token.tokenIdOnNetwork,
      tokenName: from.token.name,
      amount: from.amount,
    },
    to: {
      networkId: to.networkId,
      networkName: toNetworkName ?? '',
      tokenAddress: to.token.tokenIdOnNetwork,
      tokenName: to.token.name,
      amount: to.amount,
    },
    params,
    response,
  });
  appUIEventBus.emit(AppUIEventBusNames.SwapAddTransaction);
};

function convertToSwapInfo(options: IConvertToSwapInfoOptions): ISwapInfo {
  const {
    swapQuote,
    quoteParams,
    inputAmount,
    outputAmount,
    account,
    receivingAddress,
  } = options;
  const {
    networkIn,
    networkOut,
    tokenIn,
    tokenOut,
    slippagePercentage,
    independentField,
  } = quoteParams;
  const swapInfo: ISwapInfo = {
    accountAddress: account.address,
    receivingAddress,
    send: {
      networkId: networkIn.id,
      tokenInfo: tokenIn,
      amount: inputAmount.typedValue,
      amountValue: inputAmount.amount.toFixed(),
    },
    receive: {
      networkId: networkOut.id,
      tokenInfo: tokenOut,
      amount: outputAmount.typedValue,
      amountValue: outputAmount.amount.toFixed(),
    },
    slippagePercentage,
    independentField,
    swapQuote,
  };
  return swapInfo;
}

type SwapSubmitInputParams = {
  params?: FetchQuoteParams;
  quote?: QuoteData;
  recipient?: Recipient;
  onSuccess?: SendSuccessCallback;
  setProgressStatus?: (status: ProgressStatus) => void;
  openProgressStatus?: () => void;
  closeProgressStatus?: () => void;
};

export const useSwapSubmit = () => {
  const intl = useIntl();
  const sendSwapTx = useSwapSend();
  const navigation = useNavigation();
  return useCallback(async (submitParams: SwapSubmitInputParams) => {
    const {
      params,
      quote,
      recipient,
      onSuccess,
      setProgressStatus,
      openProgressStatus,
      closeProgressStatus,
    } = submitParams;
    if (!params || !quote || !recipient) {
      ToastManager.show(
        {
          title: intl.formatMessage({ id: 'msg__unknown_error' }),
        },
        { type: 'error' },
      );
      return;
    }
    const sendingAccount = params.activeAccount;
    const inputAmount = new TokenAmount(
      params.tokenIn,
      getTokenAmountValue(params.tokenIn, quote.sellAmount).toFixed(),
    );
    const outputAmount = new TokenAmount(
      params.tokenOut,
      getTokenAmountValue(params.tokenOut, quote.buyAmount).toFixed(),
    );
    const accountInWallets =
      await backgroundApiProxy.serviceSwap.checkAccountInWallets(
        sendingAccount.id,
      );

    if (!accountInWallets) {
      ToastManager.show(
        {
          title: intl.formatMessage(
            { id: 'msg__account_deleted' },
            { '0': sendingAccount.name },
          ),
        },
        { type: 'error' },
      );
      return;
    }

    const fromNetworkId = params.tokenIn.networkId;

    const fromNetwork = await backgroundApiProxy.engine.getNetwork(
      fromNetworkId,
    );

    if (!fromNetwork) {
      ToastManager.show(
        {
          title: intl.formatMessage({ id: 'msg__unknown_error' }),
        },
        { type: 'error' },
      );
      return;
    }

    const tagLogger = createLoggerTimer();

    tagLogger.start(LoggerTimerTags.checkTokenBalance);
    setProgressStatus?.({
      title: intl.formatMessage(
        { id: 'action__confirming_balance_str' },
        { '0': '' },
      ),
    });
    const [result] =
      await backgroundApiProxy.serviceToken.getAccountBalanceFromRpc(
        fromNetwork.id,
        sendingAccount.id,
        [],
        true,
      );
    const balanceStr = result?.main?.balance;
    if (!balanceStr) {
      debugLogger.swap.info(
        `${params.tokenIn.networkId} failed to fetch native token balance`,
      );
    } else {
      debugLogger.swap.info(
        `${params.tokenIn.networkId} native token balance is ${balanceStr}`,
      );
    }
    tagLogger.end(LoggerTimerTags.checkTokenBalance);
    const balance = new BigNumber(balanceStr ?? '0');

    if (balance.isZero()) {
      ToastManager.show(
        {
          title: intl.formatMessage({ id: 'msg_insufficient_gas_fee' }),
        },
        { type: 'error' },
      );
      return;
    }
    const safeReservedValueForGasFee =
      await backgroundApiProxy.serviceSwap.getReservedNetworkFee(
        fromNetwork.id,
      );

    const currentReservedValueForGasFee = !params.tokenIn.tokenIdOnNetwork
      ? balance.minus(inputAmount.typedValue)
      : balance;
    if (currentReservedValueForGasFee.lt(safeReservedValueForGasFee)) {
      const nativeToken = await backgroundApiProxy.engine.getNativeTokenInfo(
        fromNetworkId,
      );
      ToastManager.show(
        {
          title: intl.formatMessage(
            { id: 'msg__suggest_reserving_str_as_gas_fee' },
            {
              '0': `${safeReservedValueForGasFee} ${nativeToken.symbol.toUpperCase()}`,
            },
          ),
        },
        { type: 'error' },
      );
      return;
    }

    let res: BuildTransactionResponse | undefined;
    const buildParams: BuildTransactionParams = {
      ...params,
      activeAccount: sendingAccount,
      receivingAddress: recipient?.address,
      txData: quote.txData,
      additionalParams: quote.additionalParams,
      sellAmount: quote.sellAmount,
      buyAmount: quote.buyAmount,
      disableValidate: true,
    };
    try {
      tagLogger.start(LoggerTimerTags.buildTransaction);
      setProgressStatus?.({
        title: intl.formatMessage(
          { id: 'action__building_transaction_data_str' },
          { '0': '' },
        ),
      });
      res = await SwapQuoter.client.buildTransaction(quote.type, buildParams);
      tagLogger.end(LoggerTimerTags.buildTransaction);
    } catch (e: any) {
      const title = e?.response?.data?.message || e.message;
      ToastManager.show({ title }, { type: 'error' });
      return;
    }

    if (res === undefined || !res?.data) {
      const title =
        res?.error?.msg ?? intl.formatMessage({ id: 'msg__unknown_error' });
      ToastManager.show({ title }, { type: 'error' });
      return;
    }

    const swapInfo = convertToSwapInfo({
      quoteParams: params,
      inputAmount,
      outputAmount,
      swapQuote: quote,
      account: sendingAccount,
      receivingAddress: recipient?.address,
    });

    const encodedTx: IEncodedTx | undefined = res.data;

    if (encodedTx === undefined) {
      ToastManager.show(
        {
          title: intl.formatMessage({ id: 'msg__unknown_error' }),
        },
        { type: 'error' },
      );
      return;
    }

    const newQuote = res.result;

    if (!newQuote) {
      ToastManager.show(
        {
          title: intl.formatMessage({ id: 'msg__unknown_error' }),
        },
        { type: 'error' },
      );
      return;
    }

    const walletId = getWalletIdFromAccountId(sendingAccount.id);
    const wallet = await backgroundApiProxy.engine.getWallet(walletId);

    let needApproved = false;
    let approveTx: IEncodedTxEvm | undefined;
    let cancelApproveTx: IEncodedTxEvm | undefined;

    if (newQuote.allowanceTarget && params.tokenIn.tokenIdOnNetwork) {
      tagLogger.start(LoggerTimerTags.checkTokenAllowance);
      const allowance = await backgroundApiProxy.engine.getTokenAllowance({
        networkId: params.tokenIn.networkId,
        accountId: params.activeAccount.id,
        tokenIdOnNetwork: params.tokenIn.tokenIdOnNetwork,
        spender: newQuote.allowanceTarget,
      });

      tagLogger.end(LoggerTimerTags.checkTokenAllowance);
      if (allowance) {
        debugLogger.swap.info(
          `${params.tokenIn.networkId} ${params.tokenIn.symbol} allowance is ${allowance}`,
        );
        needApproved = new BigNumber(
          getTokenAmountString(params.tokenIn, allowance),
        ).lt(newQuote.sellAmount);
      } else {
        debugLogger.swap.info(
          `${params.tokenIn.networkId} ${params.tokenIn.symbol} failed to fetch token allowance`,
        );
      }
      const needToResetApproval =
        await backgroundApiProxy.serviceSwap.needToResetApproval(
          params.tokenIn,
        );
      const needCancelApproval =
        needApproved && needToResetApproval && Number(allowance || '0') > 0;
      if (needCancelApproval) {
        cancelApproveTx =
          (await backgroundApiProxy.engine.buildEncodedTxFromApprove({
            spender: newQuote.allowanceTarget,
            networkId: params.tokenIn.networkId,
            accountId: sendingAccount.id,
            token: params.tokenIn.tokenIdOnNetwork,
            amount: '0',
          })) as IEncodedTxEvm;
      }

      if (needApproved) {
        const disableSwapExactApproveAmount = appSelector(
          (s) => s.settings.disableSwapExactApproveAmount,
        );
        const amount = disableSwapExactApproveAmount
          ? 'unlimited'
          : getTokenAmountValue(params.tokenIn, newQuote.sellAmount).toFixed();

        approveTx = (await backgroundApiProxy.engine.buildEncodedTxFromApprove({
          spender: newQuote.allowanceTarget,
          networkId: params.tokenIn.networkId,
          accountId: sendingAccount.id,
          token: params.tokenIn.tokenIdOnNetwork,
          amount,
        })) as IEncodedTxEvm;

        if (cancelApproveTx && cancelApproveTx.nonce) {
          approveTx.nonce = Number(cancelApproveTx.nonce) + 1;
        }
      }
    }

    const tasks: Task[] = [];

    const doSwap = async () => {
      setProgressStatus?.({
        title: intl.formatMessage({ id: 'action__swapping_str' }, { '0': '' }),
      });
      await sendSwapTx({
        accountId: sendingAccount.id,
        networkId: fromNetworkId,
        gasEstimateFallback: Boolean(approveTx),
        encodedTx: encodedTx as IEncodedTxEvm,
        showSendFeedbackReceipt: true,
        payloadInfo: {
          type: 'InternalSwap',
          swapInfo,
        },
        onDetail(txid) {
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.Swap,
            params: {
              screen: SwapRoutes.Transaction,
              params: {
                txid,
              },
            },
          });
        },
        onSuccess: async ({ result: swapResult, decodedTx }) => {
          if (!res) {
            return;
          }
          await addSwapTransaction({
            hash: swapResult.txid,
            decodedTx,
            params: buildParams,
            response: res,
            quote,
            recipient,
          });
          appUIEventBus.emit(AppUIEventBusNames.SwapCompleted);
          onSuccess?.({ result: swapResult, decodedTx });
        },
        onFail: () => {
          appUIEventBus.emit(AppUIEventBusNames.SwapError);
        },
      });
    };

    tasks.unshift(doSwap);

    if (approveTx) {
      const doApprove = async (nextTask?: Task) => {
        const payloadInfo: any = { type: 'InternalSwap' };
        if (wallet.type !== 'external') {
          payloadInfo.swapInfo = { ...swapInfo, isApprove: true };
        }
        tagLogger.start(LoggerTimerTags.approval);
        setProgressStatus?.({
          title: intl.formatMessage(
            { id: 'action__authorizing_str' },
            { '0': '' },
          ),
        });
        await sendSwapTx({
          accountId: sendingAccount.id,
          networkId: fromNetworkId,
          payloadInfo,
          encodedTx: approveTx as IEncodedTxEvm,
          gasEstimateFallback: Boolean(cancelApproveTx),
          onSuccess: async () => {
            if (wallet.type === 'hw') {
              navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.Send,
                params: {
                  screen: SendModalRoutes.HardwareSwapContinue,
                  params: {
                    networkId: fromNetworkId,
                    accountId: sendingAccount.id,
                  },
                },
              });
            }
            await nextTask?.();
          },
        });
        tagLogger.end(LoggerTimerTags.approval);
      };
      tasks.unshift(doApprove);
    }

    if (cancelApproveTx) {
      const doCancelApprove = async (nextTask?: Task) => {
        const payloadInfo: any = { type: 'InternalSwap' };
        if (wallet.type !== 'external') {
          payloadInfo.swapInfo = { ...swapInfo, isApprove: true };
        }
        tagLogger.start(LoggerTimerTags.cancelApproval);
        setProgressStatus?.({
          title: intl.formatMessage(
            { id: 'action__resetting_authorizing_str' },
            { '0': '' },
          ),
        });
        await sendSwapTx({
          accountId: sendingAccount.id,
          networkId: fromNetworkId,
          payloadInfo,
          encodedTx: cancelApproveTx as IEncodedTxEvm,
          onSuccess: async () => {
            await nextTask?.();
          },
        });
        tagLogger.end(LoggerTimerTags.cancelApproval);
      };
      tasks.unshift(doCancelApprove);
    }

    if (cancelApproveTx) {
      showOverlay((close) => (
        <SwapTransactionsCancelApprovalBottomSheetModal
          close={close}
          onSubmit={async () => {
            try {
              openProgressStatus?.();
              await combinedTasks(tasks);
            } finally {
              closeProgressStatus?.();
            }
          }}
        />
      ));
    } else {
      await combinedTasks(tasks);
    }
    await wait(1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};
