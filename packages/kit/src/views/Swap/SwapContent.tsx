import React, { useCallback, useEffect } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Divider,
  IconButton,
  useTheme,
} from '@onekeyhq/components';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useNavigation } from '../../hooks';
import { useActiveWalletAccount, useAppSelector } from '../../hooks/redux';

import ReceivingTokenInput from './components/ReceivingTokenInput';
import TokenInput from './components/TokenInput';
import {
  useDerivedSwapState,
  useSwapQuoteCallback,
  useSwapState,
} from './hooks/useSwap';
import { SwapRoutes } from './typings';

const SwapContent = () => {
  const intl = useIntl();
  const { themeVariant } = useTheme();
  const navigation = useNavigation();
  const {
    inputToken,
    outputToken,
    outputTokenNetwork,
    typedValue,
    independentField,
    loading,
    sendingAccount,
  } = useSwapState();
  const onSwapQuoteCallback = useSwapQuoteCallback({ showLoading: true });
  const { wallet, network } = useActiveWalletAccount();
  const swapMaintain = useAppSelector((s) => s.swapTransactions.swapMaintain);
  const { formattedAmounts } = useDerivedSwapState();
  const isDisabled = !wallet || !network || swapMaintain;

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
  const onChangeInput = useCallback((value: string) => {
    backgroundApiProxy.serviceSwap.userInput('INPUT', value);
  }, []);
  const onChangeOutput = useCallback((value: string) => {
    backgroundApiProxy.serviceSwap.userInput('OUTPUT', value);
  }, []);

  const onSwitchTokens = useCallback(() => {
    backgroundApiProxy.serviceSwap.switchTokens();
  }, []);

  useEffect(() => {
    backgroundApiProxy.serviceSwap.setQuote(undefined);
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
    <Box
      bg="surface-default"
      w="full"
      borderRadius="xl"
      py={4}
      px={2}
      borderWidth={themeVariant === 'light' ? 1 : undefined}
      borderColor="border-subdued"
    >
      <Box position="relative">
        <TokenInput
          type="INPUT"
          label={intl.formatMessage({ id: 'form__pay' })}
          token={inputToken}
          account={sendingAccount}
          inputValue={formattedAmounts.INPUT}
          onChange={onChangeInput}
          onPress={onSelectInput}
          containerProps={{ pb: '0' }}
          isDisabled={loading && independentField === 'OUTPUT'}
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
              isDisabled={loading}
              name="ArrowsUpDownOutline"
              borderRadius="full"
              borderColor="border-disabled"
              borderWidth="0.5"
              bg="surface-default"
              onPress={onSwitchTokens}
              size="lg"
              bgColor="surface-neutral-subdued"
            />
          </Center>
        </Box>
        <ReceivingTokenInput
          type="OUTPUT"
          label={intl.formatMessage({ id: 'action__receive' })}
          token={outputToken}
          tokenNetwork={outputTokenNetwork}
          inputValue={formattedAmounts.OUTPUT}
          onChange={onChangeOutput}
          onPress={onSelectOutput}
          containerProps={{ pt: '0' }}
          isDisabled={loading && independentField === 'INPUT'}
        />
        {isDisabled ? (
          <Box w="full" h="full" position="absolute" zIndex={1} />
        ) : null}
      </Box>
    </Box>
  );
};

export default SwapContent;
