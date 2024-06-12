import type { ComponentProps, FC } from 'react';
import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  IconButton,
  Page,
  SizableText,
  Stack,
  Tooltip,
  XStack,
  YStack,
} from '@onekeyhq/components';
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
  return (
    <YStack>
      <XStack justifyContent="center">
        <XStack space="$3" paddingVertical="$3" my="$3">
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
      <XStack justifyContent="center" py="$4">
        <SizableText
          selectable={false}
          color="$textSubdued"
          onPress={handleOpenDevMode}
          testID="setting-version"
        >
          {intl.formatMessage(
            {
              id: ETranslations.settings_version_versionnum,
            },
            {
              'versionNum': `${platformEnv.version ?? ''} ${
                platformEnv.buildNumber ?? ''
              }`,
            },
          )}
        </SizableText>
      </XStack>
    </YStack>
  );
};

export default function SettingListModal() {
  const intl = useIntl();
  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.settings_settings,
        })}
      />
      <Page.Body>
        <Stack pb="$2">
          <DefaultSection />
          <PreferenceSection />
          <SecuritySection />
          <AdvancedSection />
          <ResourceSection />
          <DevSettingsSection />
          <SocialButtonGroup />
        </Stack>
      </Page.Body>
    </Page>
  );
}
