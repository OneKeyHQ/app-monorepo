import { useIntl } from 'react-intl';

import { Empty, Spinner, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IHardwareRecordItem } from '@onekeyhq/shared/src/referralCode/type';

import { HardwareRecordCard } from './HardwareRecordCard';
import { HardwareRecordTable } from './HardwareRecordTable';

interface IHardwareRecordsListProps {
  isLoading: boolean;
  records: IHardwareRecordItem[];
  isMobile: boolean;
}

export function HardwareRecordsList({
  isLoading,
  records,
  isMobile,
}: IHardwareRecordsListProps) {
  const intl = useIntl();

  if (isLoading && records.length === 0) {
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
          icon="GiftOutline"
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

  if (isMobile) {
    return (
      <YStack px="$5" gap="$3" pb="$5">
        {records.map((record) => (
          <HardwareRecordCard key={record._id} item={record} />
        ))}
      </YStack>
    );
  }

  return (
    <YStack px="$5" gap="$3" pb="$5">
      <HardwareRecordTable records={records} />
    </YStack>
  );
}
