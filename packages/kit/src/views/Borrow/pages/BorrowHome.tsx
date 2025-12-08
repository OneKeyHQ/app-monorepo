import { memo } from 'react';

import { YStack } from '@onekeyhq/components';

import { BorrowProvider } from '../BorrowProvider';
import { Markets } from '../components/Markets';
import { Overview } from '../components/Overview';

const BorrowHomeCmp = memo(() => {
  return (
    <BorrowProvider>
      <YStack flex={1} px="$5">
        <Markets />
        <Overview />
      </YStack>
    </BorrowProvider>
  );
});

BorrowHomeCmp.displayName = 'BorrowHomeCmp';

export const BorrowHome = BorrowHomeCmp;
