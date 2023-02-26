import { useCallback, useEffect } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  IconButton,
  useIsVerticalLayout,
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
  const isSmall = useIsVerticalLayout();
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
    <Box w="full">
      <Box position="relative">
        <Box
          px={4}
          py="5"
          bg="surface-subdued"
          overflow="hidden"
          borderRadius={isSmall ? undefined : '12'}
        >
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
        </Box>
        <Box
          w="full"
          position="relative"
          h="1"
          bg="background-default"
          zIndex={1}
        >
          <Box position="absolute" w="full" h="10" top={-20} left={0}>
            <Center>
              <Center
                w="10"
                h="10"
                bg="background-default"
                borderRadius="full"
                overflow="hidden"
              >
                <IconButton
                  w={35}
                  h={35}
                  borderColor="background-default"
                  isDisabled={loading}
                  name="ArrowDownOutline"
                  borderRadius="full"
                  _disabled={{ borderColor: 'background-default' }}
                  onPress={onSwitchTokens}
                  size="lg"
                  bgColor="surface-neutral-subdued"
                />
              </Center>
            </Center>
          </Box>
        </Box>
        <Box
          px={4}
          py="5"
          bg="action-secondary-default"
          overflow="hidden"
          borderRadius={isSmall ? undefined : '12'}
        >
          <ReceivingTokenInput
            type="OUTPUT"
            label={intl.formatMessage({ id: 'action__receive' })}
            token={outputToken}
            tokenNetwork={outputTokenNetwork}
            inputValue={formattedAmounts.OUTPUT}
            onChange={onChangeOutput}
            onPress={onSelectOutput}
            containerProps={{ pt: '0' }}
          />
        </Box>
        {isDisabled ? (
          <Box w="full" h="full" position="absolute" zIndex={1} />
        ) : null}
      </Box>
    </Box>
  );
};

export default SwapContent;
