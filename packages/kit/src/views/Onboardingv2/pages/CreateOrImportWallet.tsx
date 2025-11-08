import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { ISizableTextProps, IYStackProps } from '@onekeyhq/components';
import {
  AnimatePresence,
  Badge,
  Button,
  HeightTransition,
  Icon,
  Image,
  Page,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { generateMnemonic } from '@onekeyhq/core/src/secret';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  EModalRoutes,
  EOnboardingPages,
  EOnboardingPagesV2,
} from '@onekeyhq/shared/src/routes';
import externalWalletLogoUtils from '@onekeyhq/shared/src/utils/externalWalletLogoUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { OnboardingLayout } from '../components/OnboardingLayout';

function CardHeader({ children }: { children: React.ReactNode }) {
  return (
    <XStack alignItems="center" p="$5" gap="$3" bg="$neutral2">
      {children}
    </XStack>
  );
}

function CardTitle({
  children,
  ...rest
}: { children: React.ReactNode } & ISizableTextProps) {
  return (
    <SizableText size="$bodyMdMedium" {...rest}>
      {children}
    </SizableText>
  );
}

function CardBody({
  children,
  ...rest
}: { children: React.ReactNode } & IYStackProps) {
  return (
    <YStack
      borderTopWidth={StyleSheet.hairlineWidth}
      borderTopColor="$neutral3"
      p="$5"
      {...rest}
    >
      {children}
    </YStack>
  );
}

function CardRoot({
  children,
  onPress,
  ...rest
}: { children: React.ReactNode } & IYStackProps & { onPress?: () => void }) {
  return (
    <YStack
      $theme-dark={{
        borderWidth: 1,
        borderColor: '$borderSubdued',
      }}
      borderRadius="$5"
      borderCurve="continuous"
      $platform-native={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '$borderSubdued',
      }}
      $platform-web={{
        boxShadow:
          '0 0.5px 0.5px 0 rgba(255, 255, 255, 0.1) inset, 0 0 0 1px rgba(0, 0, 0, 0.04), 0 0 2px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      }}
      hoverStyle={{
        bg: '$neutral2',
      }}
      pressStyle={{
        bg: '$neutral3',
      }}
      focusable
      focusVisibleStyle={{
        outlineColor: '$focusRing',
        outlineStyle: 'solid',
        outlineWidth: 2,
        outlineOffset: -2,
      }}
      userSelect="none"
      overflow="hidden"
      onPress={onPress}
      {...rest}
    >
      {children}
    </YStack>
  );
}

const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Title: CardTitle,
  Body: CardBody,
});

