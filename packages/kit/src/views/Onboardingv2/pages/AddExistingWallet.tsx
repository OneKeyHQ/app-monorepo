import { StyleSheet } from 'react-native';

import type { IKeyOfIcons } from '@onekeyhq/components';
import { Icon, Page, SizableText, XStack, YStack } from '@onekeyhq/components';

import { renderOnboardingHeaderRight } from '../components/HeaderRight';
import { PageContainer } from '../components/PageContainer';

export default function AddExistingWallet() {
  const DATA: {
    title: string;
    icon: IKeyOfIcons;
    description?: string | string[];
  }[] = [
    {
      title: 'Transfer',
      icon: 'MultipleDevicesOutline',
      description: 'Safely transfer wallets between devices',
    },
    {
      title: 'Import phrase or private key',
      icon: 'SecretPhraseOutline',
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
      <Page.Header
        title="Add Existing Wallet"
        headerRight={renderOnboardingHeaderRight}
      />
      <Page.Body>
        <PageContainer>
          {DATA.map(({ title, icon, description }) => (
            <XStack
              key={title}
              animation="quick"
              animateOnly={['transform', 'backgroundColor']}
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
              alignItems="center"
              hoverStyle={{
                bg: '$bgSubdued',
              }}
              pressStyle={{
                scale: 0.985,
              }}
              onPress={() => {}}
              focusable
              focusVisibleStyle={{
                outlineColor: '$focusRing',
                outlineStyle: 'solid',
                outlineWidth: 2,
                outlineOffset: 2,
              }}
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
            </XStack>
          ))}
        </PageContainer>
      </Page.Body>
    </Page>
  );
}
