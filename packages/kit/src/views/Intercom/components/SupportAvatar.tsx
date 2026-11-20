import { Icon, Image, SizableText, XStack, YStack } from '@onekeyhq/components';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import type { IIntercomAvatar } from '@onekeyhq/shared/src/modules3rdParty/intercom/messengerTypes';

export function SupportAvatar({
  avatar,
  size = 32,
}: {
  avatar?: IIntercomAvatar;
  size?: number;
}) {
  const theme = useThemeVariant();
  const uri = (theme === 'dark' && avatar?.imageDarkUrl) || avatar?.imageUrl;
  return (
    <YStack
      width={size}
      height={size}
      flexShrink={0}
      borderRadius={size / 2}
      overflow="hidden"
      bg="$bgStrong"
      alignItems="center"
      justifyContent="center"
      accessibilityLabel={avatar?.label}
    >
      {uri ? (
        <Image source={{ uri }} width={size} height={size} resizeMode="cover" />
      ) : null}
      {!uri && avatar?.initials ? (
        <SizableText size="$bodyMdMedium">{avatar.initials}</SizableText>
      ) : null}
      {!uri && !avatar?.initials ? (
        <Icon name="BubbleOutline" size="$5" color="$iconSubdued" />
      ) : null}
    </YStack>
  );
}

export function SupportAvatars({
  avatars,
  size = 32,
}: {
  avatars: IIntercomAvatar[];
  size?: number;
}) {
  return (
    <XStack alignItems="center" flexShrink={0}>
      {avatars.length ? (
        avatars.slice(0, 3).map((avatar, index) => (
          <YStack
            key={`${avatar.imageUrl ?? avatar.initials}-${index}`}
            ml={index ? -8 : 0}
            borderWidth={2}
            borderColor="$bgApp"
            borderRadius={size}
          >
            <SupportAvatar avatar={avatar} size={size} />
          </YStack>
        ))
      ) : (
        <SupportAvatar size={size} />
      )}
    </XStack>
  );
}
