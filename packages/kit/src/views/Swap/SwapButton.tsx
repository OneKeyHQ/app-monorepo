import React, { useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Button, useToast } from '@onekeyhq/components';
import { Account as BaseAccount } from '@onekeyhq/engine/src/types/account';
import { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import { IEncodedTx, ISwapInfo } from '@onekeyhq/engine/src/vaults/types';
import {
  AppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useNavigation } from '../../hooks';
import { useActiveWalletAccount, useRuntime } from '../../hooks/redux';
import { ModalRoutes, RootRoutes } from '../../routes/types';
import { changeActiveAccount } from '../../store/reducers/general';
import { addTransaction } from '../../store/reducers/swapTransactions';
import { sleep } from '../../utils/promiseUtils';
import { SendRoutes } from '../Send/types';

import {
  useDerivedSwapState,
  useInputLimitsError,
  useSwapQuoteCallback,
  useSwapQuoteRequestParams,
  useSwapRecipient,
  useSwapState,
} from './hooks/useSwap';
import { SwapQuoter } from './quoter';
import { FetchQuoteParams, QuoteData, SwapError, SwapRoutes } from './typings';
import { TokenAmount } from './utils';

function convertToSwapInfo(options: {
  swapQuote: QuoteData;
  quoteParams: FetchQuoteParams;
  inputAmount: TokenAmount;
  outputAmount: TokenAmount;
  account: BaseAccount;
}): ISwapInfo {
  const { swapQuote, quoteParams, inputAmount, outputAmount, account } =
    options;
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

const RetryQuoteButton = () => {
  const intl = useIntl();
  const onQuote = useSwapQuoteCallback({ showLoading: true });
  return (
    <Button size="xl" type="primary" key="network_error" onPress={onQuote}>
      {intl.formatMessage({ id: 'action__retry' })}
    </Button>
  );
};

const ExchangeButton = () => {
  const intl = useIntl();
  const toast = useToast();
  const navigation = useNavigation();
  const { networks } = useRuntime();
  const { quote, sendingAccount } = useSwapState();
  const { account: currentAccount, network } = useActiveWalletAccount();
  const { inputAmount, outputAmount } = useDerivedSwapState();
  const recipient = useSwapRecipient();
  const params = useSwapQuoteRequestParams();

  const onSubmit = useCallback(async () => {
    if (!params || !sendingAccount || !quote || !inputAmount || !outputAmount) {
      toast.show({ title: intl.formatMessage({ id: 'msg__unknown_error' }) });
      return;
    }

    const accountInWallets =
      await backgroundApiProxy.serviceSwap.checkAccountInWallets(
        sendingAccount.id,
      );

    if (!accountInWallets) {
      toast.show({
        title: intl.formatMessage(
          { id: 'msg__account_deleted' },
          { '0': sendingAccount.name },
        ),
        type: 'error',
      });
      return;
    }

    const targetNetworkId = inputAmount.token.networkId;

    if (network?.id !== targetNetworkId) {
      backgroundApiProxy.serviceNetwork.changeActiveNetwork(targetNetworkId);
      await sleep(1000);
    }
    if (sendingAccount && sendingAccount !== currentAccount) {
      const wallet =
        await backgroundApiProxy.serviceSwap.getAccountRelatedWallet(
          sendingAccount.id,
        );
      if (wallet) {
        backgroundApiProxy.dispatch(
          changeActiveAccount({
            activeAccountId: sendingAccount.id,
            activeWalletId: wallet.id,
          }),
        );
        await sleep(1000);
      }
    }

    const targetNetwork = networks.find((item) => item.id === targetNetworkId);
    if (!targetNetwork) {
      toast.show({ title: intl.formatMessage({ id: 'msg__unknown_error' }) });
      return;
    }

    const res = await SwapQuoter.client.buildTransaction(quote.type, {
      ...params,
      activeAccount: sendingAccount,
      receivingAddress: recipient?.address,
      txData: quote.txData,
      additionalParams: quote.additionalParams,
    });

    if (!res?.data) {
      const title =
        res?.error?.msg ?? intl.formatMessage({ id: 'msg__unknown_error' });
      toast.show({ title });
      return;
    }

    const swapInfo = convertToSwapInfo({
      quoteParams: params,
      inputAmount,
      outputAmount,
      swapQuote: quote,
      account: sendingAccount,
    });

    let encodedTx: IEncodedTx | undefined;
    if (typeof res?.data === 'object') {
      encodedTx = {
        ...res?.data,
        from: sendingAccount.address,
      };
    } else {
      encodedTx = res.data;
    }

    if (encodedTx === undefined) {
      toast.show({ title: intl.formatMessage({ id: 'msg__unknown_error' }) });
      return;
    }

    const addSwapTransaction = (hash: string, nonce?: number) => {
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
            providers: quote.providers,
            arrivalTime: quote.arrivalTime,
            tokens: {
              rate: Number(quote.instantRate),
              from: {
                networkId: inputAmount.token.networkId,
                token: inputAmount.token,
                amount: inputAmount.typedValue,
              },
              to: {
                networkId: outputAmount.token.networkId,
                token: outputAmount.token,
                amount: outputAmount.typedValue,
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
    };

    if (quote.allowanceTarget && params.tokenIn.tokenIdOnNetwork) {
      const allowance = await backgroundApiProxy.engine.getTokenAllowance({
        networkId: params.tokenIn.networkId,
        tokenIdOnNetwork: params.tokenIn.tokenIdOnNetwork,
        spender: quote.allowanceTarget,
        accountId: sendingAccount.id,
      });
      const allowanceBN = new BigNumber(allowance ?? '0');
      if (allowanceBN.lt(inputAmount.toNumber())) {
        const encodedApproveTx =
          (await backgroundApiProxy.engine.buildEncodedTxFromApprove({
            spender: quote.allowanceTarget,
            networkId: params.tokenIn.networkId,
            accountId: sendingAccount.id,
            token: inputAmount.token.tokenIdOnNetwork,
            amount: 'unlimited',
          })) as IEncodedTxEvm;
        const nonce = await backgroundApiProxy.engine.getEvmNextNonce({
          networkId: params.tokenIn.networkId,
          accountId: sendingAccount.id,
        });
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.Send,
          params: {
            screen: SendRoutes.SendConfirm,
            params: {
              payloadInfo: {
                type: 'InternalSwap',
                swapInfo: { ...swapInfo, isApprove: true },
              },
              feeInfoEditable: true,
              feeInfoUseFeeInTx: false,
              skipSaveHistory: true,
              encodedTx: {
                ...encodedApproveTx,
                nonce,
                from: sendingAccount?.address,
              },
              onSuccess: async () => {
                if (!encodedTx) {
                  return;
                }
                const encodedEvmTx = encodedTx as IEncodedTxEvm;
                const { result, decodedTx } =
                  await backgroundApiProxy.serviceSwap.sendTransaction({
                    accountId: params.activeAccount.id,
                    networkId: params.tokenIn.networkId,
                    encodedTx: { ...encodedEvmTx, nonce: nonce + 1 },
                    payload: {
                      type: 'InternalSwap',
                      swapInfo,
                    },
                  });
                appEventBus.emit(AppEventBusNames.SwapCompleted);
                addSwapTransaction(result.txid, decodedTx.nonce);
              },
            },
          },
        });
        return;
      }
    }
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Send,
      params: {
        screen: SendRoutes.SendConfirm,
        params: {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    params,
    quote,
    currentAccount,
    sendingAccount,
    network,
    inputAmount,
    outputAmount,
    addTransaction,
    recipient?.address,
  ]);

  return (
    <Button
      key="submit"
      size="xl"
      type="primary"
      isDisabled={!quote || !recipient}
      onPromise={onSubmit}
    >
      {intl.formatMessage({ id: 'title__swap' })}
    </Button>
  );
};

const SwapStateButton = () => {
  const intl = useIntl();
  const { inputToken, loading } = useSwapState();
  const { error } = useDerivedSwapState();
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
    if (error === SwapError.QuoteFailed) {
      return <RetryQuoteButton />;
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

  return <SwapStateButton />;
};

export default SwapButton;
