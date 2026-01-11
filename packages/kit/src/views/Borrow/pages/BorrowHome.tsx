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

import { BorrowProvider, useBorrowContext } from '../BorrowProvider';
import { BorrowAlerts } from '../components/BorrowAlerts';
import { BorrowCard } from '../components/BorrowCard';
import { BorrowDataGate } from '../components/BorrowDataGate';
import { BorrowedCard } from '../components/BorrowedCard';
import { Markets } from '../components/Markets';
import { Overview } from '../components/Overview';
import { SuppliedCard } from '../components/SuppliedCard';
import { SupplyCard } from '../components/SupplyCard';

type IBorrowTab = 'supply' | 'borrow';

const BorrowHomeContent = memo(() => {
  const { gtMd } = useMedia();
  const intl = useIntl();
  const [activeTab, setActiveTab] = useState<IBorrowTab>('supply');
  const { reserves } = useBorrowContext();
  const alerts = reserves?.alerts;
  const hasAlerts = Boolean(alerts?.length);

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
    <ScrollView flex={1}>
      <YStack flex={1} px="$5" pb="$10">
        <Markets />
        <Overview showBottomSpacing={!hasAlerts} />
        {hasAlerts ? (
          <YStack my="$7">
            <BorrowAlerts alerts={alerts} />
          </YStack>
        ) : null}
        {gtMd ? (
          // Desktop layout - two equal-width columns with independent vertical flow
          <XStack gap="$5" ai="flex-start">
            <YStack flex={1} flexShrink={0} flexBasis={0} gap="$5">
              <SuppliedCard />
              <SupplyCard />
            </YStack>
            <YStack flex={1} flexShrink={0} flexBasis={0} gap="$5">
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
    </ScrollView>
  );
});

BorrowHomeContent.displayName = 'BorrowHomeContent';

const BorrowHomeCmp = memo(() => {
  return (
    <BorrowProvider>
      <BorrowDataGate>
        <BorrowHomeContent />
      </BorrowDataGate>
    </BorrowProvider>
  );
});

BorrowHomeCmp.displayName = 'BorrowHomeCmp';

export const BorrowHome = BorrowHomeCmp;
