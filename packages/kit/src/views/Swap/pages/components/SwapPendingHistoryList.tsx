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
import { selectSwapHistoryPreviewItems } from '@onekeyhq/shared/src/utils/swapHistoryPreviewUtils';
import {
  EProtocolOfExchange,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import SwapTxHistoryListCell from '../../components/SwapTxHistoryListCell';
import { SwapTestIDs } from '../../testIDs';
import { filterSwapMarketHistoryItems } from '../../utils/swapMarketHistory';

const SwapPendingHistoryListComponent = ({
  pageType,
  protocol = EProtocolOfExchange.SWAP,
}: {
  pageType?: EPageType;
  protocol?: EProtocolOfExchange;
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
    {
      // Sync-read the cached list on (re)mount so returning to this surface
      // (e.g. from the Stock/Limit tab, which unmounts this component) shows
      // the rows immediately instead of flashing empty before the async fetch.
      swrKey: 'swapHistoryPreviewList',
      // Keep re-fetching even while the Swap tab is blurred, so archiving on
      // leave (mark-all-read) is reflected before the user returns instead of
      // briefly showing the stale rows and removing them on refocus.
      overrideIsFocused: () => true,
    },
  );
  const filteredSwapTxHistoryList = useMemo(() => {
    if (!swapTxHistoryList?.length) {
      return undefined;
    }
    const items = filterSwapMarketHistoryItems({
      items: swapTxHistoryList,
      protocol,
    });
    // filterSwapMarketHistoryItems treats SWAP as a catch-all that also matches
    // stock trades; stock has its own preview under the Stock tab, so keep the
    // Swap/Bridge preview stock-free.
    return protocol === EProtocolOfExchange.STOCK
      ? items
      : items.filter((item) => item.protocol !== EProtocolOfExchange.STOCK);
  }, [swapTxHistoryList, protocol]);
  const listData = useMemo(
    () =>
      filteredSwapTxHistoryList?.length
        ? selectSwapHistoryPreviewItems(filteredSwapTxHistoryList, 2)
        : [],
    [filteredSwapTxHistoryList],
  );
  const txHistoryListForDetail = useMemo(
    () =>
      filteredSwapTxHistoryList?.length ? filteredSwapTxHistoryList : listData,
    [filteredSwapTxHistoryList, listData],
  );
  const fromTokenAmountBN = new BigNumber(fromTokenAmount.value ?? 0);
  if (
    (!fromTokenAmountBN.isZero() && !fromTokenAmountBN.isNaN()) ||
    listData.length === 0 ||
    swapTabSwitchType === ESwapTabSwitchType.LIMIT
  ) {
    return null;
  }
  return (
    <YStack
      testID={SwapTestIDs.pendingHistoryList}
      gap="$2"
      flex={1}
      overflow="visible"
    >
      <XStack justifyContent="space-between" flex={1} alignItems="center">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.global_history,
          })}
        </SizableText>

        <XStack
          justifyContent="flex-end"
          alignItems="center"
          gap="$1"
          cursor="pointer"
          borderRadius="$3"
          onPress={() => {
            navigation.pushModal(EModalRoutes.SwapModal, {
              screen: EModalSwapRoutes.SwapHistoryList,
              params: {
                type: protocol,
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
      <YStack ml="$-6" mr="$-4">
        {listData.map((item) => (
          <SwapTxHistoryListCell
            key={item.swapInfo.orderId}
            item={item}
            previewMode
            onClickCell={() => {
              navigation.pushModal(EModalRoutes.SwapModal, {
                screen: EModalSwapRoutes.SwapHistoryDetail,
                params: {
                  txHistoryOrderId: item.swapInfo.orderId,
                  txHistoryList: [...txHistoryListForDetail],
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
