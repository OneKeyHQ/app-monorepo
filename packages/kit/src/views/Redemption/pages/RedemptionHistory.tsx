import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Badge, Empty, Page, Spinner, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EBtcRewardStatus } from '@onekeyhq/shared/src/referralCode/type';
import type {
  IBtcRewardHistoryItem,
  IRedemptionRecordItem,
} from '@onekeyhq/shared/src/referralCode/type';
import { EModalReferFriendsRoutes } from '@onekeyhq/shared/src/routes';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

import {
  formatUsd,
  getBtcRewardStatusConfig,
  isBtcRewardSnapshotStatus,
} from '../utils';

type IUnifiedRecord =
  | {
      kind: 'legacy';
      id: string;
      sortDate: Date;
      data: IRedemptionRecordItem;
    }
  | {
      kind: 'btc';
      id: string;
      sortDate: Date;
      data: IBtcRewardHistoryItem;
    };

function LegacyRecordRow({ item }: { item: IRedemptionRecordItem }) {
  const intl = useIntl();
  const isSuccess = item.status === 'success';
  const statusText = intl.formatMessage({
    id: isSuccess
      ? ETranslations.redemption_status_success
      : ETranslations.redemption_status_pending,
  });

  return (
    <ListItem
      icon="GiftOutline"
      title={item.title}
      subtitle={`${item.description} · ${formatDate(item.redeemedAt, {
        hideSeconds: true,
      })}`}
    >
      <Badge badgeType={isSuccess ? 'success' : 'default'} badgeSize="sm">
        <Badge.Text>{statusText}</Badge.Text>
      </Badge>
      {/* Invisible chevron placeholder so the badge aligns with drillIn rows. */}
      <ListItem.DrillIn opacity={0} />
    </ListItem>
  );
}

function BtcRewardRecordRow({
  record,
  onPress,
  statusConfigs,
}: {
  record: IBtcRewardHistoryItem;
  onPress: (item: IBtcRewardHistoryItem) => void;
  statusConfigs: ReturnType<typeof getBtcRewardStatusConfig>;
}) {
  const statusConfig =
    statusConfigs[record.status] ?? statusConfigs[EBtcRewardStatus.Wait];
  const handlePress = useCallback(() => onPress(record), [onPress, record]);
  const hasBtcSnapshot = isBtcRewardSnapshotStatus(record.status);
  const hasBtcAmount = hasBtcSnapshot && record.btcAmount;
  const displayDate = formatDate(
    hasBtcAmount ? record.paidAt || record.submittedAt : record.submittedAt,
    { hideSeconds: true },
  );

  const title = hasBtcAmount
    ? `${record.btcAmount} cbBTC`
    : formatUsd(record.rewardUsd);
  const subtitle = hasBtcAmount
    ? `${formatUsd(record.rewardUsd)} · ${displayDate}`
    : displayDate;

  return (
    <ListItem
      icon="TicketOutline"
      title={title}
      subtitle={subtitle}
      drillIn
      onPress={handlePress}
    >
      <Badge badgeType={statusConfig.badgeType} badgeSize="sm">
        <Badge.Text>{statusConfig.label}</Badge.Text>
      </Badge>
    </ListItem>
  );
}

function RedemptionHistoryContent() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const statusConfigs = useMemo(() => getBtcRewardStatusConfig(intl), [intl]);

  const { isLoggedIn } = useOneKeyAuth();

  const { result: legacyResult, isLoading: isLegacyLoading } = usePromiseResult(
    async () => {
      if (!isLoggedIn) return undefined;
      defaultLogger.referral.redemption.loadHistory();
      return backgroundApiProxy.serviceReferralCode.getRedemptionRecords();
    },
    [isLoggedIn],
    { watchLoading: true },
  );

  const { result: btcItems, isLoading: isBtcLoading } = usePromiseResult(
    async () => {
      const result =
        await backgroundApiProxy.serviceReferralCode.btcRewardHistory({
          pageSize: 100,
        });
      if (!result.success) return [] as IBtcRewardHistoryItem[];
      return result.data.data;
    },
    [],
    { watchLoading: true, initResult: [] as IBtcRewardHistoryItem[] },
  );

  const unifiedRecords = useMemo<IUnifiedRecord[]>(() => {
    const legacyRecords = legacyResult?.items ?? [];
    const legacy = legacyRecords.map<IUnifiedRecord>((item) => ({
      kind: 'legacy',
      id: item._id,
      sortDate: new Date(item.redeemedAt),
      data: item,
    }));
    const btc = (btcItems ?? []).map<IUnifiedRecord>((record) => ({
      kind: 'btc',
      id: record.code,
      sortDate: new Date(record.submittedAt),
      data: record,
    }));
    return [...legacy, ...btc].toSorted(
      (a, b) => b.sortDate.getTime() - a.sortDate.getTime(),
    );
  }, [legacyResult, btcItems]);

  const handleRecordPress = useCallback(
    (item: IBtcRewardHistoryItem) => {
      navigation.push(EModalReferFriendsRoutes.BtcRewardDetail, { item });
    },
    [navigation],
  );

  const isLoading = isBtcLoading || (isLoggedIn && isLegacyLoading);

  const renderContent = () => {
    if (isLoading) {
      return (
        <YStack flex={1} justifyContent="center" alignItems="center" py="$20">
          <Spinner size="large" />
        </YStack>
      );
    }

    if (unifiedRecords.length === 0) {
      return (
        <YStack flex={1} justifyContent="center" alignItems="center" py="$10">
          <Empty
            icon="TicketOutline"
            title={intl.formatMessage({
              id: ETranslations.redemption_no_redemptions_yet,
            })}
            description={intl.formatMessage({
              id: ETranslations.redemption_no_redemptions_message,
            })}
          />
        </YStack>
      );
    }

    return (
      <YStack py="$2">
        {unifiedRecords.map((record) =>
          record.kind === 'legacy' ? (
            <LegacyRecordRow key={record.id} item={record.data} />
          ) : (
            <BtcRewardRecordRow
              key={record.id}
              record={record.data}
              onPress={handleRecordPress}
              statusConfigs={statusConfigs}
            />
          ),
        )}
      </YStack>
    );
  };

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.redemption_history_title,
        })}
      />
      <Page.Body>{renderContent()}</Page.Body>
    </Page>
  );
}

export default function RedemptionHistory() {
  return <RedemptionHistoryContent />;
}
