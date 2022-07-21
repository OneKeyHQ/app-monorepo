import React, { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Box, Button } from '@onekeyhq/components';
import { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';

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
  useInputLimitsError,
  useSwap,
  useSwapEnabled,
  useSwapQuoteCallback,
  useSwapState,
} from './hooks/useSwap';
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
  const { inputToken, approvalSubmitted } = useSwapState();
  const limitsError = useInputLimitsError();
  const { account, network, wallet } = useActiveWalletAccount();
  const { swapQuote, isSwapLoading, error, approveState, inputAmount } =
    useSwap();

  const showApproveFlow =
    approveState === ApprovalState.NOT_APPROVED ||
    approveState === ApprovalState.PENDING ||
    (approvalSubmitted && approveState === ApprovalState.APPROVED);

  let approveButtonText = intl.formatMessage({ id: 'title__approve' });
  if (approveState === ApprovalState.PENDING) {
    approveButtonText = intl.formatMessage({ id: 'title__approving' });
  } else if (approvalSubmitted && approveState === ApprovalState.APPROVED) {
    approveButtonText = intl.formatMessage({ id: 'title__approved' });
  }

  const onApprove = useCallback(async () => {
    if (
      account &&
      network &&
      swapQuote &&
      inputAmount &&
      swapQuote.allowanceTarget
    ) {
      const encodedTx =
        (await backgroundApiProxy.engine.buildEncodedTxFromApprove({
          spender: swapQuote?.allowanceTarget,
          networkId: network.id,
          accountId: account.id,
          token: inputAmount.token.tokenIdOnNetwork,
          amount: 'unlimited',
        })) as IEncodedTxEvm;
      const { allowanceTarget } = swapQuote;
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
  }, [account, network, inputAmount, swapQuote, navigation]);

  const onSubmit = useCallback(() => {
    if (swapQuote && account) {
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Send,
        params: {
          screen: SendRoutes.SwapPreview,
        },
      });
    }
  }, [swapQuote, navigation, account]);

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
          isLoading={approveState === ApprovalState.PENDING}
          isDisabled={
            approveState !== ApprovalState.NOT_APPROVED || approvalSubmitted
          }
          onPress={onApprove}
        >
          {approveButtonText}
        </Button>
        <Button
          size="xl"
          ml="4"
          flex="1"
          type="primary"
          onPress={onSubmit}
          isDisabled={approveState !== ApprovalState.APPROVED}
        >
          {intl.formatMessage({ id: 'title__swap' })}
        </Button>
      </Box>
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
