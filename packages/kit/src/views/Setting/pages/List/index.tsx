import type { ComponentProps, FC } from 'react';

import { YStack } from 'tamagui';

import {
  IconButton,
  Page,
  ScrollView,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';

import { handleOpenDevMode } from '../../utils/devMode';

import { AdvancedSection } from './AdvancedSection';
import { DevSettingsSection } from './DevSettingsSection';
import { PreferenceSection } from './PreferenceSection';
import { ResourceSection } from './ResourceSection';
import { SecuritySection } from './SecuritySection';

type ISocialButtonProps = {
  icon: ComponentProps<typeof IconButton>['icon'];
};

const SocialButton: FC<ISocialButtonProps> = ({ icon }) => (
  <IconButton
    bg="$bgSubdued"
    width="$14"
    height="$14"
    icon={icon}
    borderRadius="$full"
  />
);

const SocialButtonGroup = () => (
  <YStack>
    <XStack justifyContent="center">
      <XStack space="$3" paddingVertical="$3" my="$3">
        <SocialButton icon="OnekeyBrand" />
        <SocialButton icon="DiscordBrand" />
        <SocialButton icon="Xbrand" />
        <SocialButton icon="GithubBrand" />
      </XStack>
    </XStack>
    <XStack justifyContent="center" py="$4">
      <SizableText
        selectable={false}
        color="$textSubdued"
        onPress={handleOpenDevMode}
      >
        Version: 4.18.0-2023122162
      </SizableText>
    </XStack>
  </YStack>
);

export default function SettingListModal() {
  return (
    <Page>
      <ScrollView>
        <Stack pb="$2">
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
