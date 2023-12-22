import { memo } from 'react';

import { Icon, Skeleton, Text, XStack } from '@onekeyhq/components';
import type { IKeyOfIcons } from '@onekeyhq/components';

interface ISwapQuoteResultCellProps {
  title: string;
  value: string;
  valueLeft?: React.ReactNode;
  valueRight?: React.ReactNode;
  cellRightIcon?: IKeyOfIcons;
  loading?: boolean;
  onPress?: () => void;
}
const SwapQuoteResultCell = ({
  title,
  value,
  valueLeft,
  valueRight,
  cellRightIcon,
  loading,
  onPress,
}: ISwapQuoteResultCellProps) => (
  <XStack onPress={onPress} justifyContent="space-between" h="$20">
    <Text>{title}</Text>
    {loading ? (
      <Skeleton w="$15" h="$6" />
    ) : (
      <XStack space="$2">
        {valueLeft || null}
        <Text>{value}</Text>
        {valueRight || null}
        {cellRightIcon && <Icon name={cellRightIcon} />}
      </XStack>
    )}
  </XStack>
);

export default memo(SwapQuoteResultCell);
