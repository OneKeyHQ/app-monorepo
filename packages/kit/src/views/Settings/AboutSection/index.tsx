import React, { useCallback } from 'react';

import { useNavigation } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { useIntl } from 'react-intl';

import { Box, HStack, Icon, Pressable, Typography } from '@onekeyhq/components';
import { Text } from '@onekeyhq/components/src/Typography';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import { useSettings } from '@onekeyhq/kit/src/hooks/redux';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';
import { useToast } from '@onekeyhq/kit/src/hooks/useToast';
import {
  HomeRoutes,
  HomeRoutesParams,
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';
import appUpdates from '@onekeyhq/kit/src/utils/updates/AppUpdates';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  UpdateFeatureModalRoutes,
  UpdateFeatureRoutesParams,
} from '../../../routes/Modal/UpdateFeature';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  HomeRoutesParams,
  HomeRoutes.SettingsScreen
>;

type ModalNavigationProps = ModalScreenProps<UpdateFeatureRoutesParams>;

export const AboutSection = () => {
  const intl = useIntl();
  const toast = useToast();
  const navigation = useNavigation<NavigationProps>();
  const modalNavigation = useNavigation<ModalNavigationProps['navigation']>();
  const userAgreementUrl = useHelpLink({ path: 'articles/360002014776' });
  const privacyPolicyUrl = useHelpLink({ path: 'articles/360002003315' });

  const settings = useSettings();

  const onCheckUpdate = useCallback(() => {
    appUpdates
      .checkAppUpdate()
      .then((version) => {
        if (!version) {
          toast.show({
            title: intl.formatMessage({
              id: 'msg__the_current_version_is_the_latest',
            }),
          });
        } else {
          modalNavigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.UpdateFeature,
            params: {
              screen: UpdateFeatureModalRoutes.UpdateFeatureModal,
              params: {
                version,
              },
            },
          });
        }
      })
      .catch(() => {});
  }, [intl, modalNavigation, toast]);
  const openWebViewUrl = useCallback(
    (url: string, title?: string) => {
      if (platformEnv.isNative) {
        navigation.navigate(HomeRoutes.SettingsWebviewScreen, {
          url,
          title,
        });
      } else {
        window.open(url, '_blank');
      }
    },
    [navigation],
  );
  const openLinkUrl = useCallback((url: string) => {
    if (platformEnv.isNative) {
      Linking.openURL(url);
    } else {
      window.open(url, '_blank');
    }
  }, []);

  const handleCopyVersion = useCallback(
    (version) => {
      copyToClipboard(version);
      toast.show({ title: intl.formatMessage({ id: 'msg__copied' }) });
    },
    [toast, intl],
  );

  return (
    <Box w="full" mb="6">
      <Box pb="2">
        <Typography.Subheading color="text-subdued">
          {intl.formatMessage({
            id: 'form__about_uppercase',
          })}
        </Typography.Subheading>
      </Box>
      <Box borderRadius="12" bg="surface-default" shadow="depth.2">
        <Pressable
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          py={4}
          px={{ base: 4, md: 6 }}
          borderBottomWidth="1"
          borderBottomColor="divider"
          onPress={() => {
            handleCopyVersion(
              `${settings.version}${
                settings.buildNumber ? `-${settings.buildNumber}` : ''
              }`,
            );
          }}
        >
          <Text typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
            {intl.formatMessage({
              id: 'form__version',
            })}
          </Text>
          <Typography.Body2 color="text-subdued">
            {settings.version}
            {settings.buildNumber ? `-${settings.buildNumber}` : ''}
          </Typography.Body2>
        </Pressable>
        {!platformEnv.isWeb && (
          <Pressable
            display="flex"
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            py={4}
            px={{ base: 4, md: 6 }}
            borderBottomWidth="1"
            borderBottomColor="divider"
            onPress={onCheckUpdate}
          >
            <Text typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
              {intl.formatMessage({
                id: 'form__check_for_updates',
              })}
            </Text>
            <Box>
              <Icon name="ChevronRightSolid" size={20} />
            </Box>
          </Pressable>
        )}

        <Pressable
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          py={4}
          px={{ base: 4, md: 6 }}
          borderBottomWidth="1"
          borderBottomColor="divider"
          onPress={() =>
            openWebViewUrl(
              userAgreementUrl,
              intl.formatMessage({
                id: 'form__user_agreement',
              }),
            )
          }
        >
          <Text typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
            {intl.formatMessage({
              id: 'form__user_agreement',
            })}
          </Text>
          <Box>
            <Icon name="ChevronRightSolid" size={20} />
          </Box>
        </Pressable>
        <Pressable
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          py={4}
          px={{ base: 4, md: 6 }}
          borderBottomWidth="1"
          borderBottomColor="divider"
          onPress={() =>
            openWebViewUrl(
              privacyPolicyUrl,
              intl.formatMessage({
                id: 'form__privacy_policy',
              }),
            )
          }
        >
          <Text typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
            {intl.formatMessage({
              id: 'form__privacy_policy',
            })}
          </Text>
          <Box>
            <Icon name="ChevronRightSolid" size={20} />
          </Box>
        </Pressable>
        <Pressable
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          py={4}
          px={{ base: 4, md: 6 }}
          borderBottomWidth="1"
          borderBottomColor="divider"
          onPress={() =>
            openWebViewUrl(
              'https://www.onekey.so',
              intl.formatMessage({
                id: 'form__website',
              }),
            )
          }
        >
          <Text typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
            {intl.formatMessage({
              id: 'form__website',
            })}
          </Text>
          <HStack space="2" alignItems="center">
            <Typography.Body2 color="text-success">
              www.onekey.so
            </Typography.Body2>
            <Icon name="ExternalLinkOutline" color="text-success" size={14} />
          </HStack>
        </Pressable>
        <Pressable
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          py={4}
          px={{ base: 4, md: 6 }}
          borderBottomWidth="1"
          borderBottomColor="divider"
          onPress={() => openLinkUrl('https://www.discord.gg/onekey')}
        >
          <Text typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
            Discord
          </Text>
          <HStack space="2" alignItems="center">
            <Typography.Body2 color="text-success">
              discord.gg/onekey
            </Typography.Body2>
            <Icon name="ExternalLinkOutline" color="text-success" size={14} />
          </HStack>
        </Pressable>
        <Pressable
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          py={4}
          px={{ base: 4, md: 6 }}
          onPress={() => openLinkUrl('https://www.twitter.com/onekeyhq')}
        >
          <Text typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
            Twitter
          </Text>
          <HStack space="2" alignItems="center">
            <Typography.Body2 color="text-success">
              twitter.com/onekeyhq
            </Typography.Body2>
            <Icon name="ExternalLinkOutline" color="text-success" size={14} />
          </HStack>
        </Pressable>
      </Box>
    </Box>
  );
};
