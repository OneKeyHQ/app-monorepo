import React, { useCallback } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { Platform } from 'react-native';

import {
  Box,
  HStack,
  Icon,
  Pressable,
  Toast,
  Typography,
  useToast,
} from '@onekeyhq/components';
import { StackBasicRoutes, StackRoutesParams } from '@onekeyhq/kit/src/routes';

import { useHelpLink } from '../../../hooks/useHelpLink';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  StackRoutesParams,
  StackBasicRoutes.SettingsScreen
>;

export const AboutSection = () => {
  const intl = useIntl();
  const toast = useToast();
  const navigation = useNavigation<NavigationProps>();
  const userAgreementUrl = useHelpLink({ path: 'articles/360002014776' });
  const privacyPolicyUrl = useHelpLink({ path: 'articles/360002003315' });

  const onCheckUpdate = useCallback(() => {
    toast.show({
      render: () => (
        <Toast
          title={intl.formatMessage({
            id: 'msg__the_current_version_is_the_latest',
            defaultMessage: '👏 The current version is the latest',
          })}
        />
      ),
    });
  }, [intl, toast]);
  const openUrl = useCallback(
    (url: string, title?: string) => {
      console.log('url', url, 'title', title);
      if (['android', 'ios'].includes(Platform.OS)) {
        navigation.navigate(StackBasicRoutes.SettingsWebviewScreen, {
          url,
          title,
        });
      } else {
        window.open(url, '_blank');
      }
    },
    [navigation],
  );
  return (
    <Box w="full" mb="4">
      <Box p="2">
        <Typography.Subheading>
          {intl.formatMessage({
            id: 'form__about_uppercase',
            defaultMessage: 'ABOUT',
          })}
        </Typography.Subheading>
      </Box>
      <Box borderRadius="12" bg="surface-default" shadow="depth.2">
        <Box
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          p="4"
          borderBottomWidth="1"
          borderBottomColor="divider"
        >
          <Typography.Body1>
            {intl.formatMessage({
              id: 'form__version',
              defaultMessage: 'Version',
            })}
          </Typography.Body1>
          <Typography.Body2 color="text-subdued">1.0.0</Typography.Body2>
        </Box>
        <Pressable
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          p="4"
          borderBottomWidth="1"
          borderBottomColor="divider"
          onPress={onCheckUpdate}
        >
          <Typography.Body1>
            {intl.formatMessage({
              id: 'form__check_for_updates',
              defaultMessage: 'Check for Updates',
            })}
          </Typography.Body1>
          <Box>
            <Icon name="ChevronRightOutline" size={14} />
          </Box>
        </Pressable>
        <Pressable
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          p="4"
          borderBottomWidth="1"
          borderBottomColor="divider"
          onPress={() =>
            openUrl(
              userAgreementUrl,
              intl.formatMessage({
                id: 'form__user_agreement',
                defaultMessage: 'User Agreement',
              }),
            )
          }
        >
          <Typography.Body1>
            {intl.formatMessage({
              id: 'form__user_agreement',
              defaultMessage: 'User Agreement',
            })}
          </Typography.Body1>
          <Box>
            <Icon name="ChevronRightOutline" size={14} />
          </Box>
        </Pressable>
        <Pressable
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          p="4"
          borderBottomWidth="1"
          borderBottomColor="divider"
          onPress={() =>
            openUrl(
              privacyPolicyUrl,
              intl.formatMessage({
                id: 'form__privacy_policy',
                defaultMessage: 'Privacy Policy',
              }),
            )
          }
        >
          <Typography.Body1>
            {intl.formatMessage({
              id: 'form__privacy_policy',
              defaultMessage: 'Privacy Policy',
            })}
          </Typography.Body1>
          <Box>
            <Icon name="ChevronRightOutline" size={14} />
          </Box>
        </Pressable>
        <Pressable
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          p="4"
          borderBottomWidth="1"
          borderBottomColor="divider"
          onPress={() =>
            openUrl(
              'https://www.onekey.so',
              intl.formatMessage({
                id: 'form__website',
                defaultMessage: 'Office Website',
              }),
            )
          }
        >
          <Typography.Body1>
            {intl.formatMessage({
              id: 'form__website',
              defaultMessage: 'Office Website',
            })}
          </Typography.Body1>
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
          p="4"
          borderBottomWidth="1"
          borderBottomColor="divider"
          onPress={() =>
            openUrl('https://www.discord.gg/nwUJaTzjzv', 'Discord')
          }
        >
          <Typography.Body1>Discord</Typography.Body1>
          <HStack space="2" alignItems="center">
            <Typography.Body2 color="text-success">
              discord.gg/nwUJaTzjzv
            </Typography.Body2>
            <Icon name="ExternalLinkOutline" color="text-success" size={14} />
          </HStack>
        </Pressable>
        <Pressable
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          p="4"
          onPress={() => openUrl('https://www.twitter.com/onekeyhq', 'Twitter')}
        >
          <Typography.Body1>Twitter</Typography.Body1>
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
