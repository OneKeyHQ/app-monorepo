/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { useCallback, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Button, ToastManager } from '@onekeyhq/components';
import { getWalletIdFromAccountId } from '@onekeyhq/engine/src/managers/account';
import type { Account as BaseAccount } from '@onekeyhq/engine/src/types/account';
import type { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import type { IEncodedTx, ISwapInfo } from '@onekeyhq/engine/src/vaults/types';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useNavigation } from '../../hooks';
import { useActiveWalletAccount, useAppSelector } from '../../hooks/redux';
import { ModalRoutes, RootRoutes } from '../../routes/types';
import { addTransaction } from '../../store/reducers/swapTransactions';
import { deviceUtils } from '../../utils/hardware';
import { wait } from '../../utils/helper';
import { canShowAppReview, openAppReview } from '../../utils/openAppReview';
import { SendRoutes } from '../Send/types';

import { reservedNetworkFee } from './config';
import {
  useDerivedSwapState,
  useInputLimitsError,
  useSwapError,
  useSwapQuoteRequestParams,
} from './hooks/useSwap';
import { SwapQuoter } from './quoter';
import { dangerRefs } from './refs';
import { SwapError, SwapRoutes } from './typings';
import {
  formatAmount,
  getTokenAmountString,
  getTokenAmountValue,
} from './utils';

import type { FetchQuoteParams, QuoteData } from './typings';
import type { TokenAmount } from './utils';

