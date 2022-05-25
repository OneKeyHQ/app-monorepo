import React, { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useNavigation } from '../../hooks';
import { useActiveWalletAccount } from '../../hooks/redux';
import {
  CreateAccountModalRoutes,
  CreateWalletModalRoutes,
} from '../../routes';
import { ModalRoutes, RootRoutes } from '../../routes/types';
import { SendRoutes } from '../Send/types';

import {
  useSwap,
  useSwapEnabled,
  useSwapQuoteCallback,
  useSwapState,
} from './hooks/useSwap';
import { useTransactionAdder } from './hooks/useTransactions';
import { ApprovalState, SwapError } from './typings';

const RetryQuoteButton = () => {
  const intl = useIntl();
  const onQuote = useSwapQuoteCallback({ silent: false });
  return (
    <Button size="xl" type="primary" key="network_error" onPress={onQuote}>
      {intl.formatMessage({ id: 'action__retry' })}
    </Button>
  );
};

const SwapButton = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const isSwapEnabled = useSwapEnabled();
  const { inputToken } = useSwapState();
  const { account, network, wallet } = useActiveWalletAccount();
  const addTransaction = useTransactionAdder();
  const {
    swapQuote,
    isSwapLoading,
    error,
    approveState,
    inputAmount,
    outputAmount,
  } = useSwap();

  const onApprove = useCallback(async () => {
    if (account && network && swapQuote && inputAmount) {
      const encodedTx: { data: string } =
        await backgroundApiProxy.engine.buildEncodedTxFromApprove({
          spender: swapQuote?.allowanceTarget,
          networkId: network.id,
          accountId: account.id,
          token: inputAmount.token.tokenIdOnNetwork,
          amount: 'unlimited',
        });
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Send,
        params: {
          screen: SendRoutes.SendConfirm,
          params: {
            feeInfoEditable: true,
            feeInfoUseFeeInTx: false,
            encodedTx: { ...encodedTx, from: account?.address },
            onSuccess(tx) {
              addTransaction({
                hash: tx.txid,
                approval: {
                  tokenAddress: inputAmount.token.tokenIdOnNetwork,
                  spender: swapQuote.allowanceTarget,
                },
                summary: `${intl.formatMessage({
                  id: 'title__approve',
                })} ${inputAmount.token.symbol.toUpperCase()}`,
              });
            },
          },
        },
      });
    }
  }, [
    account,
    network,
    inputAmount,
    swapQuote,
    navigation,
    addTransaction,
    intl,
  ]);

  const onSubmit = useCallback(() => {
    if (swapQuote && account && inputAmount && outputAmount) {
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Send,
        params: {
          screen: SendRoutes.SwapPreview,
        },
      });
    }
  }, [swapQuote, navigation, account, inputAmount, outputAmount]);

  const onCreateWallet = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.CreateWallet,
      params: {
        screen: CreateWalletModalRoutes.GuideModal,
      },
    });
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
          params: { mode: 'privatekey' },
        },
      });
    }
    if (wallet.type === 'watching') {
      return navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.CreateWallet,
        params: {
          screen: CreateWalletModalRoutes.AddExistingWalletModal,
          params: { mode: 'address' },
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
    return <RetryQuoteButton />;
  }
  if (
    approveState === ApprovalState.NOT_APPROVED ||
    approveState === ApprovalState.PENDING
  ) {
    return (
      <Button
        size="xl"
        type="primary"
        isLoading={approveState === ApprovalState.PENDING}
        onPress={onApprove}
        key="approve"
      >
        {intl.formatMessage({ id: 'title__approve' })}
      </Button>
    );
  }
  return (
    <Button
      size="xl"
      type="primary"
      isDisabled={!swapQuote}
      isLoading={isSwapLoading}
      onPress={onSubmit}
    >
      {intl.formatMessage({ id: 'title__swap' })}
    </Button>
  );
};

export default SwapButton;
