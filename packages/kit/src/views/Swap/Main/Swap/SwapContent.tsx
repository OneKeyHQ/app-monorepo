import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  IconButton,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/routesEnum';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useNavigation } from '../../../../hooks';
import {
  useActiveWalletAccount,
  useAppSelector,
} from '../../../../hooks/redux';
import PercentInput from '../../components/PercentInput';
import ReceivingTokenInput from '../../components/ReceivingTokenInput';
import TokenInput from '../../components/TokenInput';
import { useDerivedSwapState } from '../../hooks/useSwap';
import { useTokenBalance } from '../../hooks/useSwapTokenUtils';
import { SwapRoutes } from '../../typings';
import { div, formatAmount, multiply } from '../../utils';

export const SwapContent = () => {
  const intl = useIntl();
  const isSmall = useIsVerticalLayout();
  const navigation = useNavigation();
  const independentField = useAppSelector((s) => s.swap.independentField);
  const loading = useAppSelector((s) => s.swap.loading);
  const { wallet, network } = useActiveWalletAccount();
  const swapMaintain = useAppSelector((s) => s.swapTransactions.swapMaintain);
  const { formattedAmounts } = useDerivedSwapState();
  const inputToken = useAppSelector((s) => s.swap.inputToken);
  const sendingAccount = useAppSelector((s) => s.swap.sendingAccount);
  const [value, setValue] = useState(0);
  const isDisabled = !wallet || !network || swapMaintain;

  const inputBalance = useTokenBalance(inputToken, sendingAccount?.id);

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
  const onChangeInput = useCallback((v: string) => {
    backgroundApiProxy.serviceSwap.userInput('INPUT', v);
  }, []);
  const onChangeOutput = useCallback((v: string) => {
    backgroundApiProxy.serviceSwap.userInput('OUTPUT', v);
  }, []);
  const onSwitchTokens = useCallback(() => {
    backgroundApiProxy.serviceSwap.switchTokens();
  }, []);

  const containerProps = useMemo(
    () => ({
      upper: { pb: '0' },
      lower: { pt: '0' },
    }),
    [],
  );
  const onChange = useCallback(
    (v: number) => {
      setValue(v);
      if (inputBalance) {
        const inputValue = formatAmount(div(multiply(inputBalance, v), 100));
        backgroundApiProxy.serviceSwap.userInput('INPUT', inputValue);
      }
    },
    [inputBalance],
  );

  return (
    <Box w="full">
      <Box
        position="relative"
        borderRadius={isSmall ? undefined : '12'}
        overflow="hidden"
      >
        <Box px={4} py="5" bg="surface-subdued" overflow="hidden">
          <TokenInput
            type="INPUT"
            label={intl.formatMessage({ id: 'form__pay' })}
            inputValue={formattedAmounts.INPUT}
            onChange={onChangeInput}
            onPress={onSelectInput}
            containerProps={containerProps.upper}
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
            <Box position="absolute" top="0" left="5">
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
            </Box>
            <Box position="absolute" top="0" right="5">
              <Center h="10" w="48">
                <Box style={{ transform: [{ translateY: 2 }] }} w="full">
                  <PercentInput value={value} onChange={onChange} />
                </Box>
              </Center>
            </Box>
          </Box>
        </Box>
        <Box px={4} py="5" bg="action-secondary-default" overflow="hidden">
          <ReceivingTokenInput
            type="OUTPUT"
            label={intl.formatMessage({ id: 'action__receive' })}
            inputValue={formattedAmounts.OUTPUT}
            onChange={onChangeOutput}
            onPress={onSelectOutput}
            containerProps={containerProps.lower}
          />
        </Box>
        {isDisabled ? (
          <Box w="full" h="full" position="absolute" zIndex={1} />
        ) : null}
      </Box>
    </Box>
  );
};
