import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  Button,
  EPageType,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  EJotaiContextStoreNames,
  useInAppNotificationAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IModalSwapParamList } from '@onekeyhq/shared/src/routes';
import { EModalRoutes, EModalSwapRoutes } from '@onekeyhq/shared/src/routes';
import {
  EProtocolOfExchange,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import SwapTxHistoryListCell from '../../components/SwapTxHistoryListCell';

const SwapPendingHistoryListComponent = ({
  pageType,
}: {
  pageType?: EPageType;
}) => {
  const intl = useIntl();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const [{ swapHistoryPendingList }] = useInAppNotificationAtom();
  const { result: swapTxHistoryList } = usePromiseResult(
    async () => {
      const histories =
        await backgroundApiProxy.serviceSwap.fetchSwapHistoryListFromSimple();
      return histories;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [swapHistoryPendingList],
  );
  const listData = useMemo(() => {
    const pendingData =
      swapTxHistoryList?.filter(
        (item) =>
          item.status === ESwapTxHistoryStatus.PENDING ||
          item.status === ESwapTxHistoryStatus.CANCELING,
      ) ?? [];
    return pendingData;
  }, [swapTxHistoryList]);
  if (listData.length === 0) {
    return null;
  }
  return (
    <YStack gap="$2">
      <XStack justifyContent="space-between" alignItems="center">
        <SizableText size="$bodyMd" color="$textSubdued">
          Pending Order
        </SizableText>
        <Button
          variant="tertiary"
          size="$bodyMd"
          color="$textSubdued"
          onPress={() => {
            navigation.pushModal(EModalRoutes.SwapModal, {
              screen: EModalSwapRoutes.SwapHistoryList,
              params: {
                type: EProtocolOfExchange.SWAP,
                storeName:
                  pageType === EPageType.modal
                    ? EJotaiContextStoreNames.swapModal
                    : EJotaiContextStoreNames.swap,
              },
            });
          }}
        >
          {intl.formatMessage({ id: ETranslations.global_view_more })}
        </Button>
      </XStack>
      <YStack>
        {listData.map((item) => (
          <SwapTxHistoryListCell
            key={item.swapInfo.orderId}
            item={item}
            onClickCell={() => {
              navigation.pushModal(EModalRoutes.SwapModal, {
                screen: EModalSwapRoutes.SwapHistoryDetail,
                params: {
                  txHistoryOrderId: item.swapInfo.orderId,
                  txHistoryList: [...(swapTxHistoryList ?? [])],
                },
              });
            }}
          />
        ))}
      </YStack>
    </YStack>
  );
};

export default SwapPendingHistoryListComponent;
