import { memo, useCallback } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Divider,
  Icon,
  Image,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes';

import { PrimeUserBadge } from '../../../Prime/pages/PrimeDashboard/PrimeUserInfo';

function OneKeyIdUserProfile() {
  const { user, isLoggedIn, loginOneKeyId } = useOneKeyAuth();
  const intl = useIntl();

  const handleLogin = useCallback(() => {
    void loginOneKeyId();
  }, [loginOneKeyId]);

  if (!isLoggedIn) {
    return (
      <XStack
        alignItems="center"
        gap="$3"
        p="$4"
        bg="$bg"
        borderWidth={StyleSheet.hairlineWidth}
        borderRadius="$3"
        borderColor="$borderSubdued"
        borderCurve="continuous"
        onPress={handleLogin}
        hoverStyle={{
          bg: '$bgHover',
        }}
        pressStyle={{
          bg: '$bgActive',
        }}
        userSelect="none"
        cursor="pointer"
      >
        <Stack
          width="$12"
          height="$12"
          borderRadius="$full"
          bg="$bgSubdued"
          alignItems="center"
          justifyContent="center"
        >
          <Icon name="PeopleSolid" size="$6" color="$iconSubdued" />
        </Stack>
        <YStack flex={1} gap="$1">
          <SizableText size="$bodyLgMedium" color="$text">
            {intl.formatMessage({ id: ETranslations.prime_signup_login })}
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.id_desc })}
          </SizableText>
        </YStack>
        <Icon name="ChevronRightSmallOutline" color="$iconSubdued" />
      </XStack>
    );
  }

  return (
    <XStack
      alignItems="center"
      gap="$3"
      p="$4"
      bg="$bg"
      borderWidth={StyleSheet.hairlineWidth}
      borderRadius="$3"
      borderColor="$borderSubdued"
      borderCurve="continuous"
    >
      {/* Avatar - Logged in state with fallback */}
      <Image
        width="$12"
        height="$12"
        borderRadius="$full"
        // TODO: Replace with actual avatar URL when available in user data
        source={{ uri: (user as { avatarUrl?: string })?.avatarUrl }}
        fallback={
          <Image.Fallback
            width="$12"
            height="$12"
            borderRadius="$full"
            bg="$bgStrong"
            alignItems="center"
            justifyContent="center"
          >
            <Icon name="PeopleSolid" size="$6" color="$iconActive" />
          </Image.Fallback>
        }
      />
      <YStack flex={1} gap="$1">
        <XStack alignItems="center" gap="$2">
          <SizableText
            size="$bodyLgMedium"
            color="$text"
            numberOfLines={1}
            flex={1}
          >
            {user?.displayEmail || 'OneKey ID'}
          </SizableText>
          <PrimeUserBadge />
        </XStack>
        <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
          {user?.displayEmail}
        </SizableText>
      </YStack>
    </XStack>
  );
}

function OneKeyIdSettingsPageView() {
  const navigation = useAppNavigation();
  const { isLoggedIn } = useOneKeyAuth();

  const handlePersonalInfo = useCallback(() => {
    navigation.push(EModalSettingRoutes.SettingOneKeyIdPersonalInfo);
  }, [navigation]);

  const handleSignInSecurity = useCallback(() => {
    navigation.push(EModalSettingRoutes.SettingOneKeyIdSignInSecurity);
  }, [navigation]);

  const handleKeylessWallet = useCallback(() => {
    navigation.push(EModalSettingRoutes.SettingOneKeyIdKeylessWallet);
  }, [navigation]);

  return (
    <Page>
      <Page.Header title="OneKey ID" />
      <Page.Body>
        <YStack p="$5" gap="$5">
          {/* User Profile Section */}
          <OneKeyIdUserProfile />

          {/* Menu Items - only show when logged in */}
          {isLoggedIn ? (
            <YStack
              bg="$bg"
              borderWidth={StyleSheet.hairlineWidth}
              borderRadius="$3"
              borderColor="$borderSubdued"
              borderCurve="continuous"
              overflow="hidden"
            >
              <ListItem
                icon="PeopleOutline"
                title="Personal Information"
                drillIn
                onPress={handlePersonalInfo}
                borderRadius={0}
              />
              <Divider mx="$5" />
              <ListItem
                icon="LockOutline"
                title="Sign-In & Security"
                drillIn
                onPress={handleSignInSecurity}
                borderRadius={0}
              />
              <Divider mx="$5" />
              <ListItem
                icon="WalletOutline"
                title="Keyless Wallet"
                drillIn
                onPress={handleKeylessWallet}
                borderRadius={0}
              />
            </YStack>
          ) : null}
        </YStack>
      </Page.Body>
    </Page>
  );
}

export const OneKeyIdSettingsPage = memo(OneKeyIdSettingsPageView);
