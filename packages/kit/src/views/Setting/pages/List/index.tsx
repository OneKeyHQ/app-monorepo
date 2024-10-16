import type { ComponentProps, FC } from 'react';
import { useCallback, useEffect } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  IconButton,
  Page,
  SizableText,
  Stack,
  Tooltip,
  XStack,
  YStack,
  useClipboard,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { useAppUpdatePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EAppUpdateStatus } from '@onekeyhq/shared/src/appUpdate';
import {
  DISCORD_URL,
  GITHUB_URL,
  ONEKEY_URL,
  TWITTER_URL,
} from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { handleOpenDevMode } from '../../utils/devMode';

import { AdvancedSection } from './AdvancedSection';
import { DefaultSection } from './DefaultSection';
import { DevSettingsSection } from './DevSettingsSection';
import { PreferenceSection } from './PreferenceSection';
import { ResourceSection } from './ResourceSection';
import { SecuritySection } from './SecuritySection';

type ISocialButtonProps = {
  icon: ComponentProps<typeof IconButton>['icon'];
  url: string;
  text: string;
};

const SocialButton: FC<ISocialButtonProps> = ({ icon, url, text }) => {
  const onPress = useCallback(() => {
    openUrlExternal(url);
  }, [url]);
  return (
    <Tooltip
      renderTrigger={
        <IconButton
          bg="$bgSubdued"
          width="$14"
          height="$14"
          icon={icon}
          borderRadius="$full"
          onPress={onPress}
        />
      }
      renderContent={text}
      placement="top"
    />
  );
};

const SocialButtonGroup = () => {
  const intl = useIntl();
  const { copyText } = useClipboard();
  const [appUpdateInfo] = useAppUpdatePersistAtom();
  const versionString = intl.formatMessage(
    {
      id: ETranslations.settings_version_versionnum,
    },
    {
      'versionNum': `${platformEnv.version ?? ''} ${
        platformEnv.buildNumber ?? ''
      }`,
    },
  );
  const handlePress = useCallback(() => {
    void handleOpenDevMode(() =>
      copyText(`${versionString}-${platformEnv.githubSHA || ''}`),
    );
  }, [copyText, versionString]);
  return (
    <YStack>
      <XStack justifyContent="center">
        <XStack gap="$3" paddingVertical="$3" my="$3">
          <SocialButton
            icon="OnekeyBrand"
            url={ONEKEY_URL}
            text={intl.formatMessage({
              id: ETranslations.global_official_website,
            })}
          />
          <SocialButton
            icon="DiscordBrand"
            url={DISCORD_URL}
            text={intl.formatMessage({ id: ETranslations.global_discord })}
          />
          <SocialButton
            icon="Xbrand"
            url={TWITTER_URL}
            text={intl.formatMessage({ id: ETranslations.global_x })}
          />
          <SocialButton
            icon="GithubBrand"
            url={GITHUB_URL}
            text={intl.formatMessage({ id: ETranslations.global_github })}
          />
        </XStack>
      </XStack>
      <YStack
        jc="center"
        py="$4"
        ai="center"
        userSelect="none"
        testID="setting-version"
      >
        <SizableText color="$textSubdued" onPress={handlePress}>
          {versionString}
        </SizableText>
        {appUpdateInfo.status === EAppUpdateStatus.done ? (
          <SizableText color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.update_app_up_to_date })}
          </SizableText>
        ) : null}
      </YStack>
    </YStack>
  );
};

export default function SettingListModal() {
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();

  return (
    <Page scrollEnabled safeAreaEnabled={false}>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.settings_settings,
        })}
      />
      <Page.Body>
        <DefaultSection />
        <PreferenceSection />
        <SecuritySection />
        <AdvancedSection />
        <ResourceSection />
        <DevSettingsSection />
        <SocialButtonGroup />
        {bottom > 0 ? <Stack height={bottom || '$2'} /> : null}
      </Page.Body>
    </Page>
  );
}