export default function CreateOrImportWallet() {
  const intl = useIntl();
  const [expanded, setExpanded] = useState(false);

  const walletKeys = ['metamask', 'okx', 'rainbow', 'tokenpocket'] as const;
  const navigation = useAppNavigation();

  const handleExpand = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const handleCreateNewWallet = useCallback(async () => {
    await backgroundApiProxy.servicePassword.promptPasswordVerify();
    const mnemonic = generateMnemonic();
    const encodedMnemonic =
      await backgroundApiProxy.servicePassword.encodeSensitiveText({
        text: mnemonic,
      });
    navigation.push(EOnboardingPagesV2.FinalizeWalletSetup, {
      mnemonic: encodedMnemonic,
      isWalletBackedUp: false,
    });
  }, [navigation]);

  const handleAddExistingWallet = () => {
    navigation.push(EOnboardingPagesV2.AddExistingWallet);
  };

  const handleConnectExternalWallet = () => {
    // navigation.push(EOnboardingPagesV2.ConnectWalletSelectNetworks);
    navigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.ConnectWalletSelectNetworks,
    });
    defaultLogger.account.wallet.onboard({
      onboardMethod: 'connect3rdPartyWallet',
    });
  };

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header
          title={intl.formatMessage({
            id: ETranslations.onboarding_create_or_import_wallet,
          })}
        />
        <OnboardingLayout.Body constrained={false}>
          <OnboardingLayout.ConstrainedContent>
            <Card onPress={handleCreateNewWallet}>
              <Card.Header>
                <YStack
                  w={38}
                  h={38}
                  alignItems="center"
                  justifyContent="center"
                  borderRadius="$2"
                  borderCurve="continuous"
                  borderWidth={StyleSheet.hairlineWidth}
                  borderColor="$neutral5"
                  bg="$brand8"
                >
                  <Icon name="PlusLargeOutline" color="$iconOnColor" />
                </YStack>
                <YStack gap="$0.5" flex={1} alignItems="flex-start">
                  <Card.Title>
                    {intl.formatMessage({
                      id: ETranslations.onboarding_create_new_wallet,
                    })}
                  </Card.Title>
                  <Button
                    px="$1"
                    py="$0.5"
                    mx="$-1"
                    my="$-0.5"
                    borderWidth={0}
                    size="small"
                    variant="tertiary"
                    onPress={handleExpand}
                    hitSlop={10}
                    childrenAsText={false}
                  >
                    <XStack alignItems="center">
                      <SizableText size="$bodySm" color="$textSubdued">
                        {intl.formatMessage({
                          id: ETranslations.global_learn_more,
                        })}
                      </SizableText>
                      <YStack
                        animation="quick"
                        animateOnly={['transform']}
                        rotate={expanded ? '0' : '90deg'}
                      >
                        <Icon
                          name="ChevronRightSmallOutline"
                          size="$4"
                          color="$iconDisabled"
                        />
                      </YStack>
                    </XStack>
                  </Button>
                </YStack>
                <Icon name="ChevronRightSmallOutline" color="$iconSubdued" />
              </Card.Header>
              <Card.Body>
                <XStack gap="$2" flexWrap="wrap">
                  {[
                    {
                      id: ETranslations.create_new_wallet_badge_most_used,
                      badge: 'success' as const,
                    },
                    { id: ETranslations.create_new_wallet_badge_consists },
                    { id: ETranslations.create_new_wallet_badge_metaphor },
                    { id: ETranslations.create_new_wallet_badge_keep },
                    { id: ETranslations.create_new_wallet_badge_handwritten },
                    { id: ETranslations.create_new_wallet_badge_supports },
                  ].map((item, index) => (
                    <Badge
                      key={index}
                      {...(item.badge && { badgeType: item.badge })}
                    >
                      <Badge.Text size="$bodySm">
                        {intl.formatMessage({ id: item.id })}
                      </Badge.Text>
                    </Badge>
                  ))}
                </XStack>
                <HeightTransition initialHeight={0}>
                  <AnimatePresence>
                    {expanded ? (
                      <YStack
                        pt="$5"
                        animation="quick"
                        animateOnly={['opacity']}
                        enterStyle={{
                          opacity: 0,
                        }}
                        exitStyle={{
                          opacity: 0,
                        }}
                      >
                        <SizableText size="$bodySm" color="$textSubdued">
                          {intl.formatMessage({
                            id: ETranslations.create_new_wallet_learn_more,
                          })}
                        </SizableText>
                      </YStack>
                    ) : null}
                  </AnimatePresence>
                </HeightTransition>
              </Card.Body>
            </Card>
            <Card onPress={handleAddExistingWallet}>
              <Card.Header>
                <YStack
                  w={38}
                  h={38}
                  alignItems="center"
                  justifyContent="center"
                  borderRadius="$2"
                  borderCurve="continuous"
                  borderWidth={StyleSheet.hairlineWidth}
                  borderColor="$neutral5"
                  bg="$info9"
                >
                  <Icon name="ArrowBottomOutline" color="$iconOnColor" />
                </YStack>
                <YStack gap="$0.5" flex={1} alignItems="flex-start">
                  <Card.Title>
                    {intl.formatMessage({
                      id: ETranslations.add_existing_wallet_title,
                    })}
                  </Card.Title>
                  <SizableText size="$bodySm" color="$textSubdued">
                    {intl.formatMessage({
                      id: ETranslations.add_existing_wallet_desc,
                    })}
                  </SizableText>
                </YStack>
                <Icon name="ChevronRightSmallOutline" color="$iconSubdued" />
              </Card.Header>
              <Card.Body>
                <XStack gap="$2" flexWrap="wrap">
                  {[
                    ETranslations.add_existing_wallet_badge_phrases_length,
                    ETranslations.create_new_wallet_badge_supports,
                  ].map((id, index) => (
                    <Badge key={index}>
                      <Badge.Text size="$bodySm">
                        {intl.formatMessage({ id })}
                      </Badge.Text>
                    </Badge>
                  ))}
                  <Badge>
                    <Badge.Text size="$bodySm">
                      {intl.formatMessage({
                        id: ETranslations.global_supports,
                      })}
                    </Badge.Text>
                    <XStack gap="$1" ml="$1">
                      {walletKeys.map((key) => (
                        <Image
                          key={key}
                          source={externalWalletLogoUtils.getLogoInfo(key).logo}
                          width={12}
                          height={12}
                          borderRadius={3}
                        />
                      ))}
                    </XStack>
                  </Badge>
                </XStack>
              </Card.Body>
            </Card>
            <Card onPress={handleConnectExternalWallet}>
              <Card.Header>
                <XStack
                  w={38}
                  h={38}
                  p={3}
                  gap={2}
                  alignItems="center"
                  justifyContent="center"
                  flexWrap="wrap"
                  borderRadius="$2"
                  borderCurve="continuous"
                  borderWidth={StyleSheet.hairlineWidth}
                  borderColor="$neutral2"
                  bg="$neutral2"
                >
                  {walletKeys.map((key) => (
                    <Image
                      key={key}
                      source={externalWalletLogoUtils.getLogoInfo(key).logo}
                      width={14}
                      height={14}
                      borderRadius={5}
                    />
                  ))}
                </XStack>
                <Card.Title flex={1}>
                  {intl.formatMessage({
                    id: ETranslations.onboarding_connect_external_wallet,
                  })}
                </Card.Title>
                <Icon name="ChevronRightSmallOutline" color="$iconSubdued" />
              </Card.Header>
            </Card>
          </OnboardingLayout.ConstrainedContent>
        </OnboardingLayout.Body>
      </OnboardingLayout>
    </Page>
  );
}
