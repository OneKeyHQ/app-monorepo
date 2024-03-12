import { memo, useCallback } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { YStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';

import { swapApproveResetValue } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import { useSwapBuildTx } from '../../hooks/useSwapBuiltTx';
import { EModalSwapRoutes, type IModalSwapParamList } from '../../router/types';
import { withSwapProvider } from '../WithSwapProvider';

import SwapActionsState from './SwapActionsState';
import SwapAlertContainer from './SwapAlertContainer';
import SwapQuoteInput from './SwapQuoteInput';
import SwapQuoteResult from './SwapQuoteResult';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';

const SwapMainLoad = () => {
  const { buildTx, approveTx, wrappedTx } = useSwapBuildTx();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();

  const onSelectToken = useCallback(
    (type: ESwapDirectionType) => {
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
    async (amount: string, isMax?: boolean, shoutResetApprove?: boolean) => {
      if (shoutResetApprove) {
        await approveTx(swapApproveResetValue, false, async () => {
          await onApprove(amount, isMax);
        });
      } else {
        await approveTx(amount, isMax);
      }
    },
    [approveTx],
  );

  const onWrapped = useCallback(async () => {
    await wrappedTx();
  }, [wrappedTx]);

  return (
    <YStack
      px="$4"
      marginHorizontal="auto"
      maxWidth="100%"
      width={576}
      space="$4"
    >
      <SwapQuoteInput onSelectToken={onSelectToken} />
      <SwapAlertContainer />
      <SwapQuoteResult onOpenProviderList={onOpenProviderList} />
      <SwapActionsState
        onBuildTx={onBuildTx}
        onApprove={onApprove}
        onWrapped={onWrapped}
      />
    </YStack>
  );
};
export default memo(withSwapProvider(SwapMainLoad));
