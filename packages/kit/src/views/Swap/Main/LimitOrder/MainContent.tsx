import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Box, Center, IconButton } from '@onekeyhq/components';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/routesEnum';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useNavigation } from '../../../../hooks';
import {
  useActiveWalletAccount,
  useAppSelector,
} from '../../../../hooks/redux';
import LimitOrderReceivingTokenInput from '../../components/LimitOrderReceivingTokenInput';
import LimitOrderTokenInput from '../../components/LimitOrderTokenInput';
import { useLimitOrderOutput } from '../../hooks/useLimitOrder';
import { SwapRoutes } from '../../typings';
import { formatAmount } from '../../utils';

export const MainContent = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { wallet, network } = useActiveWalletAccount();
  const swapMaintain = useAppSelector((s) => s.swapTransactions.swapMaintain);
  const isDisabled = !wallet || !network || swapMaintain;
  const typedValue = useAppSelector((s) => s.limitOrder.typedValue);
  const tokenOutValue = useLimitOrderOutput();
  const onSelectInput = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Swap,
      params: {
        screen: SwapRoutes.LimitOrderInput,
      },
    });
  }, [navigation]);
  const onSelectOutput = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Swap,
      params: {
        screen: SwapRoutes.LimitOrderOutput,
      },
    });
  }, [navigation]);
  const onChangeInput = useCallback((value: string) => {
    backgroundApiProxy.serviceLimitOrder.userInputValue(value);
  }, []);
  const onSwitchTokens = useCallback(() => {
    backgroundApiProxy.serviceLimitOrder.switchTokens();
  }, []);

  const containerProps = useMemo(
    () => ({
      upper: { pb: '0' },
      lower: { pt: '0' },
    }),
    [],
  );

  let outputValue = formatAmount(tokenOutValue, 8);
  if (Number(outputValue) === 0) {
    outputValue = formatAmount(tokenOutValue, 16);
  }

  return (
    <Box w="full">
      <Box position="relative">
        <Box px={4} py="5" bg="surface-subdued" overflow="hidden">
          <LimitOrderTokenInput
            type="INPUT"
            label={intl.formatMessage({ id: 'form__pay' })}
            inputValue={typedValue}
            onChange={onChangeInput}
            onPress={onSelectInput}
            containerProps={containerProps.upper}
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
        <Box px={4} py="5" bg="surface-subdued" overflow="hidden">
          <LimitOrderReceivingTokenInput
            type="OUTPUT"
            label={intl.formatMessage({ id: 'action__receive' })}
            inputValue={outputValue}
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
