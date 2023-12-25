import { memo, useCallback } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { Toast, XStack, YStack } from '@onekeyhq/components';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../routes/Modal/type';
import SwapSlippageTrigger from '../components/SwapSlippageTrigger';
import { useSwapBuildTx } from '../hooks/useSwapBuiltTx';
import { EModalSwapRoutes, type IModalSwapParamList } from '../router/Routers';

import SwapActionsState from './SwapActionsState';
import SwapQuoteInput from './SwapQuoteInput';
import SwapQuoteResult from './SwapQuoteResult';

const SwapMainLoad = () => {
  const { buildTx } = useSwapBuildTx();
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

  const onOpenSlippageModal = useCallback(() => {
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapSlippageSelect,
    });
  }, [navigation]);

  const onApprove = useCallback((allowanceValue: number) => {
    console.log('onApprove-', allowanceValue); // -1 means infinite
    // todo
  }, []);

  const onBuildTx = useCallback(async () => {
    try {
      await buildTx();
      navigation.pushModal(EModalRoutes.SwapModal, {
        screen: EModalSwapRoutes.SwapBuildTxDemo,
      });
    } catch (e) {
      Toast.error({ title: '', message: 'build TX error' });
    }
  }, [buildTx, navigation]);

  return (
    <YStack flex={1} space="$4">
      <XStack justifyContent="flex-end">
        <SwapSlippageTrigger onOpenSlippageModal={onOpenSlippageModal} />
      </XStack>
      <SwapQuoteInput onSelectToken={onSelectToken} />
      <SwapActionsState onBuildTx={onBuildTx} onApprove={onApprove} />
      <SwapQuoteResult onOpenProviderList={onOpenProviderList} />
    </YStack>
  );
};
export default memo(SwapMainLoad);
