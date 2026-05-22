import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import { CREATOR_PROGRAM_URL } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  openUrlExternal,
  openUrlInDiscovery,
} from '@onekeyhq/shared/src/utils/openUrlUtils';

import type { LayoutChangeEvent } from 'react-native';

export function formatCreatorProgramLocale(locale: string) {
  return locale.replace(/-/g, '_');
}

export function shouldShowCreatorProgramBanner(locale: string) {
  return !locale.replace(/_/g, '-').toLowerCase().startsWith('zh');
}

export function CreatorProgramBanner({
  onLayout,
}: {
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const intl = useIntl();

  const locale = formatCreatorProgramLocale(intl.locale);
  const title = intl.formatMessage({
    id: ETranslations.referral_creator_program__title,
  });
  const handlePress = useCallback(() => {
    defaultLogger.referral.page.clickCreatorProgramBanner({ locale });
    if (platformEnv.isDesktop || platformEnv.isNative) {
      openUrlInDiscovery({ url: CREATOR_PROGRAM_URL, title });
    } else {
      openUrlExternal(CREATOR_PROGRAM_URL);
    }
  }, [locale, title]);

  if (!shouldShowCreatorProgramBanner(intl.locale)) {
    return null;
  }

  return (
    <>
      <XStack
        display="none"
        px="$pagePadding"
        mb="$2"
        $md={{ display: 'flex' }}
      >
        <SizableText size="$headingLg">
          {intl.formatMessage({
            id: ETranslations.referral_creator_program_more_ways__title,
          })}
        </SizableText>
      </XStack>

      <YStack
        px="$pagePadding"
        mt="$2"
        mb="$6"
        onLayout={onLayout}
        $md={{ mt: '$0' }}
      >
        <XStack
          role="button"
          bg="$bgSubdued"
          borderWidth="$px"
          borderColor="$borderSubdued"
          borderRadius="$3"
          px="$4"
          py="$3"
          gap="$3"
          ai="center"
          jc="space-between"
          userSelect="none"
          onPress={handlePress}
          hoverStyle={{ bg: '$bgHover' }}
          pressStyle={{ bg: '$bgActive' }}
          $md={{
            borderWidth: 0,
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: '$2.5',
          }}
        >
          <XStack flex={1} gap="$2.5" ai="center" minWidth={0}>
            <Icon
              name="SpeakerPromoteOutline"
              size="$5"
              color="$iconSubdued"
              flexShrink={0}
            />

            <YStack flex={1} minWidth={0} gap="$0.5">
              <SizableText size="$bodyLgMedium" color="$text" numberOfLines={1}>
                {title}
              </SizableText>
              <SizableText
                size="$bodyMd"
                color="$textSubdued"
                numberOfLines={2}
              >
                {intl.formatMessage({
                  id: ETranslations.referral_creator_program__desc,
                })}
              </SizableText>
            </YStack>
          </XStack>

          <XStack ai="center" gap="$1.5" flexShrink={0} $md={{ pl: '$7' }}>
            <SizableText size="$bodyMdMedium" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.global_learn_more })}
            </SizableText>
            <Icon
              name="ArrowTopRightOutline"
              size="$4.5"
              color="$iconSubdued"
            />
          </XStack>
        </XStack>
      </YStack>
    </>
  );
}
