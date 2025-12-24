import { memo, useCallback, useMemo } from 'react';

import { launchImageLibraryAsync } from 'expo-image-picker';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Divider,
  Icon,
  LinearGradient,
  Page,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IIconProps, ISizableTextProps } from '@onekeyhq/components';
import { useKeylessWalletFeatureIsEnabled } from '@onekeyhq/kit/src/components/KeylessWallet/useKeylessWallet';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes';

import { TabSettingsListItem, TabSettingsSection } from '../Tab/ListItem';
import { useIsTabNavigator } from '../Tab/useIsTabNavigator';

import { OneKeyIdAvatar } from './OneKeyIdAvatar';

function OneKeyIdUserProfile() {
  const { user, isLoggedIn, loginOneKeyId } = useOneKeyAuth();
  const intl = useIntl();

  const handleLogin = useCallback(() => {
    void loginOneKeyId();
  }, [loginOneKeyId]);

  const handlePickAvatar = useCallback(async () => {
    const result = await launchImageLibraryAsync({
      base64: !platformEnv.isNative,
      allowsMultipleSelection: false,
      mediaTypes: ['images'],
    });

    if (!result.canceled) {
      const uri = result?.assets?.[0]?.uri;
      if (uri) {
        // TODO: Upload the image and update user avatar
        console.log('Selected avatar:', uri);
      }
    }
  }, []);

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
        <OneKeyIdAvatar size="$12" />
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
    <YStack alignItems="center" gap="$3">
      <YStack>
        <OneKeyIdAvatar size="$16" />
        <YStack
          position="absolute"
          inset={0}
          borderRadius="$full"
          overflow="hidden"
          animation="quick"
          animateOnly={['opacity']}
          opacity={0}
          hoverStyle={{
            opacity: 1,
          }}
          userSelect="none"
          onPress={handlePickAvatar}
        >
          <LinearGradient
            height="50%"
            mt="auto"
            inset={0}
            colors={[
              'rgba(0, 0, 0, 0)',
              'rgba(0, 0, 0, 0.3)',
              'rgba(0, 0, 0, 0.8)',
            ]}
            alignItems="center"
            justifyContent="center"
          >
            <SizableText size="$bodyXsMedium" color="white">
              Edit
            </SizableText>
          </LinearGradient>
        </YStack>
      </YStack>
      <YStack gap="$1">
        <SizableText size="$bodyLgMedium" color="$text" textAlign="center">
          {user?.displayEmail || 'OneKey ID'}
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued" textAlign="center">
          {user?.displayEmail}
        </SizableText>
      </YStack>
    </YStack>
  );
}

function OneKeyIdSettingsPageView() {
  const navigation = useAppNavigation();
  const { isLoggedIn } = useOneKeyAuth();
  const isTabNavigator = useIsTabNavigator();
  const isKeylessWalletEnabled = useKeylessWalletFeatureIsEnabled();

  const titleProps = useMemo(
    () => ({
      size: (isTabNavigator
        ? '$bodyMdMedium'
        : '$bodyLgMedium') as ISizableTextProps['size'],
    }),
    [isTabNavigator],
  );

  const iconProps = useMemo(
    () => ({
      size: (isTabNavigator ? '$5' : '$6') as IIconProps['size'],
    }),
    [isTabNavigator],
  );

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
        <YStack px="$4" pt="$3" gap="$6">
          <SizableText>Hello World</SizableText>
          {/* User Profile Section */}
          {isKeylessWalletEnabled ? <OneKeyIdUserProfile /> : null}

          {/* Menu Items - only show when logged in */}
          {isLoggedIn ? (
            <TabSettingsSection>
              <TabSettingsListItem
                icon="PeopleOutline"
                iconProps={iconProps}
                title="Personal information"
                titleProps={titleProps}
                drillIn
                onPress={handlePersonalInfo}
              />
              <XStack mx="$5">
                <Divider borderColor="$neutral3" />
              </XStack>
              <TabSettingsListItem
                icon="LockOutline"
                iconProps={iconProps}
                title="Sign-In & Security"
                titleProps={titleProps}
                drillIn
                onPress={handleSignInSecurity}
              />
              {isKeylessWalletEnabled ? (
                <>
                  <XStack mx="$5">
                    <Divider borderColor="$neutral3" />
                  </XStack>
                  <TabSettingsListItem
                    icon="CloudOutline"
                    iconProps={iconProps}
                    title="Keyless wallet"
                    titleProps={titleProps}
                    drillIn
                    onPress={handleKeylessWallet}
                  />
                </>
              ) : null}
            </TabSettingsSection>
          ) : null}
        </YStack>
      </Page.Body>
    </Page>
  );
}

export const OneKeyIdSettingsPage = memo(OneKeyIdSettingsPageView);
