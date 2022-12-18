import { useCallback, useEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { useIntl } from 'react-intl';

import {
  Box,
  Icon,
  Pressable,
  Text,
  Typography,
  useTheme,
  useToast,
} from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSettings } from '@onekeyhq/kit/src/hooks/redux';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';
import type { HomeRoutesParams } from '@onekeyhq/kit/src/routes/types';
import { HomeRoutes } from '@onekeyhq/kit/src/routes/types';
import { setDevMode } from '@onekeyhq/kit/src/store/reducers/settings';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { canShowAppReview } from '../../../utils/openAppReview';

import AppRateSectionItem from './AppRateSectionItem';
import AutoUpdateSectionItem from './AutoUpdateSectionItem';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<HomeRoutesParams>;

export const AboutSection = () => {
  const intl = useIntl();
  const toast = useToast();
  const navigation = useNavigation<NavigationProps>();
  const { dispatch } = backgroundApiProxy;
  const { themeVariant } = useTheme();
  const [showRate, setShowRate] = useState(() => !platformEnv.isNative);
  const userAgreementUrl = useHelpLink({ path: 'articles/360002014776' });
  const privacyPolicyUrl = useHelpLink({ path: 'articles/360002003315' });
  const settings = useSettings();
  let lastTime: Date | undefined;
  let num = 0;
  const checkShowAppReview = useCallback(() => {
    if (platformEnv.isNative) {
      canShowAppReview(true).then((data) => {
        setShowRate(!!data);
      });
    }
  }, []);
  useEffect(() => {
    checkShowAppReview();
  }, [checkShowAppReview]);
  const openDebugMode = () => {
    const nowTime = new Date();
    if (
      lastTime === undefined ||
      Math.round(nowTime.getTime() - lastTime.getTime()) > 5000
    ) {
      // 重置
      lastTime = nowTime;
      num = 0;
    } else {
      num += 1;
    }
    if (num >= 9) {
      dispatch(setDevMode(true));
    }
  };

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
      <Box
        borderRadius="12"
        bg="surface-default"
        borderWidth={themeVariant === 'light' ? 1 : undefined}
        borderColor="border-subdued"
      >
        <Pressable
          display="flex"
          flexDirection="row"
          alignItems="center"
          py={4}
          px={{ base: 4, md: 6 }}
          borderBottomWidth="1"
          borderBottomColor="divider"
          onPress={() => {
            openDebugMode();
            handleCopyVersion(
              `${settings.version}${
                settings.buildNumber ? `-${settings.buildNumber}` : ''
              }`,
            );
          }}
        >
          <Icon name="HashtagOutline" />
          <Text
            typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            flex={1}
            mx={3}
          >
            {intl.formatMessage({
              id: 'form__version',
            })}
          </Text>
          <Text
            typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            color="text-subdued"
          >
            {settings.version}
            {settings.buildNumber ? `-${settings.buildNumber}` : ''}
          </Text>
        </Pressable>
        {!platformEnv.isMas ? <AutoUpdateSectionItem /> : null}
        {showRate ? (
          <AppRateSectionItem onAfterOnpenReview={checkShowAppReview} />
        ) : null}
        <Pressable
          display="flex"
          flexDirection="row"
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
          <Icon name="UserCircleOutline" />
          <Text
            typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            flex={1}
            mx={3}
          >
            {intl.formatMessage({
              id: 'form__user_agreement',
            })}
          </Text>
          <Box>
            <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
          </Box>
        </Pressable>
        <Pressable
          display="flex"
          flexDirection="row"
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
          <Icon name="EllipsisHorizontalCircleOutline" />
          <Text
            typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            flex={1}
            mx={3}
          >
            {intl.formatMessage({
              id: 'form__privacy_policy',
            })}
          </Text>
          <Box>
            <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
          </Box>
        </Pressable>
        <Pressable
          display="flex"
          flexDirection="row"
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
          <Icon name="GlobeAltOutline" />
          <Text
            typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            flex={1}
            mx={3}
          >
            {intl.formatMessage({
              id: 'form__website',
            })}
          </Text>
          <Icon
            name="ArrowTopRightOnSquareMini"
            color="icon-subdued"
            size={20}
          />
        </Pressable>
        <Pressable
          display="flex"
          flexDirection="row"
          alignItems="center"
          py={4}
          px={{ base: 4, md: 6 }}
          borderBottomWidth="1"
          borderBottomColor="divider"
          onPress={() => openLinkUrl('https://www.discord.gg/onekey')}
        >
          <Icon name="DiscordOutline" />
          <Text
            typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            flex={1}
            mx={3}
          >
            Discord
          </Text>
          <Icon
            name="ArrowTopRightOnSquareMini"
            color="icon-subdued"
            size={20}
          />
        </Pressable>
        <Pressable
          display="flex"
          flexDirection="row"
          alignItems="center"
          py={4}
          px={{ base: 4, md: 6 }}
          onPress={() => openLinkUrl('https://www.twitter.com/onekeyhq')}
        >
          <Icon name="TwitterOutline" />
          <Text
            typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            flex={1}
            mx={3}
          >
            Twitter
          </Text>
          <Icon
            name="ArrowTopRightOnSquareMini"
            color="icon-subdued"
            size={20}
          />
        </Pressable>
      </Box>
    </Box>
  );
};
