import { memo, useCallback, useState } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { Button, XStack, YStack } from '@onekeyhq/components';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../routes/Modal/type';
import {
  useSwapActions,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
} from '../../../states/jotai/contexts/swap';
import SwapFromAmountPercentage from '../components/SwapFromAmountPercentage';
import SwapTokenAmountInput from '../components/SwapTokenAmountInput';
import SwapTokenBalance from '../components/SwapTokenBalance';
import SwapTokenCurrencyValue from '../components/SwapTokenCurrencyValue';
import SwapTokenSelectTrigger from '../components/SwapTokenSelectTrigger';
import { useSwapNetworkList } from '../hooks/useSwapTokens';
import { EModalSwapRoutes, type IModalSwapParamList } from '../router/Routers';

import type { ISwapFromAmountPercentageItem } from '../types';

interface ISwapMainLoadProps {
  onSwapStep: () => void;
}

const swapFromAmountPercentageItems: ISwapFromAmountPercentageItem[] = [
  { label: '25%', value: 0.25 },
  { label: '50%', value: 0.5 },
  { label: 'Max', value: 1 },
];

const SwapMainLoad = ({ onSwapStep }: ISwapMainLoadProps) => {
  console.log('SwapMainLoad');
  const { fetchLoading } = useSwapNetworkList();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const [fromInputAmount, setFromInputAmount] = useState('');
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [toAmount, setToAmount] = useState('');
  const { alternationToken } = useSwapActions();
  const onSelectToken = useCallback(
    (type: 'from' | 'to') => {
      navigation.pushModal(EModalRoutes.SwapModal, {
        screen: EModalSwapRoutes.SwapTokenSelect,
        params: { type },
      });
    },
    [navigation],
  );
  const onAlternation = useCallback(() => {
    alternationToken();
    // todo amount exchange
  }, [alternationToken]);
  return (
    <YStack flex={1} space="$4">
      <YStack
        mx="$10"
        backgroundColor="$bgBackdropLight"
        borderTopLeftRadius="$4"
        borderTopRightRadius="$4"
        alignItems="center"
      >
        <XStack>
          <YStack space="$4">
            <SwapTokenAmountInput
              onInputChange={setFromInputAmount}
              inputValue={fromInputAmount}
            />
            <SwapTokenCurrencyValue value="99999" currency="$" />
          </YStack>
          <SwapTokenSelectTrigger
            loading={fetchLoading}
            currentToken={fromToken}
            onSelectTokenTrigger={() => {
              onSelectToken('from');
            }}
          />
        </XStack>
        {/* todo account logic */}
        <XStack>
          <SwapTokenBalance balance={8888.88} symbol="BTC" />
          <SwapFromAmountPercentage
            selectItems={swapFromAmountPercentageItems}
            onSelectItem={(item) => {
              // todo
              console.log('onSelectItem', item);
            }}
          />
        </XStack>
      </YStack>
      <XStack justifyContent="center" style={{ order: '1' }}>
        <Button mt="$-4" borderRadius="$4" onPress={onAlternation}>
          交换
        </Button>
      </XStack>
      <YStack
        style={{ order: '2' }}
        mx="$10"
        backgroundColor="$bgBackdropLight"
        borderBottomLeftRadius="$4"
        borderBottomRightRadius="$4"
        alignItems="center"
      >
        <XStack>
          <YStack space="$4">
            <SwapTokenAmountInput
              onInputChange={() => {}}
              inputValue={toAmount}
              disabled
            />
            <SwapTokenCurrencyValue value="99999" currency="$" />
          </YStack>
          <SwapTokenSelectTrigger
            loading={fetchLoading}
            currentToken={toToken}
            onSelectTokenTrigger={() => {
              onSelectToken('to');
            }}
          />
        </XStack>
        {/* todo account logic */}
        <XStack justifyContent="flex-start">
          <SwapTokenBalance balance={8888.88} symbol="BTC" />
        </XStack>
      </YStack>
    </YStack>
  );
};
export default memo(SwapMainLoad);
