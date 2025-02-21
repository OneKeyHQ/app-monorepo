import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Empty,
  ListView,
  SizableText,
  Skeleton,
  Toast,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  ESwapLimitOrderStatus,
  type IFetchLimitOrderRes,
} from '@onekeyhq/shared/types/swap/types';

import LimitOrderListItem from '../../components/LimitOrderListItem';

interface ILimitOrderListProps {
  data: IFetchLimitOrderRes[];
  onClickCell: (item: IFetchLimitOrderRes) => void;
  isLoading?: boolean;
  type: 'open' | 'history';
}

const LimitOrderList = ({
  data,
  isLoading,
  type,
  onClickCell,
}: ILimitOrderListProps) => {
  const { gtMd } = useMedia();
  const intl = useIntl();
  const [cancelLoading, setCancelLoading] = useState(false);
  const onCancel = useCallback(
    async (item: IFetchLimitOrderRes) => {
      try {
        setCancelLoading(true);
        await backgroundApiProxy.serviceSwap.cancelLimitOrder({
          provider: item.provider,
          networkId: item.networkId,
          orderId: item.orderId,
          userAddress: item.userAddress,
        });
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
    [intl],
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
    let filteredData = data;
    if (type === 'open') {
      filteredData = data.filter(
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
  }, [data, type]);

  const listHeaderComponent = useMemo(
    () =>
      orderData.length > 0 ? (
        <ListItem mx="-$4">
          <SizableText minWidth={gtMd ? 184 : 145} size="$bodySm">
            Pair
          </SizableText>
          {gtMd ? (
            <SizableText minWidth={184} size="$bodySm">
              Limit price
            </SizableText>
          ) : null}
          <SizableText minWidth={80} size="$bodySm">
            Status
          </SizableText>
          <SizableText flex={1} textAlign="right" size="$bodySm">
            Expiration
          </SizableText>
        </ListItem>
      ) : null,
    [gtMd, orderData.length],
  );

  const loadingSkeleton = useMemo(
    () =>
      Array.from({ length: gtMd ? 4 : 3 }).map((_, index) => (
        <ListItem key={index}>
          <Skeleton w="$10" h="$10" borderRadius="$2" />
        </ListItem>
      )),
    [gtMd],
  );
  return !data.length && isLoading ? (
    loadingSkeleton
  ) : (
    <ListView
      bg={orderData.length > 0 ? '$bgSubdued' : 'transparent'}
      borderRadius="$3"
      estimatedItemSize="$20"
      data={orderData}
      renderItem={renderItem}
      ListHeaderComponent={listHeaderComponent}
      ListEmptyComponent={
        <Empty
          icon="InboxOutline"
          title={intl.formatMessage({
            id: ETranslations.global_no_results,
          })}
        />
      }
    />
  );
};

export default LimitOrderList;
