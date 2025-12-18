import { memo } from 'react';

import { XStack, YStack } from '@onekeyhq/components';

import { BorrowProvider } from '../BorrowProvider';
import { BorrowCard } from '../components/BorrowCard';
import { BorrowDataGate } from '../components/BorrowDataGate';
import { BorrowedCard } from '../components/BorrowedCard';
import { Markets } from '../components/Markets';
import { Overview } from '../components/Overview';
import { SuppliedCard } from '../components/SuppliedCard';
import { SupplyCard } from '../components/SupplyCard';

const BorrowHomeCmp = memo(() => {
  return (
    <BorrowProvider>
      <BorrowDataGate>
        <YStack flex={1} px="$5">
          <Markets />
          <Overview />
          <XStack flex={1} gap="$5">
            <YStack flex={1} gap="$5">
              <SuppliedCard />
              <SupplyCard />
            </YStack>
            <YStack flex={1} gap="$5">
              <BorrowedCard />
              <BorrowCard />
            </YStack>
          </XStack>
        </YStack>
      </BorrowDataGate>
    </BorrowProvider>
  );
});

BorrowHomeCmp.displayName = 'BorrowHomeCmp';

export const BorrowHome = BorrowHomeCmp;
