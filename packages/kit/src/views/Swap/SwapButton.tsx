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

import {
  useDerivedSwapState,
  useInputLimitsError,
  useSwapError,
  useSwapQuoteRequestParams,
} from './hooks/useSwap';
import { SwapQuoter } from './quoter';
import { SwapError, SwapRoutes } from './typings';
import {
  formatAmount,
  getTokenAmountString,
  getTokenAmountValue,
} from './utils';

import type { FetchQuoteParams, QuoteData } from './typings';
import type { TokenAmount } from './utils';

function convertToSwapInfo(options: {
  swapQuote: QuoteData;
  quoteParams: FetchQuoteParams;
  inputAmount: TokenAmount;
  outputAmount: TokenAmount;
  account: BaseAccount;
  receivingAddress?: string;
}): ISwapInfo {
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
      encodedTx = {
        ...res?.data,
        // SUI Transaction: error TS2322
        // @ts-expect-error
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
      const show = await canShowAppReview();
      if (show) {
        await wait(2000);
        openAppReview();
      }
    };

    let needApproved = false;

    const walletId = getWalletIdFromAccountId(sendingAccount.id);
    const wallet = await backgroundApiProxy.engine.getWallet(walletId);

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
      const encodedApproveTx =
        (await backgroundApiProxy.engine.buildEncodedTxFromApprove({
          spender: newQuote.allowanceTarget,
          networkId: params.tokenIn.networkId,
          accountId: sendingAccount.id,
          token: inputAmount.token.tokenIdOnNetwork,
          amount: disableSwapExactApproveAmount
            ? 'unlimited'
            : getTokenAmountValue(inputAmount.token, newQuote.sellAmount)
                .multipliedBy(1.5)
                .toFixed(),
        })) as IEncodedTxEvm;

      const password = await backgroundApiProxy.servicePassword.getPassword();

      if ((password && !validationSetting?.Payment) || wallet.type === 'hw') {
        try {
          await backgroundApiProxy.serviceSwap.sendTransaction({
            accountId: sendingAccount.id,
            networkId: targetNetworkId,
            encodedTx: encodedApproveTx,
          });
        } catch (e: any) {
          deviceUtils.showErrorToast(e, 'msg__unknown_error');
          return;
        }

        if (wallet.type === 'hw') {
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

        const encodedEvmTx = encodedTx as IEncodedTxEvm;
        try {
          const { result, decodedTx } =
            await backgroundApiProxy.serviceSwap.sendTransaction({
              accountId: sendingAccount.id,
              networkId: targetNetworkId,
              encodedTx: { ...encodedEvmTx },
              payload: {
                type: 'InternalSwap',
                swapInfo,
              },
            });
          addSwapTransaction(result.txid, decodedTx.nonce);
          if (wallet.type !== 'hw') {
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
          }
          appUIEventBus.emit(AppUIEventBusNames.SwapCompleted);
        } catch (e: any) {
          deviceUtils.showErrorToast(e, 'msg__unknown_error');
          appUIEventBus.emit(AppUIEventBusNames.SwapError);
        }
        return;
      }

      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Send,
        params: {
          screen: SendRoutes.SendConfirm,
          params: {
            accountId: sendingAccount.id,
            networkId: targetNetworkId,
            payloadInfo: {
              type: 'InternalSwap',
              swapInfo: { ...swapInfo, isApprove: true },
            },
            feeInfoEditable: true,
            feeInfoUseFeeInTx: false,
            skipSaveHistory: true,
            encodedTx: {
              ...encodedApproveTx,
              from: sendingAccount?.address,
            },
            onSuccess: async () => {
              if (!encodedTx) {
                return;
              }
              const encodedEvmTx = encodedTx as IEncodedTxEvm;
              try {
                const { result, decodedTx } =
                  await backgroundApiProxy.serviceSwap.sendTransaction({
                    accountId: sendingAccount.id,
                    networkId: targetNetworkId,
                    encodedTx: { ...encodedEvmTx },
                    payload: {
                      type: 'InternalSwap',
                      swapInfo,
                    },
                  });
                addSwapTransaction(result.txid, decodedTx.nonce);
                appUIEventBus.emit(AppUIEventBusNames.SwapCompleted);
              } catch {
                appUIEventBus.emit(AppUIEventBusNames.SwapError);
              }
            },
          },
        },
      });
      return;
    }

    if (wallet.type === 'hw') {
      try {
        const { result, decodedTx } =
          await backgroundApiProxy.serviceSwap.sendTransaction({
            accountId: sendingAccount.id,
            networkId: targetNetworkId,
            encodedTx,
            payload: {
              type: 'InternalSwap',
              swapInfo,
            },
          });
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
        addSwapTransaction(result.txid, decodedTx.nonce);
      } catch (e: any) {
        deviceUtils.showErrorToast(e, 'msg__unknown_error');
      }
    } else {
      const password = await backgroundApiProxy.servicePassword.getPassword();
      if (password && !validationSetting?.Payment) {
        try {
          const { result, decodedTx } =
            await backgroundApiProxy.serviceSwap.sendTransaction({
              accountId: sendingAccount.id,
              networkId: targetNetworkId,
              encodedTx,
              payload: {
                type: 'InternalSwap',
                swapInfo,
              },
            });
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
          setTimeout(() => {
            addSwapTransaction(result.txid, decodedTx.nonce);
          }, 100);
        } catch (e: any) {
          deviceUtils.showErrorToast(e, 'msg__unknown_error');
        }
      } else {
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
      }
    }
    await wait(1000);
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
      await onSubmit();
    } finally {
      ref.current = false;
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
    // if (error === SwapError.QuoteFailed) {
    //   return <RetryQuoteButton />;
    // }
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
