import React, { useCallback, useEffect } from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  Box,
  Button,
  Center,
  Divider,
  IconButton,
  Typography,
} from '@onekeyhq/components';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useManageTokens, useNavigation } from '../../hooks';
import { useActiveWalletAccount } from '../../hooks/redux';
import { setQuote } from '../../store/reducers/swap';
import { SendRoutes } from '../Send/types';

import TokenInput from './components/TokenInput';
import ExchangeRate from './ExchangeRate';
import {
  useSwap,
  useSwapActionHandlers,
  useSwapEnabled,
  useSwapQuoteCallback,
  useSwapState,
} from './hooks/useSwap';
import { useTransactionAdder } from './hooks/useTransactions';
import { ApprovalState, SwapError, SwapRoutes } from './typings';

const SwapContent = () => {
  const intl = useIntl();
  const { inputToken, outputToken, typedValue, independentField } =
    useSwapState();
  const isSwapEnabled = useSwapEnabled();
  const onSwapQuoteCallback = useSwapQuoteCallback({ silent: false });
  const addTransaction = useTransactionAdder();
  const { nativeToken } = useManageTokens();
  const { onUserInput, onSwitchTokens, onSelectToken } =
    useSwapActionHandlers();
  const { account, network } = useActiveWalletAccount();
  const {
    swapQuote,
    formattedAmounts,
    isSwapLoading,
    error,
    approveState,
    inputAmount,
    outputAmount,
  } = useSwap();
  const navigation = useNavigation();
  const onSelectInput = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Swap,
      params: {
        screen: SwapRoutes.Input,
      },
    });
  }, [navigation]);
  const onSelectOutput = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Swap,
      params: {
        screen: SwapRoutes.Output,
      },
    });
  }, [navigation]);
  const onChangeInput = useCallback(
    (value: string) => {
      onUserInput('INPUT', value);
    },
    [onUserInput],
  );
  const onChangeOutput = useCallback(
    (value: string) => {
      onUserInput('OUTPUT', value);
    },
    [onUserInput],
  );

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
            encodedTx: { ...encodedTx, from: account?.address },
            sourceInfo: {
              id: '0',
              origin: 'Swap Token Approve',
              scope: 'ethereum',
              data: { method: '' },
            },
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

  useEffect(() => {
    backgroundApiProxy.dispatch(setQuote(undefined));
  }, [
    inputToken?.tokenIdOnNetwork,
    outputToken?.tokenIdOnNetwork,
    typedValue,
    independentField,
  ]);

  useEffect(() => {
    onSwapQuoteCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSwapQuoteCallback]);

  let buttonTitle = intl.formatMessage({ id: 'title__swap' });
  if (error === SwapError.InsufficientBalance) {
    buttonTitle = intl.formatMessage(
      { id: 'form__amount_invalid' },
      { '0': inputToken?.symbol },
    );
  } else if (error === SwapError.QuoteFailed) {
    buttonTitle = intl.formatMessage({ id: 'transaction__failed' });
  }

  useEffect(() => {
    // select native token, when switch chain that is supported
    setTimeout(() => {
      if (isSwapEnabled && nativeToken) {
        onSelectToken(nativeToken, 'INPUT');
      }
    }, 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network]);

  return (
    <Center px="4">
      <Box
        bg="surface-default"
        shadow="depth.2"
        maxW="420"
        w="full"
        borderRadius={12}
        px="4"
        py="6"
      >
        <Box
          borderWidth="0.5"
          borderColor="border-default"
          bg="surface-subdued"
          borderRadius={12}
          position="relative"
        >
          <TokenInput
            type="INPUT"
            label={intl.formatMessage({ id: 'content__from' })}
            token={inputToken}
            inputValue={formattedAmounts.INPUT}
            onChange={onChangeInput}
            onPress={onSelectInput}
            containerProps={{ pt: '4', pb: '2' }}
            showMax
          />
          <Box w="full" h="10" position="relative">
            <Box position="absolute" w="full" h="full">
              <Center w="full" h="full">
                <Divider />
              </Center>
            </Box>
            <Center>
              <IconButton
                w="10"
                h="10"
                name="SwitchVerticalSolid"
                borderRadius="full"
                borderColor="border-disabled"
                borderWidth="0.5"
                bg="surface-default"
                onPress={onSwitchTokens}
              />
            </Center>
          </Box>
          <TokenInput
            type="OUTPUT"
            label={intl.formatMessage({ id: 'content__to' })}
            token={outputToken}
            inputValue={formattedAmounts.OUTPUT}
            onChange={onChangeOutput}
            onPress={onSelectOutput}
            containerProps={{ pb: '4', pt: '2' }}
          />
          {!isSwapEnabled ? (
            <Box w="full" h="full" position="absolute" />
          ) : null}
        </Box>
        <Box
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          mt="2"
          mb="4"
        >
          <Typography.Body2 color="text-subdued">
            {intl.formatMessage({ id: 'Rate' })}
          </Typography.Body2>
          <Typography.Body2 color="text-default">
            <ExchangeRate
              tokenA={inputToken}
              tokenB={outputToken}
              quote={swapQuote}
            />
          </Typography.Body2>
        </Box>
        {!isSwapEnabled ? (
          <Box mb="6">
            <Alert
              title={intl.formatMessage({ id: 'msg__wrong_network' })}
              description={intl.formatMessage({
                id: 'msg__wrong_network_desc',
              })}
              alertType="error"
              dismiss={false}
            />
          </Box>
        ) : null}
        {!error &&
        (approveState === ApprovalState.NOT_APPROVED ||
          approveState === ApprovalState.PENDING) ? (
          <Button
            size="lg"
            type="primary"
            isDisabled={!!error || !isSwapEnabled || !swapQuote}
            isLoading={approveState === ApprovalState.PENDING}
            onPress={onApprove}
          >
            {intl.formatMessage({ id: 'title__approve' })}
          </Button>
        ) : (
          <Button
            size="lg"
            type="primary"
            isDisabled={!!error || !isSwapEnabled || !swapQuote}
            isLoading={isSwapLoading}
            onPress={onSubmit}
          >
            {buttonTitle}
          </Button>
        )}
      </Box>
    </Center>
  );
};

export default SwapContent;
