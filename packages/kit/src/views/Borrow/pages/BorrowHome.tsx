import { memo, useMemo, useState } from 'react';

import { SegmentControl, XStack, YStack, useMedia } from '@onekeyhq/components';

import { BorrowProvider } from '../BorrowProvider';
import { BorrowCard } from '../components/BorrowCard';
import { BorrowDataGate } from '../components/BorrowDataGate';
import { BorrowedCard } from '../components/BorrowedCard';
import { Markets } from '../components/Markets';
import { Overview } from '../components/Overview';
import { SuppliedCard } from '../components/SuppliedCard';
import { SupplyCard } from '../components/SupplyCard';

type IBorrowTab = 'supply' | 'borrow';

const BorrowHomeCmp = memo(() => {
  const { gtMd } = useMedia();
  const [activeTab, setActiveTab] = useState<IBorrowTab>('supply');

  const tabOptions = useMemo(
    () => [
      { label: 'Supply', value: 'supply' as IBorrowTab },
      { label: 'Borrow', value: 'borrow' as IBorrowTab },
    ],
    [],
  );

  return (
    <BorrowProvider>
      <BorrowDataGate>
        <YStack flex={1} px="$5">
          <Markets />
          <Overview />
          {gtMd ? (
            // Desktop layout - side by side
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
          ) : (
            // Mobile layout - tabbed
            <YStack flex={1} gap="$5">
              <SegmentControl
                value={activeTab}
                options={tabOptions}
                onChange={(value) => setActiveTab(value as IBorrowTab)}
                fullWidth
              />
              {activeTab === 'supply' ? (
                <YStack gap="$5">
                  <SuppliedCard />
                  <SupplyCard />
                </YStack>
              ) : (
                <YStack gap="$5">
                  <BorrowedCard />
                  <BorrowCard />
                </YStack>
              )}
            </YStack>
          )}
        </YStack>
      </BorrowDataGate>
    </BorrowProvider>
  );
});

BorrowHomeCmp.displayName = 'BorrowHomeCmp';

export const BorrowHome = BorrowHomeCmp;
