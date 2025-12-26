import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  EPageType,
  Icon,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useSwapFromTokenAmountAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import {
  EJotaiContextStoreNames,
  useInAppNotificationAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IModalSwapParamList } from '@onekeyhq/shared/src/routes';
import { EModalRoutes, EModalSwapRoutes } from '@onekeyhq/shared/src/routes';
import {
  EProtocolOfExchange,
  ESwapTabSwitchType,
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
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const [swapTabSwitchType] = useSwapTypeSwitchAtom();
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
  const fromTokenAmountBN = new BigNumber(fromTokenAmount.value ?? 0);
  if (
    (!fromTokenAmountBN.isZero() && !fromTokenAmountBN.isNaN()) ||
    listData.length === 0 ||
    swapTabSwitchType === ESwapTabSwitchType.LIMIT
  ) {
    return null;
  }
  return (
    <YStack gap="$2" flex={1} overflow="visible">
      <XStack justifyContent="space-between" flex={1} alignItems="center">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.swap_history_status_pending,
          })}
        </SizableText>

        <XStack
          justifyContent="flex-end"
          alignItems="center"
          gap="$1"
          cursor="pointer"
          borderRadius="$3"
          mr="$-2"
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
          <SizableText
            size="$bodyMd"
            color="$textSubdued"
            pointerEvents="none"
            hoverStyle={{
              size: '$bodyMdMedium',
              color: '$text',
            }}
            pressStyle={{
              size: '$bodyMdMedium',
              color: '$text',
            }}
          >
            {intl.formatMessage({ id: ETranslations.global_view_more })}
          </SizableText>
          <Icon name="ChevronRightSolid" size="$3" color="$iconSubdued" />
        </XStack>
      </XStack>
      <YStack mx="$-6" overflow="visible">
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
