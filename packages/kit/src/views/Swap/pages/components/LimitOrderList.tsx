import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Dialog,
  Empty,
  SectionList,
  SizableText,
  Skeleton,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IFetchLimitOrderRes,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  ESwapCancelLimitOrderSource,
  ESwapLimitOrderStatus,
} from '@onekeyhq/shared/types/swap/types';

import LimitOrderListItem from '../../components/LimitOrderListItem';
import { useSwapBuildTx } from '../../hooks/useSwapBuiltTx';

import LimitOrderCancelDialog from './LimitOrderCancelDialog';

interface ILimitOrderListProps {
  onClickCell: (item: IFetchLimitOrderRes) => void;
  isLoading?: boolean;
  filterToken?: ISwapToken[];
  type: 'open' | 'history';
}

interface ISectionData {
  title: string;
  status?: ESwapLimitOrderStatus;
  data: IFetchLimitOrderRes[];
}

const LimitOrderList = ({
  isLoading,
  type,
  filterToken,
  onClickCell,
}: ILimitOrderListProps) => {
  const { gtMd } = useMedia();
  const intl = useIntl();
  const [cancelLoading, setCancelLoading] = useState<Record<string, boolean>>(
    {},
  );
  const { cancelLimitOrder } = useSwapBuildTx();
  const [{ swapLimitOrders }] = useInAppNotificationAtom();

  const runCancel = useCallback(
    async (item: IFetchLimitOrderRes) => {
      try {
        setCancelLoading((prev) => ({
          ...prev,
          [item.orderId]: true,
        }));
        await cancelLimitOrder(item, ESwapCancelLimitOrderSource.LIST);
      } catch (error) {
        console.error(error);
      } finally {
        setCancelLoading((prev) => ({
          ...prev,
          [item.orderId]: false,
        }));
      }
    },
    [cancelLimitOrder],
  );
  const onCancel = useCallback(
    async (item: IFetchLimitOrderRes) => {
      const dialog = Dialog.show({
        title: intl.formatMessage({
          id: ETranslations.limit_cancel_order_title,
        }),
        description: intl.formatMessage(
          {
            id: ETranslations.limit_cancel_order_content,
          },
          {
            orderID: `${item.orderId.slice(0, 6)}...${item.orderId.slice(-4)}`,
          },
        ),
        renderContent: <LimitOrderCancelDialog item={item} />,
        onConfirm: async () => {
          await dialog.close();
          await runCancel(item);
        },
        showCancelButton: true,
        showConfirmButton: true,
      });
    },
    [intl, runCancel],
  );
  const renderItem = useCallback(
    ({ item }: { item: IFetchLimitOrderRes }) => (
      <LimitOrderListItem
        item={item}
        cancelLoading={cancelLoading[item.orderId]}
        onClickCell={onClickCell}
        onCancel={onCancel}
      />
    ),
    [cancelLoading, onCancel, onClickCell],
  );

  const orderData = useMemo(() => {
    let filteredData = swapLimitOrders;
    if (type === 'open') {
      filteredData = swapLimitOrders.filter(
        (order) =>
          order.status === ESwapLimitOrderStatus.OPEN ||
          order.status === ESwapLimitOrderStatus.PRESIGNATURE_PENDING,
      );
    } else {
      filteredData = swapLimitOrders.filter(
        (order) =>
          order.status !== ESwapLimitOrderStatus.OPEN &&
          order.status !== ESwapLimitOrderStatus.PRESIGNATURE_PENDING,
      );
    }
    if (filterToken) {
      filteredData = filteredData.filter(
        (order) =>
          filterToken.some((t) =>
            equalTokenNoCaseSensitive({
              token1: t,
              token2: order.fromTokenInfo,
            }),
          ) ||
          filterToken.some((t) =>
            equalTokenNoCaseSensitive({
              token1: t,
              token2: order.toTokenInfo,
            }),
          ),
      );
    }
    return (
      filteredData?.sort((a, b) => {
        const aDate = new BigNumber(a.createdAt).toNumber();
        const bDate = new BigNumber(b.createdAt).toNumber();
        return bDate - aDate;
      }) ?? []
    );
  }, [filterToken, swapLimitOrders, type]);

  const sectionData = useMemo(() => {
    const groupByDay = orderData.reduce<Record<string, IFetchLimitOrderRes[]>>(
      (acc, item) => {
        const date = new Date(item.createdAt);
        const monthDay = formatDate(date, {
          hideTimeForever: true,
          hideYear: false,
        });

        if (!acc[monthDay]) {
          acc[monthDay] = [];
        }

        acc[monthDay].push(item);

        return acc;
      },
      {},
    );

    const result: ISectionData[] = Object.entries(groupByDay).map(
      ([title, data]) => ({
        title,
        data,
      }),
    );
    return result;
  }, [orderData]);

  const loadingSkeleton = useMemo(
    () =>
      Array.from({ length: gtMd ? 4 : 3 }).map((_, index) => (
        <ListItem key={index}>
          <Skeleton w="$10" h="$10" borderRadius="$2" />
        </ListItem>
      )),
    [gtMd],
  );

  return !swapLimitOrders.length && isLoading ? (
    loadingSkeleton
  ) : (
    <SectionList
      flex={1}
      borderRadius="$3"
      estimatedItemSize="$20"
      sections={sectionData}
      renderItem={renderItem}
      renderSectionHeader={({ section: { title } }) => (
        <XStack px="$2" pb="$2" alignItems="center">
          <SizableText size="$bodyMd" color="$textSubdued">
            {title}
          </SizableText>
        </XStack>
      )}
      ListEmptyComponent={
        <Empty
          icon="SearchMenuOutline"
          title={intl.formatMessage({
            id: ETranslations.Limit_order_history_empty,
          })}
          description={intl.formatMessage({
            id: ETranslations.Limit_order_history_empty_content,
          })}
        />
      }
    />
  );
};

export default LimitOrderList;
