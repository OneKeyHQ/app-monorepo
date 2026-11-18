import { useIntl } from 'react-intl';

import {
  IconButton,
  Image,
  LinearGradient,
  SizableText,
  XStack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IIntercomAppearance,
  IIntercomAvatar,
} from '@onekeyhq/shared/src/modules3rdParty/intercom/messengerTypes';

import { SupportAvatars } from './SupportAvatar';

export function SupportHomeHeader({
  appearance,
  avatars,
  onClose,
}: {
  appearance?: IIntercomAppearance;
  avatars?: IIntercomAvatar[];
  onClose: () => void;
}) {
  const intl = useIntl();
  const theme = useTheme();
  const dark = useThemeVariant() === 'dark';
  const logo = (dark && appearance?.logoDarkUrl) || appearance?.logoUrl;
  const illustration = dark
    ? appearance?.headerImageDarkUrl
    : appearance?.headerImageUrl;
  return (
    <YStack testID="support-home-header" overflow="hidden" bg="$bgApp">
      {illustration ? (
        <YStack
          testID="support-home-illustration"
          position="absolute"
          top={0}
          left={0}
          right={0}
          aspectRatio={599 / 493}
          pointerEvents="none"
        >
          <Image
            source={{ uri: illustration }}
            width="100%"
            height="100%"
            resizeMode="cover"
          />
        </YStack>
      ) : null}
      <LinearGradient
        pointerEvents="none"
        position="absolute"
        bottom={0}
        left={0}
        right={0}
        height={100}
        colors={[`${theme.bgApp.val}00`, theme.bgApp.val]}
      />
      <YStack px="$10" pt="$9" pb="$7" gap="$16">
        <XStack height={32} alignItems="center" gap="$3">
          {logo ? (
            <Image
              source={{ uri: logo }}
              width={32}
              height={32}
              resizeMode="contain"
            />
          ) : (
            <SizableText size="$headingXl">
              {appearance?.brandName || 'OneKey'}
            </SizableText>
          )}
          {appearance?.showAvatars && avatars?.length ? (
            <SupportAvatars avatars={avatars} size={32} />
          ) : null}
        </XStack>
        <YStack>
          {appearance?.greeting ? (
            <SizableText
              size="$heading2xl"
              fontSize={28}
              lineHeight={34}
              color="$textSubdued"
            >
              {appearance.greeting}
            </SizableText>
          ) : null}
          <SizableText size="$heading2xl" fontSize={28} lineHeight={34}>
            {appearance?.introduction ||
              intl.formatMessage({ id: ETranslations.global_support })}
          </SizableText>
        </YStack>
      </YStack>
      <IconButton
        testID="support-close"
        position="absolute"
        top="$8"
        right="$6"
        icon="CrossedLargeOutline"
        variant="tertiary"
        accessibilityLabel={intl.formatMessage({
          id: ETranslations.global_close,
        })}
        onPress={onClose}
      />
    </YStack>
  );
}
