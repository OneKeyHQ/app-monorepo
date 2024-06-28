import { useCallback, useMemo } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { Badge, Stack } from '@onekeyhq/components';
import {
  HeaderButtonGroup,
  HeaderIconButton,
} from '@onekeyhq/components/src/layouts/Navigation/Header';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  type EJotaiContextStoreNames,
  useInAppNotificationAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalSwapRoutes } from '@onekeyhq/shared/src/routes/swap';
import type { IModalSwapParamList } from '@onekeyhq/shared/src/routes/swap';
import { ESwapTxHistoryStatus } from '@onekeyhq/shared/types/swap/types';

import { SwapProviderMirror } from '../SwapProviderMirror';

const SwapHeaderRightActionContainer = ({
  storeName,
}: {
  storeName: EJotaiContextStoreNames;
}) => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const [{ swapHistoryPendingList }] = useInAppNotificationAtom();
  const swapPendingStatusList = useMemo(
    () =>
      swapHistoryPendingList.filter(
        (i) =>
          i.status === ESwapTxHistoryStatus.PENDING ||
          i.status === ESwapTxHistoryStatus.DISCARD,
      ),
    [swapHistoryPendingList],
  );
  const onOpenHistoryListModal = useCallback(() => {
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapHistoryList,
      params: {
        storeName,
      },
    });
  }, [navigation, storeName]);
  return (
    <HeaderButtonGroup>
      {swapPendingStatusList.length > 0 ? (
        <Badge badgeSize="lg" badgeType="info" onPress={onOpenHistoryListModal}>
          <Stack borderRadius="$full" p={3} bg="$borderInfo">
            <Stack w="$1.5" h="$1.5" borderRadius="$full" bg="$iconInfo" />
          </Stack>
          <Badge.Text
            cursor="pointer"
            pl="$2"
          >{`${swapPendingStatusList.length} Pending `}</Badge.Text>
        </Badge>
      ) : (
        <HeaderIconButton
          icon="ClockTimeHistoryOutline"
          onPress={onOpenHistoryListModal}
          iconProps={{ size: 24 }}
          size="medium"
        />
      )}
    </HeaderButtonGroup>
  );
};

const SwapHeaderRightActionContainerWithProvider = ({
  storeName,
}: {
  storeName: EJotaiContextStoreNames;
}) => (
  <SwapProviderMirror storeName={storeName}>
    <SwapHeaderRightActionContainer storeName={storeName} />
  </SwapProviderMirror>
);

export default SwapHeaderRightActionContainerWithProvider;
