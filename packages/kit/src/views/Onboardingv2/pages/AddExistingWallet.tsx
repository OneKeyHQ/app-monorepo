import { StyleSheet } from 'react-native';

import type { IKeyOfIcons } from '@onekeyhq/components';
import { Icon, Page, SizableText, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';

import { OnboardingLayout } from '../components/OnboardingLayout';

export default function AddExistingWallet() {
  const navigation = useAppNavigation();

  const DATA: {
    title: string;
    icon: IKeyOfIcons;
    description?: string | string[];
    onPress?: () => void;
  }[] = [
    {
      title: 'Transfer',
      icon: 'MultipleDevicesOutline',
      description: 'Safely transfer wallets between devices',
    },
    {
      title: 'Import phrase or private key',
      icon: 'SecretPhraseOutline',
      onPress: () => {
        navigation.push(EOnboardingPagesV2.ImportPhraseOrPrivateKey);
      },
    },
    {
      title: 'OneKey KeyTag',
      icon: 'OnekeyKeytagOutline',
    },
    {
      title: 'OneKey Lite',
      icon: 'OnekeyLiteOutline',
    },
    {
      title: 'iCloud',
      icon: 'CloudOutline',
      onPress: () => {
        navigation.push(EOnboardingPagesV2.ICloudBackup);
      },
    },
    {
      title: 'Watch-only address',
      icon: 'EyeOutline',
      description: [
        "👀 Watch other's transactions. ",
        '🙅 You cannot manage the wallet.',
      ],
    },
  ];

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header title="Add Existing Wallet" />
        <OnboardingLayout.Body>
          {DATA.map(({ title, icon, description, onPress }) => (
            <ListItem
              key={title}
              gap="$3"
              bg="$bg"
              $platform-web={{
                boxShadow:
                  '0 0 0 1px rgba(0, 0, 0, 0.04), 0 0 2px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
              }}
              $theme-dark={{
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: '$neutral3',
              }}
              $platform-native={{
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: '$borderSubdued',
              }}
              borderRadius="$5"
              borderCurve="continuous"
              p="$3"
              m="$0"
              onPress={onPress}
              userSelect="none"
            >
              <YStack
                borderRadius="$2"
                borderCurve="continuous"
                bg="$neutral2"
                borderWidth={StyleSheet.hairlineWidth}
                borderColor="$neutral2"
                p="$2"
              >
                <Icon name={icon} />
              </YStack>
              <YStack gap={2} flex={1}>
                <SizableText size="$bodyMdMedium">{title}</SizableText>
                {description ? (
                  <SizableText size="$bodySm" color="$textSubdued">
                    {Array.isArray(description)
                      ? description.join('\n')
                      : description}
                  </SizableText>
                ) : null}
              </YStack>
              <Icon name="ChevronRightSmallOutline" color="$iconDisabled" />
            </ListItem>
          ))}
        </OnboardingLayout.Body>
      </OnboardingLayout>
    </Page>
  );
}
