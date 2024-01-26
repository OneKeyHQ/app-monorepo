import { useCallback } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { XStack } from '@onekeyhq/components';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../routes/Modal/type';
import SwapSlippageTrigger from '../components/SwapSlippageTrigger';
import { EModalSwapRoutes } from '../router/types';

import SwapHistoryButtonContainer from './SwapHistoryButtonContainer';
import { withSwapProvider } from './WithSwapProvider';

import type { IModalSwapParamList } from '../router/types';

const SwapHeaderRightActionContainer = () => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();

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
  return (
    <XStack justifyContent="flex-end">
      <SwapHistoryButtonContainer
        onHistoryButtonPress={onOpenHistoryListModal}
      />
      <SwapSlippageTrigger onOpenSlippageModal={onOpenSlippageModal} />
    </XStack>
  );
};

export default withSwapProvider(SwapHeaderRightActionContainer);
