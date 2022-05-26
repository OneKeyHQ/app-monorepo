import React, { useCallback, useEffect } from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  Box,
  Center,
  Divider,
  IconButton,
  Typography,
} from '@onekeyhq/components';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useNavigation } from '../../hooks';
import { useActiveWalletAccount } from '../../hooks/redux';
import { setQuote } from '../../store/reducers/swap';

import TokenInput from './components/TokenInput';
import ExchangeRate from './ExchangeRate';
import {
  useSwap,
  useSwapActionHandlers,
  useSwapEnabled,
  useSwapQuoteCallback,
  useSwapState,
} from './hooks/useSwap';
import SwapButton from './SwapButton';
import { SwapError, SwapRoutes } from './typings';

const SwapContent = () => {
  const intl = useIntl();
  const { inputToken, outputToken, typedValue, independentField, error } =
    useSwapState();
  const isSwapEnabled = useSwapEnabled();
  const onSwapQuoteCallback = useSwapQuoteCallback({ silent: false });
  const { onUserInput, onSwitchTokens } = useSwapActionHandlers();
  const { account, wallet } = useActiveWalletAccount();

  const isDisabled = !isSwapEnabled || !wallet || !account;

  const { swapQuote, formattedAmounts, isSwapLoading } = useSwap();
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

  return (
    <Center px="4">
      <Box
        bg="surface-default"
        shadow="depth.2"
        maxW="420"
        w="full"
        borderRadius="3xl"
        p={4}
      >
        <Box
          borderWidth={{ base: '0.5', md: '1' }}
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
            containerProps={{ pt: '4', pb: '0' }}
            isDisabled={isSwapLoading && independentField === 'OUTPUT'}
            showMax={!!(inputToken && inputToken.tokenIdOnNetwork)}
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
                name="SwitchVerticalOutline"
                borderRadius="full"
                borderColor="border-disabled"
                borderWidth="0.5"
                bg="surface-default"
                onPress={onSwitchTokens}
                size="lg"
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
            containerProps={{ pb: '4', pt: '0' }}
            isDisabled={isSwapLoading && independentField === 'INPUT'}
          />
          {isDisabled ? <Box w="full" h="full" position="absolute" /> : null}
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
          <Box flex="1" flexDirection="row" justifyContent="flex-end">
            <ExchangeRate
              tokenA={inputToken}
              tokenB={outputToken}
              quote={swapQuote}
              independentField={independentField}
            />
          </Box>
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
        {error === SwapError.QuoteFailed ? (
          <Box mb="6">
            <Alert
              title={intl.formatMessage({ id: 'msg__failed_to_get_price' })}
              alertType="warn"
              dismiss={false}
            />
          </Box>
        ) : null}
        <SwapButton />
      </Box>
    </Center>
  );
};

export default SwapContent;
