import { memo, useCallback } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { YStack } from '@onekeyhq/components';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../routes/Modal/type';
import { useSwapBuildTx } from '../hooks/useSwapBuiltTx';
import { EModalSwapRoutes, type IModalSwapParamList } from '../router/Routers';

import SwapActionsState from './SwapActionsState';
import SwapQuoteInput from './SwapQuoteInput';
import SwapQuoteResult from './SwapQuoteResult';
import { withSwapProvider } from './WithSwapProvider';

const SwapMainLoad = () => {
  const { buildTx, approveTx, wrappedTx } = useSwapBuildTx();
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

  const onApprove = useCallback(
    async (allowanceValue: number) => {
      await approveTx(allowanceValue);
      console.log('onApprove-', allowanceValue); // -1 means infinite
    },
    [approveTx],
  );

  const onWrapped = useCallback(async () => {
    const res = await wrappedTx();
  }, [wrappedTx]);

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
      <SwapQuoteInput onSelectToken={onSelectToken} />
      <SwapActionsState
        onBuildTx={onBuildTx}
        onApprove={onApprove}
        onWrapped={onWrapped}
      />
      <SwapQuoteResult onOpenProviderList={onOpenProviderList} />
    </YStack>
  );
};
export default memo(withSwapProvider(SwapMainLoad));
