import { memo, useCallback } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { XStack, YStack } from '@onekeyhq/components';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../routes/Modal/type';
import SwapSlippageTrigger from '../components/SwapSlippageTrigger';
import { useSwapBuildTx } from '../hooks/useSwapBuiltTx';
import { EModalSwapRoutes, type IModalSwapParamList } from '../router/Routers';

import SwapActionsState from './SwapActionsState';
import SwapHistoryButtonContainer from './SwapHistoryButtonContainer';
import SwapQuoteInput from './SwapQuoteInput';
import SwapQuoteResult from './SwapQuoteResult';
import { withSwapProvider } from './WithSwapProvider';

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

  const onOpenHistoryListModal = useCallback(() => {
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapHistoryList,
    });
  }, [navigation]);

  const onApprove = useCallback((allowanceValue: number) => {
    console.log('onApprove-', allowanceValue); // -1 means infinite
    // todo
  }, []);

  const onBuildTx = useCallback(async () => {
    const res = await buildTx();
    if (res) {
      navigation.pushModal(EModalRoutes.SwapModal, {
        screen: EModalSwapRoutes.SwapBuildTxDemo,
      });
    }
  }, [buildTx, navigation]);

  return (
    <YStack flex={1} space="$4">
      <XStack justifyContent="flex-end">
        <SwapHistoryButtonContainer
          onHistoryButtonPress={onOpenHistoryListModal}
        />
        <SwapSlippageTrigger onOpenSlippageModal={onOpenSlippageModal} />
      </XStack>
      <SwapQuoteInput onSelectToken={onSelectToken} />
      <SwapActionsState onBuildTx={onBuildTx} onApprove={onApprove} />
      <SwapQuoteResult onOpenProviderList={onOpenProviderList} />
    </YStack>
  );
};
export default memo(withSwapProvider(SwapMainLoad));
