import { memo, useCallback } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { YStack } from '@onekeyhq/components';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../routes/Modal/type';
import { EModalSwapRoutes, type IModalSwapParamList } from '../router/Routers';

import SwapActionsState from './SwapActionsState';
import SwapQuoteInput from './SwapQuoteInput';
import SwapQuoteResult from './SwapQuoteResult';

interface ISwapMainLoadProps {
  onSwapStep: () => void;
}

const SwapMainLoad = ({ onSwapStep }: ISwapMainLoadProps) => {
  console.log('SwapMainLoad-', SwapMainLoad);
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();

  const onSelectToken = useCallback(
    (type: 'from' | 'to') => {
      navigation.pushModal(EModalRoutes.SwapModal, {
        screen: EModalSwapRoutes.SwapTokenSelect,
        params: { type },
      });
    },
    [navigation],
  );

  const onOpenProviderList = useCallback(() => {
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapProviderSelect,
    });
  }, [navigation]);

  return (
    <YStack flex={1} space="$4">
      <SwapQuoteInput onSelectToken={onSelectToken} />
      <SwapActionsState />
      <SwapQuoteResult onOpenProviderList={onOpenProviderList} />
    </YStack>
  );
};
export default memo(SwapMainLoad);
