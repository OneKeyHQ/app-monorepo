import { useCallback, useState } from 'react';

import { StyleSheet } from 'react-native';

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
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';
import externalWalletLogoUtils from '@onekeyhq/shared/src/utils/externalWalletLogoUtils';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { Card } from '../components/Card';
import { renderOnboardingHeaderRight } from '../components/HeaderRight';
import { PageContainer } from '../components/PageContainer';

export default function CreateOrImportWallet() {
  const [expanded, setExpanded] = useState(false);

  const walletKeys = ['metamask', 'okx', 'rainbow', 'tokenpocket'] as const;

  const handleExpand = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);
  const navigation = useAppNavigation();

  const handleAddExistingWallet = () => {
    navigation.push(EOnboardingPagesV2.AddExistingWallet);
  };

  return (
    <Page>
      <Page.Header
        title="Create or Import Wallet"
        headerRight={renderOnboardingHeaderRight}
      />
      <Page.Body>
        <PageContainer>
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
              <Button size="small" minWidth="$20">
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
        </PageContainer>
      </Page.Body>
    </Page>
  );
}
