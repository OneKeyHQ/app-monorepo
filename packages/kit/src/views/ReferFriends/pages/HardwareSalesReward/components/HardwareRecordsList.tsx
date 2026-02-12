import { useIntl } from 'react-intl';

import { Empty, SizableText, Spinner, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IHardwareRecordItem } from '@onekeyhq/shared/src/referralCode/type';

import { HardwareRecordCard } from './HardwareRecordCard';
import { HardwareRecordTable } from './HardwareRecordTable';

interface IHardwareRecordsListProps {
  isLoading: boolean;
  records: IHardwareRecordItem[];
  isMobile: boolean;
  isLoadingMore?: boolean;
}

export function HardwareRecordsList({
  isLoading,
  records,
  isMobile,
  isLoadingMore,
}: IHardwareRecordsListProps) {
  const intl = useIntl();

  // Show list Spinner only on desktop (mobile uses RefreshControl for loading feedback)
  if (isLoading && records.length === 0 && !isMobile) {
    return (
      <YStack ai="center" jc="center" py="$10" px="$5">
        <Spinner size="large" />
      </YStack>
    );
  }

  if (records.length === 0) {
    return (
      <YStack px="$5" gap="$3" pb="$5">
        <Empty
          illustration="BlockCoins"
          title={intl.formatMessage({
            id: ETranslations.referral_referred_empty,
          })}
          description={intl.formatMessage({
            id: ETranslations.referral_referred_empty_desc,
          })}
        />
      </YStack>
    );
  }

  return (
    <YStack px="$5" gap="$3" pb="$5">
      <SizableText size="$headingLg">
        {intl.formatMessage({ id: ETranslations.referral_details })}
      </SizableText>
      {isMobile ? (
        records.map((record) => (
          <HardwareRecordCard key={record._id} item={record} />
        ))
      ) : (
        <HardwareRecordTable records={records} />
      )}
      {isLoadingMore ? (
        <YStack ai="center" py="$4">
          <Spinner size="small" />
        </YStack>
      ) : null}
    </YStack>
  );
}
