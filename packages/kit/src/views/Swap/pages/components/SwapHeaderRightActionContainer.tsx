import { useCallback } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { Badge, Stack } from '@onekeyhq/components';
import {
  HeaderButtonGroup,
  HeaderIconButton,
} from '@onekeyhq/components/src/layouts/Navigation/Header';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useSwapTxHistoryStatusChangeAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
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
  const [, setSwapTxHistoryStatusChange] = useSwapTxHistoryStatusChangeAtom();
  const onOpenHistoryListModal = useCallback(() => {
    setSwapTxHistoryStatusChange([]);
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapHistoryList,
    });
  }, [navigation, setSwapTxHistoryStatusChange]);
  return (
    <HeaderButtonGroup>
      {swapTxHistoryPending.length > 0 ? (
        <Badge badgeSize="lg" badgeType="info" onPress={onOpenHistoryListModal}>
          <Stack borderRadius="$full" p={3} bg="$borderInfo">
            <Stack w="$1.5" h="$1.5" borderRadius="$full" bg="$iconInfo" />
          </Stack>
          <Badge.Text pl="$2">{`${swapTxHistoryPending.length} Pending `}</Badge.Text>
        </Badge>
      ) : (
        <HeaderIconButton
          icon="ClockTimeHistoryOutline"
          onPress={onOpenHistoryListModal}
        />
      )}
      <HeaderIconButton icon="QuestionmarkOutline" />
    </HeaderButtonGroup>
  );
};

export default withSwapProvider(SwapHeaderRightActionContainer);