type IConvertToSwapInfoOptions = {
  swapQuote: QuoteData;
  quoteParams: FetchQuoteParams;
  inputAmount: TokenAmount;
  outputAmount: TokenAmount;
  account: BaseAccount;
  receivingAddress?: string;
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

const ExchangeButton = () => {
  const intl = useIntl();

  const ref = useRef(false);
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();
  const networks = useAppSelector((s) => s.runtime.networks);
  const quote = useAppSelector((s) => s.swap.quote);
  const sendingAccount = useAppSelector((s) => s.swap.sendingAccount);
  const recipient = useAppSelector((s) => s.swap.recipient);
  const validationSetting = useAppSelector((s) => s.settings.validationSetting);
  const { inputAmount, outputAmount } = useDerivedSwapState();
  const params = useSwapQuoteRequestParams();
  const disableSwapExactApproveAmount = useAppSelector(
    (s) => s.settings.disableSwapExactApproveAmount,
  );

  const onSubmit = useCallback(async () => {
    if (!params || !sendingAccount || !quote || !inputAmount || !outputAmount) {
      ToastManager.show({
        title: intl.formatMessage({ id: 'msg__unknown_error' }),
      });
      return;
    }

    const accountInWallets =
      await backgroundApiProxy.serviceSwap.checkAccountInWallets(
        sendingAccount.id,
      );

    if (!accountInWallets) {
      ToastManager.show({
        title: intl.formatMessage(
          { id: 'msg__account_deleted' },
          { '0': sendingAccount.name },
        ),
        type: 'error',
      });
      return;
    }

    const targetNetworkId = inputAmount.token.networkId;

    const targetNetwork = networks.find((item) => item.id === targetNetworkId);
    if (!targetNetwork) {
      ToastManager.show({
        title: intl.formatMessage({ id: 'msg__unknown_error' }),
      });
      return;
    }

    if (!params.tokenIn.tokenIdOnNetwork) {
      const [result] = await backgroundApiProxy.serviceToken.fetchTokenBalance({
        activeAccountId: sendingAccount.id,
        activeNetworkId: targetNetwork.id,
      });
      const balance = new BigNumber(result?.main?.balance ?? '0');
      const reservedValue = reservedNetworkFee[targetNetwork.id] ?? 0.1;
      if (balance.minus(inputAmount.typedValue).lt(reservedValue)) {
        ToastManager.show({
          title: intl.formatMessage(
            { id: 'msg__gas_fee_is_not_enough_please_keep_at_least_str' },
            { '0': `${reservedValue} ${params.tokenIn.symbol.toUpperCase()}` },
          ),
        });
        return;
      }
    }

    const res = await SwapQuoter.client.buildTransaction(quote.type, {
      ...params,
      activeAccount: sendingAccount,
      receivingAddress: recipient?.address,
      txData: quote.txData,
      additionalParams: quote.additionalParams,
      sellAmount: quote.sellAmount,
      buyAmount: quote.buyAmount,
    });

    if (!res?.data) {
      const title =
        res?.error?.msg ?? intl.formatMessage({ id: 'msg__unknown_error' });
      ToastManager.show({ title });
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

    let encodedTx: IEncodedTx | undefined;
    if (typeof res?.data === 'object') {
      // @ts-expect-error
      encodedTx = {
        ...res?.data,
        // SUI Transaction: error TS2322
        from: sendingAccount.address,
      };
    } else {
      encodedTx = res.data;
    }

    if (encodedTx === undefined) {
      ToastManager.show({
        title: intl.formatMessage({ id: 'msg__unknown_error' }),
      });
      return;
    }

    const newQuote = res.result;

    if (!newQuote) {
      ToastManager.show({
        title: intl.formatMessage({ id: 'msg__unknown_error' }),
      });
      return;
    }

    const addSwapTransaction = async (hash: string, nonce?: number) => {
      backgroundApiProxy.dispatch(
        addTransaction({
          accountId: sendingAccount.id,
          networkId: targetNetwork.id,
          transaction: {
            hash,
            from: sendingAccount.address,
            addedTime: Date.now(),
            status: 'pending',
            type: 'swap',
            accountId: sendingAccount.id,
            networkId: targetNetwork.id,
            quoterType: quote.type,
            nonce,
            attachment: res.attachment,
            receivingAddress: recipient?.address,
            providers: newQuote?.sources ?? quote.providers,
            arrivalTime: quote.arrivalTime,
            percentageFee: quote.percentageFee,
            tokens: {
              rate: Number(res?.result?.instantRate ?? quote.instantRate),
              from: {
                networkId: inputAmount.token.networkId,
                token: inputAmount.token,
                amount:
                  formatAmount(
                    new BigNumber(newQuote.sellAmount).shiftedBy(
                      -inputAmount.token.decimals,
                    ),
                  ) || inputAmount.typedValue,
              },
              to: {
                networkId: outputAmount.token.networkId,
                token: outputAmount.token,
                amount:
                  formatAmount(
                    new BigNumber(newQuote.buyAmount).shiftedBy(
                      -outputAmount.token.decimals,
                    ),
                  ) || outputAmount.typedValue,
              },
            },
          },
        }),
      );
      backgroundApiProxy.serviceSwap.clearState();
      backgroundApiProxy.serviceToken.addAccountToken(
        inputAmount.token.networkId,
        sendingAccount.id,
        inputAmount.token.tokenIdOnNetwork,
      );
      if (inputAmount.token.networkId === outputAmount.token.networkId) {
        backgroundApiProxy.serviceToken.addAccountToken(
          outputAmount.token.networkId,
          sendingAccount.id,
          outputAmount.token.tokenIdOnNetwork,
        );
      }
      if (res.result?.quoter === 'swftc' && res.attachment?.swftcOrderId) {
        SwapQuoter.client.swftModifyTxId(res.attachment?.swftcOrderId, hash);
      }
      const show = await canShowAppReview();
      if (show) {
        await wait(2000);
        openAppReview();
      }
    };

    const walletId = getWalletIdFromAccountId(sendingAccount.id);
    const wallet = await backgroundApiProxy.engine.getWallet(walletId);

    let needApproved = false;
    let approveTx: IEncodedTxEvm | undefined;

    if (newQuote.allowanceTarget && params.tokenIn.tokenIdOnNetwork) {
      const allowance = await backgroundApiProxy.engine.getTokenAllowance({
        networkId: params.tokenIn.networkId,
        accountId: params.activeAccount.id,
        tokenIdOnNetwork: params.tokenIn.tokenIdOnNetwork,
        spender: newQuote.allowanceTarget,
      });
      if (allowance) {
        needApproved = new BigNumber(
          getTokenAmountString(params.tokenIn, allowance),
        ).lt(newQuote.sellAmount);
      }
    }

    if (needApproved && newQuote.allowanceTarget) {
      const amount = disableSwapExactApproveAmount
        ? 'unlimited'
        : getTokenAmountValue(inputAmount.token, newQuote.sellAmount).toFixed();

      approveTx = (await backgroundApiProxy.engine.buildEncodedTxFromApprove({
        spender: newQuote.allowanceTarget,
        networkId: params.tokenIn.networkId,
        accountId: sendingAccount.id,
        token: inputAmount.token.tokenIdOnNetwork,
        amount,
      })) as IEncodedTxEvm;
    }
    try {
      if (wallet.type === 'hw') {
        if (approveTx) {
          await backgroundApiProxy.serviceSwap.sendTransaction({
            accountId: sendingAccount.id,
            networkId: targetNetworkId,
            encodedTx: approveTx,
          });
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.Send,
            params: {
              screen: SendRoutes.HardwareSwapContinue,
              params: {
                networkId: targetNetworkId,
                accountId: sendingAccount.id,
              },
            },
          });
        }
        try {
          const { result, decodedTx } =
            await backgroundApiProxy.serviceSwap.sendTransaction({
              accountId: sendingAccount.id,
              networkId: targetNetworkId,
              encodedTx: { ...(encodedTx as IEncodedTxEvm) },
              payload: {
                type: 'InternalSwap',
                swapInfo,
              },
            });
          addSwapTransaction(result.txid, decodedTx.nonce);
          appUIEventBus.emit(AppUIEventBusNames.SwapCompleted);
        } catch (e: any) {
          deviceUtils.showErrorToast(e, e?.data?.message || e.message);
          appUIEventBus.emit(AppUIEventBusNames.SwapError);
        }
      } else if (wallet.type === 'external') {
        const sendTx = () => {
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.Send,
            params: {
              screen: SendRoutes.SendConfirm,
              params: {
                accountId: sendingAccount.id,
                networkId: targetNetworkId,
                payloadInfo: {
                  type: 'InternalSwap',
                  swapInfo,
                },
                feeInfoEditable: true,
                feeInfoUseFeeInTx: false,
                encodedTx,
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
                onSuccess: (tx, data) => {
                  addSwapTransaction(tx.txid, data?.decodedTx?.nonce);
                },
              },
            },
          });
        };
        if (approveTx) {
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.Send,
            params: {
              screen: SendRoutes.SendConfirm,
              params: {
                accountId: sendingAccount.id,
                networkId: targetNetworkId,
                feeInfoEditable: true,
                feeInfoUseFeeInTx: false,
                encodedTx: approveTx,
                onSuccess: sendTx,
              },
            },
          });
        } else {
          sendTx();
        }
      } else {
        const password = await backgroundApiProxy.servicePassword.getPassword();
        if (password && !validationSetting?.Payment) {
          if (approveTx) {
            await backgroundApiProxy.serviceSwap.sendTransaction({
              accountId: sendingAccount.id,
              networkId: targetNetworkId,
              encodedTx: approveTx,
            });
          }
          const { result, decodedTx } =
            await backgroundApiProxy.serviceSwap.sendTransaction({
              accountId: sendingAccount.id,
              networkId: targetNetworkId,
              encodedTx: { ...(encodedTx as IEncodedTxEvm) },
              payload: {
                type: 'InternalSwap',
                swapInfo,
              },
            });
          addSwapTransaction(result.txid, decodedTx.nonce);
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.Send,
            params: {
              screen: SendRoutes.SendFeedbackReceipt,
              params: {
                networkId: targetNetworkId,
                accountId: sendingAccount.id,
                txid: result.txid,
                type: 'Send',
              },
            },
          });
        } else {
          if (approveTx !== undefined) {
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.Send,
              params: {
                screen: SendRoutes.SendConfirm,
                params: {
                  accountId: sendingAccount.id,
                  networkId: targetNetworkId,
                  feeInfoEditable: true,
                  feeInfoUseFeeInTx: false,
                  encodedTx: approveTx,
                  payloadInfo: {
                    type: 'InternalSwap',
                    swapInfo: { ...swapInfo, isApprove: true },
                  },
                  onSuccess: async () => {
                    const { result, decodedTx } =
                      await backgroundApiProxy.serviceSwap.sendTransaction({
                        accountId: sendingAccount.id,
                        networkId: targetNetworkId,
                        encodedTx: { ...(encodedTx as IEncodedTxEvm) },
                        payload: {
                          type: 'InternalSwap',
                          swapInfo,
                        },
                      });
                    addSwapTransaction(result.txid, decodedTx.nonce);
                  },
                },
              },
            });
            return 
          }
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.Send,
            params: {
              screen: SendRoutes.SendConfirm,
              params: {
                accountId: sendingAccount.id,
                networkId: targetNetworkId,
                feeInfoEditable: true,
                feeInfoUseFeeInTx: false,
                encodedTx: { ...(encodedTx as IEncodedTxEvm) },
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
                onSuccess: (tx, data) => {
                  addSwapTransaction(tx.txid, data?.decodedTx?.nonce);
                },
              },
            },
          });
        }
      }
    } catch (e: any) {
      deviceUtils.showErrorToast(e, e?.data?.message || e.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    params,
    quote,
    sendingAccount,
    inputAmount,
    outputAmount,
    addTransaction,
    disableSwapExactApproveAmount,
    recipient?.address,
    validationSetting,
  ]);

  const onPress = useCallback(async () => {
    if (ref.current) {
      return;
    }
    setLoading(true);
    ref.current = true;
    try {
      dangerRefs.submited = true;
      await onSubmit();
    } finally {
      ref.current = false;
      dangerRefs.submited = false;
      setLoading(false);
    }
  }, [onSubmit]);

  return (
    <Button
      key="submit"
      size="xl"
      type="primary"
      isLoading={loading}
      isDisabled={!quote || !recipient}
      onPress={onPress}
    >
      {intl.formatMessage({ id: 'title__swap' })}
    </Button>
  );
};

