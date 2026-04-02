import { useMemo } from 'react';

import { differenceInDays } from 'date-fns';
import { useIntl } from 'react-intl';

import {
  Divider,
  Icon,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IBorrowReserveDetail } from '@onekeyhq/shared/types/staking';

interface IPlatformBonusSectionProps {
  platformBonus?: IBorrowReserveDetail['platformBonus'];
}

export function PlatformBonusSection({
  platformBonus,
}: IPlatformBonusSectionProps) {
  const intl = useIntl();
  const media = useMedia();

  const endsInDays = useMemo(() => {
    if (!platformBonus?.endsIn) return null;
    const days = differenceInDays(platformBonus.endsIn, new Date());
    return Math.max(0, days);
  }, [platformBonus?.endsIn]);

  if (!platformBonus || !platformBonus.rewards?.length) {
    return null;
  }

  return (
    <YStack p="$3" borderRadius="$3" bg="$bgSubdued" gap="$2" mb="$5">
      <XStack ai="center" gap="$2">
        <XStack ai="center" gap="$1">
          <Icon name="Ai2StarSolid" size="$4" color="$iconSuccess" />
          <EarnText
            text={platformBonus.title}
            size="$bodySmMedium"
            color="$textSubdued"
          />
        </XStack>
        {endsInDays !== null ? (
          <>
            <Divider vertical h="$3" />
            <XStack ai="center" gap="$1">
              <SizableText size="$bodySmMedium" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.earn_event_ends_in,
                })}
              </SizableText>
              <SizableText size="$bodySmMedium" color="$textSuccess">
                {intl.formatMessage(
                  { id: ETranslations.earn_number_days },
                  { number: endsInDays },
                )}
              </SizableText>
            </XStack>
          </>
        ) : null}
      </XStack>
      <XStack ai="center" gap="$1.5" flexWrap="wrap">
        {platformBonus.rewards.map((reward, index) => (
          <XStack key={index} ai="center" gap="$1.5">
            <Token size="xs" tokenImageUri={reward.logoURI} />
            <EarnText text={reward.type} size="$bodyMd" color="$text" />
            <EarnText text={reward.title} size="$bodyMdMedium" color="$text" />
            <EarnText
              text={reward.description}
              size="$bodyMdMedium"
              color="$textSubdued"
            />
          </XStack>
        ))}
        {platformBonus.button ? (
          <XStack
            ml={media.gtSm ? 'auto' : undefined}
            flexBasis={media.gtSm ? undefined : '100%'}
            cursor="pointer"
            onPress={() => openUrlExternal(platformBonus.button.data.link)}
            hoverStyle={{ opacity: 0.8 }}
            pressStyle={{ opacity: 0.6 }}
          >
            <EarnText
              text={platformBonus.button.text}
              size="$bodyMdMedium"
              color="$textSubdued"
            />
          </XStack>
        ) : null}
      </XStack>
    </YStack>
  );
}
