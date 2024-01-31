import { memo, useCallback } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { YStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';

import { swapApproveResetValue } from '../../config/SwapProvider.constants';
import { useSwapBuildTx } from '../../hooks/useSwapBuiltTx';
import { EModalSwapRoutes, type IModalSwapParamList } from '../../router/types';
import { withSwapProvider } from '../WithSwapProvider';

import SwapActionsState from './SwapActionsState';
import SwapQuoteInput from './SwapQuoteInput';
import SwapQuoteResult from './SwapQuoteResult';

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

  const onBuildTx = useCallback(async () => {
    await buildTx();
  }, [buildTx]);

  const onApprove = useCallback(
    async (amount: string, shoutResetApprove?: boolean) => {
      if (shoutResetApprove) {
        await approveTx(swapApproveResetValue, async () => {
          await onApprove(amount);
        });
      } else {
        await approveTx(amount, async () => {
          await onBuildTx();
        });
      }
    },
    [approveTx, onBuildTx],
  );

  const onWrapped = useCallback(async () => {
    await wrappedTx();
  }, [wrappedTx]);

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
