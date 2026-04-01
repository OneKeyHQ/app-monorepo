import { useIntl } from 'react-intl';

import {
  Badge,
  Empty,
  Page,
  ScrollView,
  SizableText,
  Spinner,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IRedemptionRecordItem } from '@onekeyhq/shared/src/referralCode/type';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

interface IRedemptionHistoryItemProps {
  item: IRedemptionRecordItem;
}

function RedemptionHistoryItem({ item }: IRedemptionHistoryItemProps) {
  const intl = useIntl();

  const isSuccess = item.status === 'success';
  const statusText = intl.formatMessage({
    id: isSuccess
      ? ETranslations.redemption_status_success
      : ETranslations.redemption_status_pending,
  });

  return (
    <XStack
      px="$5"
      py="$2.5"
      gap="$2"
      justifyContent="space-between"
      alignItems="center"
    >
      <YStack flex={1} gap="$1">
        <SizableText size="$bodyLgMedium">{item.title}</SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {item.description}
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {formatDate(item.redeemedAt, { hideSeconds: true })}
        </SizableText>
      </YStack>
      <Badge badgeType={isSuccess ? 'success' : 'default'}>{statusText}</Badge>
    </XStack>
  );
}

function EmptyState() {
  const intl = useIntl();

  return (
    <Empty
      icon="TicketOutline"
      title={intl.formatMessage({
        id: ETranslations.redemption_no_redemptions_yet,
      })}
      description={intl.formatMessage({
        id: ETranslations.redemption_no_redemptions_message,
      })}
    />
  );
}

export default function RedemptionHistory() {
  const intl = useIntl();

  const { result, isLoading } = usePromiseResult(
    async () => {
      defaultLogger.referral.redemption.loadHistory();
      return backgroundApiProxy.serviceReferralCode.getRedemptionRecords();
    },
    [],
    { watchLoading: true },
  );

  const historyData = result?.items ?? [];

  function renderContent() {
    if (isLoading) {
      return (
        <YStack flex={1} justifyContent="center" alignItems="center">
          <Spinner size="large" />
        </YStack>
      );
    }

    if (historyData.length === 0) {
      return (
        <YStack flex={1} justifyContent="center" alignItems="center">
          <EmptyState />
        </YStack>
      );
    }

    return (
      <ScrollView>
        <YStack>
          {historyData.map((item) => (
            <RedemptionHistoryItem key={item._id} item={item} />
          ))}
        </YStack>
      </ScrollView>
    );
  }

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.redemption_history_title,
        })}
      />
      <Page.Body>{renderContent()}</Page.Body>
    </Page>
  );
}
