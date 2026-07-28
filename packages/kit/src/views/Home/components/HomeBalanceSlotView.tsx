import { memo, useEffect } from 'react';

import {
  NumberSizeableText,
  PROPORTIONAL_NUMS,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { perfMark } from '@onekeyhq/shared/src/performance/mark';

import { HomeTestIDs } from '../testIDs';

export type IHomeBalanceSlotPresentation = {
  amount: string;
  currencySymbol: string;
  hidden: boolean;
  showSkeleton: boolean;
};

type IHomeBalanceSlotViewProps = {
  onBalancePress: () => void;
  presentation: IHomeBalanceSlotPresentation;
};

const HomeBalanceSlotView = memo(function HomeBalanceSlotView({
  onBalancePress,
  presentation,
}: IHomeBalanceSlotViewProps) {
  useEffect(() => {
    perfMark('Home:overview:mount');
    return () => {
      perfMark('Home:overview:unmount');
    };
  }, []);

  return (
    <YStack
      flex={1}
      gap="$2.5"
      alignItems="flex-start"
      justifyContent="center"
      testID={HomeTestIDs.walletOverview}
    >
      <YStack w="100%" gap="$2">
        {presentation.showSkeleton ? (
          <Skeleton.Heading5Xl />
        ) : (
          <XStack alignItems="center" gap="$3" h={48}>
            <XStack
              flexShrink={1}
              borderRadius="$3"
              px="$1"
              py="$0.5"
              mx="$-1"
              my="$-0.5"
              cursor="default"
              focusable
              hoverStyle={{
                bg: '$bgHover',
              }}
              pressStyle={{
                bg: '$bgActive',
              }}
              focusVisibleStyle={{
                outlineColor: '$focusRing',
                outlineWidth: 2,
                outlineOffset: 0,
                outlineStyle: 'solid',
              }}
              onPress={onBalancePress}
              testID={HomeTestIDs.totalBalance}
            >
              <NumberSizeableText
                hideValue={presentation.hidden}
                splitDecimal
                flexShrink={1}
                minWidth={0}
                fontSize={48}
                lineHeight={48}
                fontWeight={500}
                fontVariant={PROPORTIONAL_NUMS}
                formatter="value"
                formatterOptions={{
                  currency: presentation.currencySymbol,
                }}
              >
                {presentation.amount}
              </NumberSizeableText>
            </XStack>
          </XStack>
        )}
      </YStack>
    </YStack>
  );
});

export { HomeBalanceSlotView };
