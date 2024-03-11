import type { ComponentProps, FC } from 'react';
import { useCallback } from 'react';

import {
  IconButton,
  Page,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  DISCORD_URL,
  GITHUB_URL,
  ONEKEY_URL,
  TWITTER_URL,
} from '@onekeyhq/shared/src/config/appConfig';
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
};

const SocialButton: FC<ISocialButtonProps> = ({ icon, url }) => {
  const onPress = useCallback(() => {
    openUrlExternal(url);
  }, [url]);
  return (
    <IconButton
      bg="$bgSubdued"
      width="$14"
      height="$14"
      icon={icon}
      borderRadius="$full"
      onPress={onPress}
    />
  );
};

const SocialButtonGroup = () => (
  <YStack>
    <XStack justifyContent="center">
      <XStack space="$3" paddingVertical="$3" my="$3">
        <SocialButton icon="OnekeyBrand" url={ONEKEY_URL} />
        <SocialButton icon="DiscordBrand" url={DISCORD_URL} />
        <SocialButton icon="Xbrand" url={TWITTER_URL} />
        <SocialButton icon="GithubBrand" url={GITHUB_URL} />
      </XStack>
    </XStack>
    <XStack justifyContent="center" py="$4">
      <SizableText
        selectable={false}
        color="$textSubdued"
        onPress={handleOpenDevMode}
      >
        Version: {platformEnv.version ?? 'Unknown'}
      </SizableText>
    </XStack>
  </YStack>
);

export default function SettingListModal() {
  return (
    <Page>
      <ScrollView>
        <Stack pb="$2">
          <DefaultSection />
          <PreferenceSection />
          <SecuritySection />
          <AdvancedSection />
          <ResourceSection />
          <DevSettingsSection />
          <SocialButtonGroup />
        </Stack>
      </ScrollView>
    </Page>
  );
}
