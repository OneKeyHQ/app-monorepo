import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Dialog,
  Empty,
  ListView,
  Skeleton,
  Toast,
  useMedia,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  ESwapLimitOrderStatus,
  type IFetchLimitOrderRes,
} from '@onekeyhq/shared/types/swap/types';

import LimitOrderListItem from '../../components/LimitOrderListItem';
import { useSwapBuildTx } from '../../hooks/useSwapBuiltTx';

import LimitOrderCancelDialog from './LimitOrderCancelDialog';

interface ILimitOrderListProps {
  onClickCell: (item: IFetchLimitOrderRes) => void;
  isLoading?: boolean;
  type: 'open' | 'history';
}

const LimitOrderList = ({
  isLoading,
  type,
  onClickCell,
}: ILimitOrderListProps) => {
  const { gtMd } = useMedia();
  const intl = useIntl();
  const [cancelLoading, setCancelLoading] = useState(false);
  const { cancelLimitOrder } = useSwapBuildTx();
  const [{ swapLimitOrders }] = useInAppNotificationAtom();
  const runCancel = useCallback(
    async (item: IFetchLimitOrderRes) => {
      try {
        setCancelLoading(true);
        await cancelLimitOrder(item);
        Toast.success({
          title: intl.formatMessage({
            id: ETranslations.global_success,
          }),
        });
      } catch (error) {
        console.error(error);
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.global_failed,
          }),
        });
      } finally {
        setCancelLoading(false);
      }
    },
    [cancelLimitOrder, intl],
  );
  const onCancel = useCallback(
    async (item: IFetchLimitOrderRes) => {
      Dialog.show({
        title: intl.formatMessage({
          id: ETranslations.limit_cancel_order_title,
        }),
        renderContent: <LimitOrderCancelDialog item={item} />,
        onConfirm: () => runCancel(item),
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
        cancelLoading={cancelLoading}
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
        (order) => order.status === ESwapLimitOrderStatus.OPEN,
      );
    }
    return (
      filteredData?.sort((a, b) => {
        const aDate = new BigNumber(a.expiredAt).shiftedBy(3).toNumber();
        const bDate = new BigNumber(b.expiredAt).shiftedBy(3).toNumber();
        return bDate - aDate;
      }) ?? []
    );
  }, [swapLimitOrders, type]);

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
    <ListView
      borderRadius="$3"
      estimatedItemSize="$20"
      data={orderData}
      renderItem={renderItem}
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
