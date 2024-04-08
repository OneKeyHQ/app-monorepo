import { memo, useCallback } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { YStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useSwapQuoteCurrentSelectAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import {
  EModalSwapRoutes,
  type IModalSwapParamList,
} from '@onekeyhq/shared/src/routes/swap';
import { swapApproveResetValue } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import { useSwapBuildTx } from '../../hooks/useSwapBuiltTx';
import { useSwapActionState } from '../../hooks/useSwapState';
import { withSwapProvider } from '../WithSwapProvider';

import SwapActionsState from './SwapActionsState';
import SwapAlertContainer from './SwapAlertContainer';
import SwapHeaderContainer from './SwapHeaderContainer';
import SwapQuoteInput from './SwapQuoteInput';
import SwapQuoteResult from './SwapQuoteResult';

const SwapMainLoad = () => {
  const { buildTx, approveTx, wrappedTx } = useSwapBuildTx();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const swapActionState = useSwapActionState();
  const [quoteResult] = useSwapQuoteCurrentSelectAtom();
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
      testID="swap-content-container"
      flex={1}
      marginHorizontal="auto"
      width="100%"
      maxWidth={480}
    >
      <YStack
        pt="$2.5"
        px="$5"
        pb="$5"
        space="$5"
        flex={1}
        $gtMd={{
          flex: 'unset',
          pt: '$5',
        }}
      >
        <SwapHeaderContainer />
        <SwapQuoteInput
          onSelectToken={onSelectToken}
          swapActionState={swapActionState}
        />
        {swapActionState.alerts?.length ? (
          <SwapAlertContainer alerts={swapActionState.alerts} />
        ) : null}
        {quoteResult ? (
          <SwapQuoteResult
            onOpenProviderList={onOpenProviderList}
            quoteResult={quoteResult}
          />
        ) : null}
      </YStack>
      <SwapActionsState
        swapActionState={swapActionState}
        onBuildTx={onBuildTx}
        onApprove={onApprove}
        onWrapped={onWrapped}
      />
    </YStack>
  );
};
export default memo(withSwapProvider(SwapMainLoad));
