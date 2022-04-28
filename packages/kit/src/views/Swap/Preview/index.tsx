import React, { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  Box,
  Divider,
  Icon,
  Modal,
  Token,
  Typography,
  VStack,
} from '@onekeyhq/components';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';

import { useInterval, useNavigation } from '../../../hooks';
import { useActiveWalletAccount, useSettings } from '../../../hooks/redux';
import { SendRoutes } from '../../Send/types';
import ExchangeRate from '../ExchangeRate';
import {
  useSwap,
  useSwapActionHandlers,
  useSwapQuoteCallback,
  useSwapState,
} from '../hooks/useSwap';
import { useTransactionAdder } from '../hooks/useTransactions';

const Preview = () => {
  const intl = useIntl();
  const navigation = useNavigation();

  const addTransaction = useTransactionAdder();
  const onSwapQuote = useSwapQuoteCallback();
  const { swapSlippagePercent } = useSettings();
  const { account } = useActiveWalletAccount();
  const { onReset } = useSwapActionHandlers();
  const { inputToken, outputToken, quoteTime } = useSwapState();
  const { inputAmount, outputAmount, swapQuote } = useSwap();
  const onSubmit = useCallback(() => {
    if (account && inputAmount && outputAmount) {
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Send,
        params: {
          screen: SendRoutes.SendConfirm,
          params: {
            encodedTx: { ...swapQuote, from: account.address },
            payload: swapQuote,
            sourceInfo: {
              id: '0',
              origin: 'OneKey Swap',
              scope: 'ethereum',
              data: { method: '' },
            },
            // payload: swapQuote,
            onSuccess: (tx) => {
              addTransaction({
                hash: tx.txid,
                summary: `${inputAmount.value.toFixed(
                  2,
                )} ${inputAmount?.token.symbol.toUpperCase()} → ${outputAmount.value.toFixed(
                  2,
                )} ${outputAmount.token.symbol.toUpperCase()}`,
              });
              setTimeout(onReset, 500);
              navigation.goBack();
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
    onReset,
  ]);
  const [remainTime, setRemainTime] = useState<number>(() => {
    if (quoteTime) {
      const now = Date.now();
      const seconds = Math.max(
        Math.floor((+quoteTime + 15000 - now) / 1000),
        0,
      );
      return seconds;
    }
    return 15;
  });
  const onInterval = useCallback(() => {
    if (quoteTime) {
      const now = Date.now();
      const seconds = Math.max(Math.ceil((+quoteTime + 15000 - now) / 1000), 0);
      setRemainTime(seconds);
    }
  }, [quoteTime]);
  useInterval(onInterval, 1000);
  const minimumReceived = useMemo(() => {
    if (inputAmount && swapQuote) {
      return inputAmount.value.multipliedBy(swapQuote.guaranteedPrice);
    }
  }, [inputAmount, swapQuote]);
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
              {inputAmount?.value.toFixed(4)}
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
              {outputAmount?.value.toFixed(4)}
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
          <Alert
            alertType="info"
            title={intl.formatMessage(
              { id: 'content__price_updates_after_str' },
              {
                '0': (
                  <Typography.Body2 color="interactive-default">{`${remainTime}s`}</Typography.Body2>
                ),
              },
            )}
            action={intl.formatMessage({ id: 'action__refresh' })}
            actionType="right"
            onAction={onSwapQuote}
            dismiss={false}
          />
        </Box>
        <VStack space="1" mt="1">
          <Box
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            h="7"
          >
            <Typography.Body2 color="text-subdued">
              {intl.formatMessage({ id: 'form__rate' })}
            </Typography.Body2>
            <ExchangeRate
              tokenA={inputToken}
              tokenB={outputToken}
              quote={swapQuote}
            />
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
