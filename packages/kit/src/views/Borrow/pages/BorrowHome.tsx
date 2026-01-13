import { memo, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  ScrollView,
  SegmentControl,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { NoAddressWarning } from '../../Staking/components/ProtocolDetails/NoAddressWarning';
import { useEarnAccount } from '../../Staking/hooks/useEarnAccount';
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

type IBorrowHomeProps = {
  header?: React.ReactNode;
};

const BorrowHomeContent = memo(({ header }: IBorrowHomeProps) => {
  const { gtMd, gtLg } = useMedia();
  const intl = useIntl();
  const [activeTab, setActiveTab] = useState<IBorrowTab>('supply');
  const { reserves, market } = useBorrowContext();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { earnAccount, refreshAccount } = useEarnAccount({
    networkId: market?.networkId,
  });
  const alerts = reserves?.alerts;
  const accountId = activeAccount.account?.id ?? '';
  const walletId = activeAccount.wallet?.id;
  const indexedAccountId = activeAccount.indexedAccount?.id;
  const showNoAddressWarning = useMemo(() => {
    if (!market?.networkId || !activeAccount.ready) {
      return false;
    }
    return (!accountId && !indexedAccountId) || !earnAccount?.accountAddress;
  }, [
    accountId,
    indexedAccountId,
    earnAccount?.accountAddress,
    market?.networkId,
    activeAccount.ready,
  ]);
  const hasAlerts = Boolean(alerts?.length) || showNoAddressWarning;

  const handleCreateAddress = useCallback(async () => {
    await refreshAccount();
  }, [refreshAccount]);

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

  const isMidWidth = gtMd && !gtLg;

  return (
    <ScrollView flex={1}>
      {header ? <YStack pb="$4">{header}</YStack> : null}
      <YStack flex={1} px="$5" pb="$10">
        <Markets />
        <Overview showBottomSpacing={!hasAlerts} />
        {hasAlerts ? (
          <YStack my="$7" gap="$3">
            {showNoAddressWarning ? (
              <NoAddressWarning
                accountId={accountId}
                networkId={market?.networkId ?? ''}
                indexedAccountId={indexedAccountId}
                onCreateAddress={handleCreateAddress}
              />
            ) : null}
            <BorrowAlerts
              alerts={alerts}
              accountId={accountId || undefined}
              walletId={walletId}
              indexedAccountId={indexedAccountId}
              marketNetworkId={market?.networkId}
            />
          </YStack>
        ) : null}
        {gtMd && !isMidWidth ? (
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

const BorrowHomeCmp = memo(({ header }: IBorrowHomeProps) => {
  return (
    <BorrowProvider>
      <BorrowDataGate>
        <BorrowHomeContent header={header} />
      </BorrowDataGate>
    </BorrowProvider>
  );
});

BorrowHomeCmp.displayName = 'BorrowHomeCmp';

export const BorrowHome = BorrowHomeCmp;