const SwapStateButton = () => {
  const intl = useIntl();
  const inputToken = useAppSelector((s) => s.swap.inputToken);
  const loading = useAppSelector((s) => s.swap.loading);
  const error = useSwapError();
  const limitsError = useInputLimitsError();

  if (error) {
    if (error === SwapError.InsufficientBalance) {
      return (
        <Button
          size="xl"
          type="primary"
          isDisabled
          key="insufficient_balance_error"
        >
          {intl.formatMessage(
            { id: 'form__amount_invalid' },
            { '0': inputToken?.symbol },
          )}
        </Button>
      );
    }
    return (
      <Button size="xl" type="primary" isDisabled key="baseError">
        {intl.formatMessage({ id: 'title__swap' })}
      </Button>
    );
  }

  if (limitsError) {
    return (
      <Button size="xl" type="primary" isDisabled key="depositLimit">
        {intl.formatMessage({ id: 'title__swap' })}
      </Button>
    );
  }

  if (loading) {
    return (
      <Button
        size="xl"
        type="primary"
        isDisabled
        isLoading={loading}
        key="loading"
      >
        {intl.formatMessage({ id: 'title__finding_the_best_channel' })}
      </Button>
    );
  }

  return <ExchangeButton />;
};

const SwapButton = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const swapMaintain = useAppSelector((s) => s.swapTransactions.swapMaintain);
  const { wallet } = useActiveWalletAccount();

  const onCreateWallet = useCallback(() => {
    navigation.navigate(RootRoutes.Onboarding);
  }, [navigation]);

  if (!wallet) {
    return (
      <Button size="xl" type="primary" onPress={onCreateWallet} key="addWallet">
        {intl.formatMessage({ id: 'action__create_wallet' })}
      </Button>
    );
  }

  if (swapMaintain) {
    return (
      <Button size="xl" type="primary" isDisabled key="swapMaintain">
        {intl.formatMessage({ id: 'action__under_maintaince' })}
      </Button>
    );
  }

  return <SwapStateButton />;
};

export default SwapButton;
