import { memo, useCallback } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { YStack } from '@onekeyhq/components';
import type { ISignedTxPro, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';

import { EModalSendRoutes } from '../../../Send/router';
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

  const onOpenConfirmTx = useCallback(
    (params: {
      accountId: string;
      networkId: string;
      unsignedTxs: IUnsignedTxPro[];
      onSuccess?: (txs: ISignedTxPro[]) => void;
    }) => {
      navigation.pushModal(EModalRoutes.SendModal, {
        screen: EModalSendRoutes.SendConfirm,
        params,
      });
    },
    [navigation],
  );

  const onBuildTx = useCallback(async () => {
    const { unsignedTx, networkId, accountId, onSuccess } = await buildTx();

    if (unsignedTx) {
      onOpenConfirmTx({
        accountId,
        networkId,
        unsignedTxs: [unsignedTx],
        onSuccess,
      });
    }
  }, [buildTx, onOpenConfirmTx]);

  const onApprove = useCallback(
    async (amount: string, shoutResetApprove?: boolean) => {
      let res;
      if (shoutResetApprove) {
        res = await approveTx(swapApproveResetValue);
        res.onSuccess = async () => {
          await onApprove(amount);
        };
      } else {
        res = await approveTx(amount);
        res.onSuccess = async () => {
          await onBuildTx();
        };
      }
      const unsignedTx = res?.unsignedTx;
      const networkId = res?.networkId;
      const accountId = res?.accountId;
      if (unsignedTx && networkId && accountId) {
        onOpenConfirmTx({
          accountId,
          networkId,
          unsignedTxs: [unsignedTx],
          onSuccess: res.onSuccess,
        });
      }
    },
    [approveTx, onBuildTx, onOpenConfirmTx],
  );

  const onWrapped = useCallback(async () => {
    const { unsignedTx, networkId, accountId, onSuccess } = await wrappedTx();
    if (unsignedTx) {
      onOpenConfirmTx({
        accountId,
        networkId,
        unsignedTxs: [unsignedTx],
        onSuccess,
      });
    }
  }, [onOpenConfirmTx, wrappedTx]);

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
