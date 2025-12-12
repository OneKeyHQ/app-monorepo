import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Icon, Image, SizableText, XStack, YStack } from '@onekeyhq/components';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { ETranslations } from '@onekeyhq/shared/src/locale';

interface IOneKeyIdTabItemProps {
  selected?: boolean;
  onPress?: () => void;
}

function BasicOneKeyIdTabItem({ selected, onPress }: IOneKeyIdTabItemProps) {
  const intl = useIntl();
  const { user, isLoggedIn, loginOneKeyId } = useOneKeyAuth();

  const displayName = useMemo(() => {
    if (!isLoggedIn) {
      return intl.formatMessage({ id: ETranslations.prime_signup_login });
    }
    return user?.displayEmail || 'OneKey ID';
  }, [isLoggedIn, user?.displayEmail, intl]);

  const handlePress = useCallback(() => {
    if (!isLoggedIn) {
      // If not logged in, trigger login flow directly
      void loginOneKeyId();
      return;
    }
    // If logged in, navigate to OneKey ID page
    onPress?.();
  }, [isLoggedIn, loginOneKeyId, onPress]);

  return (
    <YStack
      alignItems="center"
      py="$2"
      $gtMd={{
        flexDirection: 'row',
        px: '$2',
        bg: selected ? '$bgActive' : undefined,
        borderRadius: '$2',
      }}
      userSelect="none"
      {...(!selected && {
        hoverStyle: {
          bg: '$bgHover',
        },
        pressStyle: {
          bg: '$bgActive',
        },
      })}
      onPress={handlePress}
      testID={
        selected
          ? 'tab-modal-active-item-onekey-id'
          : 'tab-modal-no-active-item-onekey-id'
      }
    >
      <XStack alignItems="center" gap="$2" flex={1}>
        {/* Avatar - Three states:
            1. Not logged in: subdued background + subdued icon
            2. Logged in, no avatar (fallback): strong background + active icon
            3. Logged in, has avatar: show user avatar image
        */}
        {isLoggedIn ? (
          <Image
            width="$10"
            height="$10"
            borderRadius="$full"
            // TODO: Replace with actual avatar URL when available in user data
            source={{ uri: (user as { avatarUrl?: string })?.avatarUrl }}
            fallback={
              <Image.Fallback
                width="$10"
                height="$10"
                borderRadius="$full"
                bg="$bgStrong"
                alignItems="center"
                justifyContent="center"
              >
                <Icon name="PeopleSolid" size="$5" color="$iconActive" />
              </Image.Fallback>
            }
          />
        ) : (
          <YStack
            width="$10"
            height="$10"
            borderRadius="$full"
            bg="$neutral2"
            alignItems="center"
            justifyContent="center"
            flexShrink={0}
          >
            <Icon name="PeopleSolid" size="$5" color="$iconSubdued" />
          </YStack>
        )}

        {/* Username and Label */}
        <YStack flex={1} gap="$0.5">
          <SizableText
            size="$bodyMdMedium"
            color="$text"
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {displayName}
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
            OneKey ID
          </SizableText>
        </YStack>
      </XStack>
    </YStack>
  );
}

export const OneKeyIdTabItem = memo(BasicOneKeyIdTabItem);
