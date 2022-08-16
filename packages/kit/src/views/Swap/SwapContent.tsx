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
import { useActiveWalletAccount } from '../../hooks/redux';
import { setQuote } from '../../store/reducers/swap';

import TokenInput from './components/TokenInput';
import {
  useDerivedSwapState,
  useSwapEnabled,
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
    inputTokenNetwork,
    outputToken,
    outputTokenNetwork,
    typedValue,
    independentField,
    loading,
  } = useSwapState();
  const isSwapEnabled = useSwapEnabled();
  const onSwapQuoteCallback = useSwapQuoteCallback({ showLoading: true });
  const { account, wallet, network } = useActiveWalletAccount();
  const { formattedAmounts } = useDerivedSwapState();

  const isDisabled = !isSwapEnabled || !wallet || !account;

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

  const disableSwitchTokens =
    (outputTokenNetwork && outputTokenNetwork.id !== network?.id) ||
    (inputTokenNetwork && inputTokenNetwork.id !== network?.id);

  return (
    <Box
      bg="surface-default"
      w="full"
      borderRadius="xl"
      py={5}
      px={4}
      borderWidth={themeVariant === 'light' ? 1 : undefined}
      borderColor="border-subdued"
    >
      <Box position="relative">
        <TokenInput
          type="INPUT"
          label={intl.formatMessage({ id: 'form__pay' })}
          token={inputToken}
          tokenNetwork={inputTokenNetwork}
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
              name="SwitchVerticalOutline"
              borderRadius="full"
              borderColor="border-disabled"
              borderWidth="0.5"
              disabled={disableSwitchTokens}
              bg="surface-default"
              onPress={onSwitchTokens}
              size="lg"
              bgColor="surface-neutral-subdued"
            />
          </Center>
        </Box>
        <TokenInput
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
