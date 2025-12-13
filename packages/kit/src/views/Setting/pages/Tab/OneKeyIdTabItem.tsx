import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { OneKeyIdAvatar } from '../OneKeyId/OneKeyIdAvatar';

interface IOneKeyIdTabItemProps {
  selected?: boolean;
  onPress?: () => void;
}

function BasicOneKeyIdTabItem({ selected, onPress }: IOneKeyIdTabItemProps) {
  const intl = useIntl();
  const { user, isLoggedIn, loginOneKeyId } = useOneKeyAuth();

  // Track if login was attempted from this component
  const loginAttemptedRef = useRef(false);
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;

  // Auto-navigate to OneKey ID tab after successful login
  useEffect(() => {
    if (isLoggedIn && loginAttemptedRef.current) {
      loginAttemptedRef.current = false;
      // Navigate to OneKey ID tab after successful login
      onPressRef.current?.();
    }
  }, [isLoggedIn]);

  const displayName = useMemo(() => {
    if (!isLoggedIn) {
      return intl.formatMessage({ id: ETranslations.prime_signup_login });
    }
    return user?.displayEmail || 'OneKey ID';
  }, [isLoggedIn, user?.displayEmail, intl]);

  const handlePress = useCallback(() => {
    if (!isLoggedIn) {
      // Mark that login was attempted from this component
      loginAttemptedRef.current = true;
      // Trigger login flow directly
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
        {/* Avatar */}
        <OneKeyIdAvatar size="$10" />

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
