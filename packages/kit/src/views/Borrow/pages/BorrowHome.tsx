import { memo, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  ScrollView,
  SegmentControl,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

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
  const intl = useIntl();
  const [activeTab, setActiveTab] = useState<IBorrowTab>('supply');

  const tabOptions = useMemo(
    () => [
      {
        label: intl.formatMessage({ id: ETranslations.defi_supply }),
        value: 'supply' as IBorrowTab,
      },
      {
        label: intl.formatMessage({ id: ETranslations.global_borrow }),
        value: 'borrow' as IBorrowTab,
      },
    ],
    [intl],
  );

  return (
    <BorrowProvider>
      <BorrowDataGate>
        <ScrollView flex={1}>
          <YStack flex={1} px="$5" pb="$10">
            <Markets />
            <Overview />
            {gtMd ? (
              // Desktop layout - 4 equal-width columns using flex
              <YStack gap="$5">
                <XStack gap="$5">
                  <YStack flex={1} flexShrink={0} flexBasis={0}>
                    <SuppliedCard />
                  </YStack>
                  <YStack flex={1} flexShrink={0} flexBasis={0}>
                    <BorrowedCard />
                  </YStack>
                </XStack>
                <XStack gap="$5">
                  <YStack flex={1} flexShrink={0} flexBasis={0}>
                    <SupplyCard />
                  </YStack>
                  <YStack flex={1} flexShrink={0} flexBasis={0}>
                    <BorrowCard />
                  </YStack>
                </XStack>
              </YStack>
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
        </ScrollView>
      </BorrowDataGate>
    </BorrowProvider>
  );
});

BorrowHomeCmp.displayName = 'BorrowHomeCmp';

export const BorrowHome = BorrowHomeCmp;
