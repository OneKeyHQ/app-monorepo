import { useCallback } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { Button, IconButton, XStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalSwapRoutes } from '@onekeyhq/shared/src/routes/swap';
import type { IModalSwapParamList } from '@onekeyhq/shared/src/routes/swap';

import {
  useSwapTxHistoryListSyncFromSimpleDb,
  useSwapTxHistoryStateSyncInterval,
} from '../../hooks/useSwapTxHistory';
import { withSwapProvider } from '../WithSwapProvider';

const SwapHeaderRightActionContainer = () => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  useSwapTxHistoryListSyncFromSimpleDb();
  const { swapTxHistoryPending } = useSwapTxHistoryStateSyncInterval();
  const onOpenHistoryListModal = useCallback(() => {
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapHistoryList,
    });
  }, [navigation]);
  return (
    <XStack justifyContent="flex-end">
      {swapTxHistoryPending.length > 0 ? (
        <Button
          onPress={onOpenHistoryListModal}
          variant="secondary"
          size="medium"
          icon="Ai3StarOutline"
          backgroundColor="$bgInfo"
        >{`${swapTxHistoryPending.length} Pending `}</Button>
      ) : (
        <IconButton
          icon="ClockTimeHistorySolid"
          onPress={onOpenHistoryListModal}
        />
      )}
    </XStack>
  );
};

export default withSwapProvider(SwapHeaderRightActionContainer);
