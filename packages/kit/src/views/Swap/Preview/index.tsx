import React, { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Divider,
  Icon,
  Modal,
  Token,
  Typography,
  VStack,
} from '@onekeyhq/components';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';

import { useNavigation } from '../../../hooks';
import { useActiveWalletAccount, useSettings } from '../../../hooks/redux';
import { SendRoutes } from '../../Send/types';
import ExchangeRate from '../ExchangeRate';
import { useSwap, useSwapState } from '../hooks/useSwap';
import { useTransactionAdder } from '../hooks/useTransactions';

import { Timer } from './Timer';

const Preview = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const addTransaction = useTransactionAdder();
  const { swapSlippagePercent } = useSettings();
  const { account } = useActiveWalletAccount();
  const { inputToken, outputToken, independentField } = useSwapState();
  const { inputAmount, outputAmount, swapQuote } = useSwap();
  const onSubmit = useCallback(() => {
    if (account && inputAmount && outputAmount) {
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Send,
        params: {
          screen: SendRoutes.SendConfirm,
          params: {
            feeInfoEditable: true,
            feeInfoUseFeeInTx: false,
            encodedTx: { ...swapQuote, from: account.address },
            payload: swapQuote,
            onSuccess: (tx) => {
              addTransaction({
                hash: tx.txid,
                summary: `${inputAmount.value.toFixed(
                  2,
                )} ${inputAmount?.token.symbol.toUpperCase()} → ${outputAmount.value.toFixed(
                  2,
                )} ${outputAmount.token.symbol.toUpperCase()}`,
              });
            },
          },
        },
      });
    }
  }, [
    account,
    addTransaction,
    navigation,
    inputAmount,
    outputAmount,
    swapQuote,
  ]);
  const minimumReceived = useMemo(() => {
    if (inputAmount && swapQuote) {
      return inputAmount.value.multipliedBy(
        independentField === 'INPUT'
          ? swapQuote.guaranteedPrice
          : 1 / Number(swapQuote.guaranteedPrice),
      );
    }
  }, [inputAmount, swapQuote, independentField]);
  return (
    <Modal
      header={intl.formatMessage({ id: 'modal__preview' })}
      hideSecondaryAction
      onPrimaryActionPress={onSubmit}
      primaryActionTranslationId="title__swap"
    >
      <Box>
        <Box
          borderColor="border-subdued"
          borderWidth="0.5"
          borderRadius="12"
          background="surface-neutral-subdued"
          p="4"
        >
          <Box
            flexDirection="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <Typography.DisplayMedium>
              {independentField === 'INPUT'
                ? inputAmount?.value.toFixed()
                : inputAmount?.value.toFixed(4)}
            </Typography.DisplayMedium>
            <Box flexDirection="row" alignItems="center">
              <Token size="6" src={inputToken?.logoURI} />
              <Typography.Body1 ml="3">
                {inputToken?.symbol.toString()}
              </Typography.Body1>
            </Box>
          </Box>
          <Box
            h="5"
            w="full"
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Box mr="4">
              <Icon name="ArrowDownSolid" size={16} />
            </Box>
            <Divider flex="1" />
          </Box>
          <Box
            flexDirection="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <Typography.DisplayMedium>
              {independentField === 'OUTPUT'
                ? outputAmount?.value.toFixed()
                : outputAmount?.value.toFixed(4)}
            </Typography.DisplayMedium>
            <Box flexDirection="row" alignItems="center">
              <Token size="6" src={outputToken?.logoURI} />
              <Typography.Body1 ml="3">
                {outputToken?.symbol.toUpperCase()}
              </Typography.Body1>
            </Box>
          </Box>
        </Box>
        <Box my="4">
          <Timer />
        </Box>
        <VStack space="1" mt="1">
          <Box
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            minH="7"
          >
            <Typography.Body2 color="text-subdued">
              {intl.formatMessage({ id: 'form__rate' })}
            </Typography.Body2>
            <Box flex="1" flexDirection="row" justifyContent="flex-end">
              <ExchangeRate
                tokenA={inputToken}
                tokenB={outputToken}
                quote={swapQuote}
                independentField={independentField}
              />
            </Box>
          </Box>
          <Box
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            h="9"
          >
            <Typography.Body2 color="text-subdued">
              {intl.formatMessage({ id: 'form__slippage_tolerance' })}
            </Typography.Body2>
            <Typography.Body2>{swapSlippagePercent}%</Typography.Body2>
          </Box>
          <Box
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            h="9"
          >
            <Typography.Body2 color="text-subdued">
              {intl.formatMessage({ id: 'form__minimum_received' })}
            </Typography.Body2>
            <Typography.Body2>
              {minimumReceived
                ? `${minimumReceived?.toFixed(4)} ${
                    outputToken ? outputToken.symbol.toUpperCase() : ''
                  }`
                : '---'}
            </Typography.Body2>
          </Box>
          <Box
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            h="9"
          >
            <Typography.Body2 color="text-subdued">
              {intl.formatMessage({ id: 'form__handling_fee' })}
            </Typography.Body2>
            <Typography.Body2>1%</Typography.Body2>
          </Box>
        </VStack>
      </Box>
    </Modal>
  );
};

export default Preview;
