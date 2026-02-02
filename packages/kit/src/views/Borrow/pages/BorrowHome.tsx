import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
import type { IBorrowAlert } from '@onekeyhq/shared/types/staking';

import { NoAddressWarning } from '../../Staking/components/ProtocolDetails/NoAddressWarning';
import { BorrowProvider, useBorrowContext } from '../BorrowProvider';
import { BorrowAlerts } from '../components/BorrowAlerts';
import { BorrowCard } from '../components/BorrowCard';
import { BorrowDataGate } from '../components/BorrowDataGate';
import { BorrowedCard } from '../components/BorrowedCard';
import { Markets } from '../components/Markets';
import { Overview } from '../components/Overview';
import { SuppliedCard } from '../components/SuppliedCard';
import { SupplyCard } from '../components/SupplyCard';

import type { IStakePendingTx } from '../../Earn/hooks/useStakingPendingTxs';

type IBorrowTab = 'supply' | 'borrow';

type IBorrowHomeProps = {
  header?: React.ReactNode;
  isActive?: boolean;
  pendingTxs?: IStakePendingTx[];
  onRegisterBorrowRefresh?: (handler: (() => Promise<void>) | null) => void;
  onBorrowNetworksChange?: (networkIds: string[]) => void;
};

const BorrowPendingBridge = ({
  pendingTxs,
  onRegisterBorrowRefresh,
}: {
  pendingTxs?: IStakePendingTx[];
  onRegisterBorrowRefresh?: (handler: (() => Promise<void>) | null) => void;
}) => {
  const { setPendingTxs, refreshAllBorrowData } = useBorrowContext();
  const pendingIdsRef = useRef<string | null>(null);

  useEffect(() => {
    const nextIds = (pendingTxs ?? []).map((tx) => tx.id).join(',');
    if (pendingIdsRef.current !== nextIds) {
      pendingIdsRef.current = nextIds;
    }
    setPendingTxs(pendingTxs ?? []);
  }, [pendingTxs, setPendingTxs]);

  const handleRefresh = useCallback(async () => {
    await refreshAllBorrowData();
  }, [refreshAllBorrowData]);

  useEffect(() => {
    if (!onRegisterBorrowRefresh) return undefined;
    onRegisterBorrowRefresh(handleRefresh);
    return () => {
      onRegisterBorrowRefresh(null);
    };
  }, [handleRefresh, onRegisterBorrowRefresh]);

  return null;
};

const BorrowHomeContent = memo(
  ({ header, isActive = true }: IBorrowHomeProps) => {
    const { gtMd, gtLg } = useMedia();
    const intl = useIntl();
    const [activeTab, setActiveTab] = useState<IBorrowTab>('supply');
    const [healthFactorAlerts, setHealthFactorAlerts] = useState<
      IBorrowAlert[] | undefined
    >(undefined);
    const { reserves, market, earnAccount, refreshAllBorrowData } =
      useBorrowContext();
    const { activeAccount } = useActiveAccount({ num: 0 });
    const alerts = useMemo(
      () => [...(reserves.data?.alerts ?? []), ...(healthFactorAlerts ?? [])],
      [reserves.data?.alerts, healthFactorAlerts],
    );
    const accountId = activeAccount.account?.id ?? '';
    const walletId = activeAccount.wallet?.id;
    const indexedAccountId = activeAccount.indexedAccount?.id;
    const showNoAddressWarning = useMemo(() => {
      if (!market?.networkId || !activeAccount.ready) {
        return false;
      }
      return (
        (!accountId && !indexedAccountId) || !earnAccount.data?.accountAddress
      );
    }, [
      accountId,
      indexedAccountId,
      earnAccount.data?.accountAddress,
      market?.networkId,
      activeAccount.ready,
    ]);
    const hasAlerts = Boolean(alerts?.length) || showNoAddressWarning;

    const refreshEarnAccount = earnAccount.refresh;
    const handleCreateAddress = useCallback(async () => {
      await refreshEarnAccount();
      await refreshAllBorrowData();
    }, [refreshEarnAccount, refreshAllBorrowData]);

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
          <Overview
            showBottomSpacing={!hasAlerts}
            isActive={isActive}
            onHealthFactorAlertsChange={setHealthFactorAlerts}
          />
          {hasAlerts ? (
            <YStack
              {...(gtMd ? { my: '$7' } : { mt: '$2', mb: '$7' })}
              gap="$3"
            >
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
  },
);

BorrowHomeContent.displayName = 'BorrowHomeContent';

const BorrowHomeCmp = memo(
  ({
    header,
    isActive = true,
    pendingTxs,
    onRegisterBorrowRefresh,
    onBorrowNetworksChange,
  }: IBorrowHomeProps) => {
    return (
      <BorrowProvider>
        <BorrowPendingBridge
          pendingTxs={pendingTxs}
          onRegisterBorrowRefresh={onRegisterBorrowRefresh}
        />
        <BorrowDataGate
          isActive={isActive}
          onBorrowNetworksChange={onBorrowNetworksChange}
        >
          <BorrowHomeContent header={header} isActive={isActive} />
        </BorrowDataGate>
      </BorrowProvider>
    );
  },
);

BorrowHomeCmp.displayName = 'BorrowHomeCmp';

export const BorrowHome = BorrowHomeCmp;
