import { XStack, useMedia } from '@onekeyhq/components';
import {
  ESwapLimitOrderStatus,
  type IFetchLimitOrderRes,
} from '@onekeyhq/shared/types/swap/types';

import LimitOrderCard from './LimitOrderCard';

interface ILimitOrderListItemProps {
  item: IFetchLimitOrderRes;
  cancelLoading?: boolean;
  onClickCell: (item: IFetchLimitOrderRes) => void;
  onCancel: (item: IFetchLimitOrderRes) => void;
}

const LimitOrderListItem = ({
  item,
  onClickCell,
  onCancel,
}: ILimitOrderListItemProps) => {
  const { gtMd } = useMedia();
  return (
    <XStack mb="$2">
      <LimitOrderCard
        item={item}
        hiddenCreateTime
        onPress={() => onClickCell(item)}
        progressWidth={gtMd ? 100 : 200}
        onCancel={() => onCancel(item)}
        hiddenCancelIcon={item.status !== ESwapLimitOrderStatus.OPEN}
      />
    </XStack>
  );
};

export default LimitOrderListItem;
