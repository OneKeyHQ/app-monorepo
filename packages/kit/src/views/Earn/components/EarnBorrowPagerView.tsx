import { forwardRef, memo, useImperativeHandle } from 'react';

import { YStack } from '@onekeyhq/components';

import type { IEarnHomeMode } from './MarketSelector';
import type { SharedValue } from 'react-native-reanimated';

export interface IEarnBorrowPagerViewRef {
  syncCurrentPage: () => void;
}

interface IEarnBorrowPagerViewProps {
  mode: IEarnHomeMode;
  onModeChange: (mode: IEarnHomeMode) => void;
  earnContent: React.ReactNode;
  borrowContent: React.ReactNode;
  pageScrollPosition?: SharedValue<number>;
}

function EarnBorrowPagerViewComponent(
  { mode, earnContent, borrowContent }: IEarnBorrowPagerViewProps,
  ref: React.Ref<IEarnBorrowPagerViewRef>,
) {
  useImperativeHandle(
    ref,
    () => ({
      syncCurrentPage: () => {},
    }),
    [],
  );

  return (
    <YStack flex={1}>{mode === 'borrow' ? borrowContent : earnContent}</YStack>
  );
}

export const EarnBorrowPagerView = memo(
  forwardRef<IEarnBorrowPagerViewRef, IEarnBorrowPagerViewProps>(
    EarnBorrowPagerViewComponent,
  ),
);
