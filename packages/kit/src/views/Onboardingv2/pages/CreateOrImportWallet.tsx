import { useCallback, useState } from 'react';

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
import {
  ensureSensitiveTextEncoded,
  generateMnemonic,
} from '@onekeyhq/core/src/secret';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';
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

function CardRoot({ children }: { children: React.ReactNode }) {
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
      overflow="hidden"
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

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header title="Create or Import Wallet" />
        <OnboardingLayout.Body>
          <Card>
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
                <Card.Title>Create new wallet</Card.Title>
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
                >
                  <XStack alignItems="center">
                    <SizableText size="$bodySm" color="$textSubdued">
                      Learn more
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
              <Button
                size="small"
                minWidth="$20"
                onPress={handleCreateNewWallet}
              >
                Create
              </Button>
            </Card.Header>
            <Card.Body>
              <XStack gap="$2" flexWrap="wrap">
                {[
                  'Most used',
                  'Recovery phrase consists of 12 words',
                  'Recovery phrase is like a “password”',
                  'Need to keep it safe yourself',
                  'Handwritten backup',
                  'Supports hundreds of networks',
                ].map((item, index) => (
                  <Badge
                    key={index}
                    {...(index === 0 && { badgeType: 'success' })}
                  >
                    <Badge.Text size="$bodySm">{item}</Badge.Text>
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
                        The recovery phrase is the core of your wallet’s
                        security. It’s made up of 12 common English words used
                        to create and restore your private key and wallet
                        address. Write it down by hand and store it safely —
                        only you have access to your assets.
                      </SizableText>
                    </YStack>
                  ) : null}
                </AnimatePresence>
              </HeightTransition>
            </Card.Body>
          </Card>
          <Card>
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
                <Card.Title>Add existing wallet</Card.Title>
                <SizableText size="$bodySm" color="$textSubdued">
                  Transfer, restore or import
                </SizableText>
              </YStack>
              <Button
                size="small"
                minWidth="$20"
                onPress={handleAddExistingWallet}
              >
                Add
              </Button>
            </Card.Header>
            <Card.Body>
              <XStack gap="$2" flexWrap="wrap">
                {[
                  'Supports 12–24 word recovery  phrases',
                  'Supports hundreds of networks',
                ].map((item, index) => (
                  <Badge key={index}>
                    <Badge.Text size="$bodySm">{item}</Badge.Text>
                  </Badge>
                ))}
                <Badge>
                  <Badge.Text size="$bodySm">Supports</Badge.Text>
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
          <Card>
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
              <YStack gap="$0.5" flex={1} alignItems="flex-start">
                <Card.Title flex={1}>Connect external wallet</Card.Title>
              </YStack>
              <Button size="small">Connect</Button>
            </Card.Header>
          </Card>
        </OnboardingLayout.Body>
      </OnboardingLayout>
    </Page>
  );
}
