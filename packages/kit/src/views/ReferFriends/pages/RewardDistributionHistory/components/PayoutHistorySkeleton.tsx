import { useIntl } from 'react-intl';

import { Skeleton, XStack, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const ROW_KEYS = [0, 1, 2, 3];

// Mirrors the loaded page: payout address row, one date header, reward rows.
export function PayoutHistorySkeleton() {
  const intl = useIntl();
  return (
    <YStack>
      <ListItem
        title={intl.formatMessage({
          id: ETranslations.referral_reward_received_address,
        })}
        subtitle={<Skeleton.BodyMd w={120} />}
        drillIn
      />
      <XStack h="$9" px="$5" ai="center">
        <Skeleton.HeadingSm w={80} />
      </XStack>
      {ROW_KEYS.map((key) => (
        <XStack
          key={key}
          px="$5"
          py="$2.5"
          jc="space-between"
          ai="center"
          gap="$4"
        >
          <XStack gap="$3" ai="center">
            <Skeleton w="$10" h="$10" radius="round" />
            <YStack>
              <Skeleton.BodyLg w={56} />
              <Skeleton.BodyMd w={120} />
            </YStack>
          </XStack>
          <Skeleton.BodyLg w={80} />
        </XStack>
      ))}
    </YStack>
  );
}
