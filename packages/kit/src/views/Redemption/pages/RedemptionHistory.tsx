import { useIntl } from 'react-intl';

import {
  Badge,
  Empty,
  Page,
  ScrollView,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

// TODO: Move this interface to shared types when API is ready
interface IRedemptionHistoryItem {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  status: 'success' | 'pending';
}

// TODO: Remove mock data when API is ready
// Replace with actual API data from ServiceReferralCode
const MOCK_HISTORY_DATA: IRedemptionHistoryItem[] = [];

function RedemptionHistoryItem({ item }: { item: IRedemptionHistoryItem }) {
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
          {item.subtitle}
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {item.date}
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

  // TODO: Replace with actual API call using usePromiseResult
  // Example:
  // const { result: historyData, isLoading } = usePromiseResult(
  //   () => backgroundApiProxy.serviceReferralCode.getRedemptionHistory(),
  //   [],
  // );
  defaultLogger.referral.redemption.loadHistory();
  const historyData = MOCK_HISTORY_DATA;

  const hasData = historyData.length > 0;

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.redemption_history_title,
        })}
      />
      <Page.Body>
        {hasData ? (
          <ScrollView>
            <YStack>
              {historyData.map((item) => (
                <RedemptionHistoryItem key={item.id} item={item} />
              ))}
            </YStack>
          </ScrollView>
        ) : (
          <YStack flex={1} justifyContent="center" alignItems="center">
            <EmptyState />
          </YStack>
        )}
      </Page.Body>
    </Page>
  );
}
