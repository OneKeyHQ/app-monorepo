import { useCallback, useContext, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  IconButton,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { LazyDisplayView } from '../../../../components/LazyDisplayView';
import {
  useActiveWalletAccount,
  useAppSelector,
  useNavigation,
} from '../../../../hooks';
import { SharedMobileTabContext } from '../../../Market/SharedMobileTabContext';
import PercentInput from '../../components/PercentInput';
import ReceivingTokenInput from '../../components/ReceivingTokenInput';
import TokenInput from '../../components/TokenInput';
import { useDerivedSwapState } from '../../hooks/useSwap';
import { useTokenBalance } from '../../hooks/useSwapTokenUtils';
import { SwapRoutes } from '../../typings';
import { div, formatAmountExact, multiply } from '../../utils';

const PercentInputContainer = () => {
  const inputToken = useAppSelector((s) => s.swap.inputToken);
  const sendingAccount = useAppSelector((s) => s.swap.sendingAccount);
  const inputBalance = useTokenBalance(inputToken, sendingAccount?.id);
  const typedValue = useAppSelector((s) => s.swap.typedValue);

  const percent = useMemo(() => {
    if (inputBalance && typedValue) {
      const inputBalanceBN = new BigNumber(inputBalance);
      const valueBN = new BigNumber(typedValue);
      if (inputBalanceBN.gt(0) && valueBN.gt(0)) {
        const num = valueBN.div(inputBalanceBN).multipliedBy(100).toNumber();
        return Math.ceil(num);
      }
    }
    return 0;
  }, [inputBalance, typedValue]);

  const onChange = useCallback(
    (v: number) => {
      if (inputBalance) {
        let inputValue = div(multiply(inputBalance, v), 100);
        if (v < 100) {
          inputValue = formatAmountExact(inputValue);
        }
        backgroundApiProxy.serviceSwap.userInput('INPUT', inputValue);
      }
    },
    [inputBalance],
  );
  const enableSwapTabSwipe = useContext(SharedMobileTabContext);
  const onTouchStart = useCallback(() => {
    if (platformEnv.isNative) {
      enableSwapTabSwipe(false);
    }
  }, [enableSwapTabSwipe]);
  const onTouchEnd = useCallback(() => {
    if (platformEnv.isNative) {
      enableSwapTabSwipe(true);
    }
  }, [enableSwapTabSwipe]);
  return (
    <Center h="10" w="48">
      <Box style={{ transform: [{ translateY: 2 }] }} w="full">
        <PercentInput
          onTouchStart={onTouchStart}
          onChangeEnd={onTouchEnd}
          value={percent}
          onChange={onChange}
        />
      </Box>
    </Center>
  );
};

const SwapPercentInput = () =>
  platformEnv.isNative ? (
    <PercentInputContainer />
  ) : (
    <LazyDisplayView delay={100}>
      <PercentInputContainer />
    </LazyDisplayView>
  );

const SwitchTokensButton = () => {
  const [switching, setSwitching] = useState(false);
  const loading = useAppSelector((s) => s.swap.loading);
  const onSwitchTokens = useCallback(async () => {
    try {
      setSwitching(true);
      await backgroundApiProxy.serviceSwap.switchTokens();
    } finally {
      setSwitching(false);
    }
  }, []);

  return (
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
        isDisabled={loading || switching}
        name="ArrowDownOutline"
        borderRadius="full"
        _disabled={{ borderColor: 'background-default' }}
        onPress={onSwitchTokens}
        size="lg"
        bgColor="surface-neutral-subdued"
      />
    </Center>
  );
};

export const SwapContent = () => {
  const intl = useIntl();
  const isSmall = useIsVerticalLayout();
  const navigation = useNavigation();
  const independentField = useAppSelector((s) => s.swap.independentField);
  const loading = useAppSelector((s) => s.swap.loading);
  const { wallet, network } = useActiveWalletAccount();
  const swapMaintain = useAppSelector((s) => s.swapTransactions.swapMaintain);
  const { formattedAmounts } = useDerivedSwapState();
  const quote = useAppSelector((s) => s.swap.quote);
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
        screen: SwapRoutes.OutputCrosschain,
      },
    });
  }, [navigation]);
  const onChangeInput = useCallback((value: string) => {
    backgroundApiProxy.serviceSwap.userInput('INPUT', value);
  }, []);
  const onChangeOutput = useCallback((value: string) => {
    backgroundApiProxy.serviceSwap.userInput('OUTPUT', value);
  }, []);

  const containerProps = useMemo(
    () => ({
      upper: { pb: '0' },
      lower: { pt: '0' },
    }),
    [],
  );

  return (
    <Box w="full">
      <Box
        position="relative"
        borderRadius={isSmall ? undefined : '12'}
        overflow="hidden"
      >
        <Box px={2} pt="3" pb="5" bg="surface-subdued" overflow="hidden">
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
            <Box position="absolute" top="0" left="4">
              <SwitchTokensButton />
            </Box>
            <Box position="absolute" top="0" right="4">
              <SwapPercentInput />
            </Box>
          </Box>
        </Box>
        <Box
          px={2}
          pb="3"
          pt="5"
          bg="action-secondary-default"
          overflow="hidden"
        >
          <ReceivingTokenInput
            type="OUTPUT"
            label={intl.formatMessage({ id: 'action__receive' })}
            inputValue={formattedAmounts.OUTPUT}
            onChange={onChangeOutput}
            onPress={onSelectOutput}
            containerProps={containerProps.lower}
            extraData={quote?.quoteExtraData}
          />
        </Box>
        {isDisabled ? (
          <Box w="full" h="full" position="absolute" zIndex={1} />
        ) : null}
      </Box>
    </Box>
  );
};
