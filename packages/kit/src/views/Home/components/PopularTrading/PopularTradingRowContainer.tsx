import type { PropsWithChildren } from 'react';

import { XStack } from '@onekeyhq/components';
import { MARKET_TOKEN_ROW_GROUP_NAME } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketHoverRevealLine';
import { listItemPressStyle } from '@onekeyhq/shared/src/style';

import { HOME_MARKET_TABLE_ROW_MIN_HEIGHT } from './metricColumns';

export type IPopularTradingRowContainerProps = PropsWithChildren<{
  symbol: string;
  onPress: () => void;
  shouldUseTableLayout: boolean;
}>;

export function PopularTradingRowContainer({
  onPress,
  shouldUseTableLayout,
  children,
}: IPopularTradingRowContainerProps) {
  return (
    <XStack
      minHeight={HOME_MARKET_TABLE_ROW_MIN_HEIGHT}
      mx="$2"
      px="$3"
      py="$2"
      borderRadius="$3"
      borderCurve="continuous"
      alignItems="center"
      gap={shouldUseTableLayout ? undefined : '$2'}
      bg="$bgApp"
      onPress={onPress}
      {...listItemPressStyle}
      {...(shouldUseTableLayout
        ? { group: MARKET_TOKEN_ROW_GROUP_NAME }
        : undefined)}
    >
      {children}
    </XStack>
  );
}
