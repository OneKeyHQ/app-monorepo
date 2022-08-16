import React, { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Box, Button, useToast } from '@onekeyhq/components';
import { Account as BaseAccount } from '@onekeyhq/engine/src/types/account';
import { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import { ISwapInfo } from '@onekeyhq/engine/src/vaults/types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useNavigation } from '../../hooks';
import { useActiveWalletAccount } from '../../hooks/redux';
import {
  CreateAccountModalRoutes,
  CreateWalletModalRoutes,
} from '../../routes';
import { ModalRoutes, RootRoutes } from '../../routes/types';
import { addTransaction } from '../../store/reducers/swapTransactions';
import { SendRoutes } from '../Send/types';

import {
  useDerivedSwapState,
  useInputLimitsError,
  useReceivingAddress,
  useSwapEnabled,
  useSwapQuoteCallback,
  useSwapQuoteRequestParams,
  useSwapState,
} from './hooks/useSwap';
import { SwapQuoter } from './quoter';
import {
  ApprovalState,
  FetchQuoteParams,
  QuoteData,
  SwapError,
  SwapRoutes,
} from './typings';
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

const SwapButton = () => {
  const intl = useIntl();
  const toast = useToast();
  const navigation = useNavigation();
  const isSwapEnabled = useSwapEnabled();
  const { account, network, wallet } = useActiveWalletAccount();
  const {
    inputToken,
    approvalSubmitted,
    quote,
    loading,
    inputTokenNetwork,
    outputTokenNetwork,
  } = useSwapState();
  const { error, approveState, inputAmount, outputAmount } =
    useDerivedSwapState();
  const params = useSwapQuoteRequestParams();
  const { address: receivingAddress } = useReceivingAddress();
  const limitsError = useInputLimitsError();

  const showApproveFlow =
    approveState === ApprovalState.NOT_APPROVED ||
    approveState === ApprovalState.PENDING;

  let approveButtonText = intl.formatMessage({ id: 'title__approve' });
  if (approveState === ApprovalState.PENDING) {
    approveButtonText = intl.formatMessage({ id: 'title__approving' });
  } else if (approvalSubmitted && approveState === ApprovalState.APPROVED) {
    approveButtonText = intl.formatMessage({ id: 'title__approved' });
  }

  const onApprove = useCallback(async () => {
    if (account && network && quote && inputAmount && quote.allowanceTarget) {
      const encodedTx =
        (await backgroundApiProxy.engine.buildEncodedTxFromApprove({
          spender: quote?.allowanceTarget,
          networkId: network.id,
          accountId: account.id,
          token: inputAmount.token.tokenIdOnNetwork,
          amount: 'unlimited',
        })) as IEncodedTxEvm;
      const { allowanceTarget } = quote;
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Send,
        params: {
          screen: SendRoutes.SendConfirm,
          params: {
            feeInfoEditable: true,
            feeInfoUseFeeInTx: false,
            encodedTx: { ...encodedTx, from: account?.address },
            onSuccess(tx) {
              backgroundApiProxy.serviceSwap.setApprovalSubmitted(true);
              backgroundApiProxy.dispatch(
                addTransaction({
                  accountId: account.id,
                  networkId: network.id,
                  transaction: {
                    from: account.address,
                    accountId: account.id,
                    networkId: network.id,
                    type: 'approve',
                    archive: true,
                    hash: tx.txid,
                    addedTime: Date.now(),
                    status: 'pending',
                    approval: {
                      token: inputAmount.token,
                      tokenAddress: inputAmount.token.tokenIdOnNetwork,
                      spender: allowanceTarget,
                    },
                  },
                }),
              );
            },
          },
        },
      });
    }
  }, [account, network, inputAmount, quote, navigation]);

  const onSubmit = useCallback(async () => {
    if (
      !params ||
      !account ||
      !network ||
      !quote ||
      !inputAmount ||
      !outputAmount
    ) {
      return;
    }
    const swapInfo = convertToSwapInfo({
      quoteParams: params,
      inputAmount,
      outputAmount,
      swapQuote: quote,
      account,
    });
    const res = await SwapQuoter.client.buildTransaction(quote.type, {
      ...params,
      activeAccount: account,
      activeNetwok: network,
      receivingAddress,
      txData: quote.txData,
      txAttachment: quote.txAttachment,
    });
    if (res?.data) {
      const encodedTx: IEncodedTxEvm = {
        ...res?.data,
        from: account.address,
      };
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
              if (
                inputAmount &&
                inputTokenNetwork &&
                outputAmount &&
                outputTokenNetwork
              ) {
                backgroundApiProxy.dispatch(
                  addTransaction({
                    accountId: account.id,
                    networkId: network.id,
                    transaction: {
                      hash: tx.txid,
                      from: account.address,
                      addedTime: Date.now(),
                      status: 'pending',
                      type: 'swap',
                      accountId: account.id,
                      networkId: network.id,
                      quoterType: quote.type,
                      nonce: data?.decodedTx?.nonce,
                      attachment: res.attachment,
                      receivingAddress,
                      providers: quote.providers,
                      arrivalTime: quote.arrivalTime,
                      tokens: {
                        rate: Number(quote.instantRate),
                        from: {
                          networkId: inputTokenNetwork.id,
                          token: inputAmount.token,
                          amount: inputAmount.typedValue,
                        },
                        to: {
                          networkId: outputTokenNetwork.id,
                          token: outputAmount.token,
                          amount: outputAmount.typedValue,
                        },
                      },
                    },
                  }),
                );
                backgroundApiProxy.serviceSwap.setApprovalSubmitted(false);
                backgroundApiProxy.serviceSwap.clearState();
                backgroundApiProxy.serviceToken.addAccountToken(
                  network.id,
                  account.id,
                  inputAmount.token.tokenIdOnNetwork,
                );
                backgroundApiProxy.serviceToken.addAccountToken(
                  network.id,
                  account.id,
                  outputAmount.token.tokenIdOnNetwork,
                );
              }
            },
          },
        },
      });
    } else {
      const msg =
        res?.error?.msg ?? intl.formatMessage({ id: 'msg__unknown_error' });
      toast.show({ title: msg });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    params,
    account,
    network,
    inputAmount,
    outputAmount,
    quote,
    addTransaction,
    receivingAddress,
  ]);

  const onCreateWallet = useCallback(() => {
    navigation.navigate(RootRoutes.Onboarding);
  }, [navigation]);

  const onCreateAccount = useCallback(() => {
    if (!wallet) {
      return;
    }
    if (wallet.type === 'imported') {
      return navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.CreateWallet,
        params: {
          screen: CreateWalletModalRoutes.AddExistingWalletModal,
          params: { mode: 'imported' },
        },
      });
    }
    if (wallet.type === 'watching') {
      return navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.CreateWallet,
        params: {
          screen: CreateWalletModalRoutes.AddExistingWalletModal,
          params: { mode: 'watching' },
        },
      });
    }

    return navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.CreateAccount,
      params: {
        screen: CreateAccountModalRoutes.CreateAccountForm,
        params: {
          walletId: wallet.id,
        },
      },
    });
  }, [wallet, navigation]);

  if (!wallet) {
    return (
      <Button size="xl" type="primary" onPress={onCreateWallet} key="addWallet">
        {intl.formatMessage({ id: 'action__create_wallet' })}
      </Button>
    );
  }

  if (!account) {
    return (
      <Button
        size="xl"
        type="primary"
        onPress={onCreateAccount}
        key="addAccount"
      >
        {intl.formatMessage({ id: 'action__create_account' })}
      </Button>
    );
  }

  if (!isSwapEnabled) {
    return (
      <Button size="xl" type="primary" isDisabled key="isSwapEnabled">
        {intl.formatMessage({ id: 'title__swap' })}
      </Button>
    );
  }

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
      <Button size="xl" type="primary" isDisabled key="base_error">
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
  if (showApproveFlow) {
    return (
      <Box flexDirection="row">
        <Button
          size="xl"
          type="primary"
          flex="1"
          isLoading={
            approveState === ApprovalState.PENDING || approvalSubmitted
          }
          isDisabled={approveState !== ApprovalState.NOT_APPROVED}
          onPress={onApprove}
        >
          {approveButtonText}
        </Button>
        <Button
          size="xl"
          ml="4"
          flex="1"
          type="primary"
          onPromise={onSubmit}
          isDisabled
        >
          {intl.formatMessage({ id: 'title__swap' })}
        </Button>
      </Box>
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
  return (
    <Button
      key="submit"
      size="xl"
      type="primary"
      isDisabled={!quote}
      onPromise={onSubmit}
    >
      {intl.formatMessage({ id: 'title__swap' })}
    </Button>
  );
};

export default SwapButton;
