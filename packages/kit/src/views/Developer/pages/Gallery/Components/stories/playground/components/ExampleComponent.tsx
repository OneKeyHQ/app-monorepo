import type { ComponentProps } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import { MotiView } from 'moti';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import type { IImageProps, IKeyOfIcons } from '@onekeyhq/components';
import {
  Anchor,
  AnimatePresence,
  Badge,
  Button,
  Divider,
  Empty,
  HeightTransition,
  Icon,
  IconButton,
  Image,
  LinearGradient,
  LottieView,
  ScrollView,
  SegmentControl,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
  useThemeValue,
} from '@onekeyhq/components';
import firmwareCheckDark from '@onekeyhq/kit/assets/onboarding/firmware-check-dark.png';
import firmwareCheck from '@onekeyhq/kit/assets/onboarding/firmware-check.png';
import genuineCheckDark from '@onekeyhq/kit/assets/onboarding/genuine-check-dark.png';
import genuineCheck from '@onekeyhq/kit/assets/onboarding/genuine-check.png';
// import gridPatternDark from '@onekeyhq/kit/assets/onboarding/grid-pattern-dark.png';
// import gridPattern from '@onekeyhq/kit/assets/onboarding/grid-pattern.png';
import logoDecorative from '@onekeyhq/kit/assets/onboarding/logo-decorative.png';
import radialGradient from '@onekeyhq/kit/assets/onboarding/radial-gradient.png';
import tinyShadowIllusion from '@onekeyhq/kit/assets/onboarding/tiny-shadow-illus.png';
import pickClassic from '@onekeyhq/kit/assets/pick-classic.png';
import pickMini from '@onekeyhq/kit/assets/pick-mini.png';
import pickPro from '@onekeyhq/kit/assets/pick-pro.png';
import pickTouch from '@onekeyhq/kit/assets/pick-touch.png';
import { ConnectionTroubleShootingAccordion } from '@onekeyhq/kit/src/components/Hardware/ConnectionTroubleShootingAccordion';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { TermsAndPrivacy } from '@onekeyhq/kit/src/views/Onboarding/pages/GetStarted/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import proAvatar from '@onekeyhq/shared/src/assets/wallet/avatar/ProBlack.png';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { HwWalletAvatarImages } from '@onekeyhq/shared/src/utils/avatarUtils';
import externalWalletLogoUtils from '@onekeyhq/shared/src/utils/externalWalletLogoUtils';
import { EHardwareTransportType } from '@onekeyhq/shared/types';

import type { LayoutChangeEvent } from 'react-native';

const ContainerHeader = ({ children }: { children?: React.ReactNode }) => (
  <XStack
    h="$6"
    px={56}
    borderWidth={0}
    borderTopWidth={1}
    borderBottomWidth={1}
    borderStyle="dashed"
    borderColor="$neutral4"
    alignItems="center"
  >
    {children}
  </XStack>
);

const ContainerClose = () => (
  <IconButton size="small" icon="CrossedLargeOutline" variant="tertiary" />
);

const ContainerBack = () => (
  <IconButton size="small" icon="ArrowLeftOutline" variant="tertiary" />
);

const ContainerLanguage = () => (
  <Button size="small" icon="GlobusOutline" variant="tertiary" ml="auto">
    English
  </Button>
);

const ContainerTitle = ({ children }: { children: React.ReactNode }) => (
  <SizableText
    size="$headingLg"
    textAlign="center"
    position="absolute"
    left="50%"
    style={{ transform: [{ translateX: '-50%' }] }}
  >
    {children}
  </SizableText>
);

const ContainerBody = ({
  children,
  scrollable = true,
}: {
  children: React.ReactNode;
  scrollable?: boolean;
}) => {
  return (
    <YStack
      px="$10"
      flex={1}
      borderWidth={0}
      borderTopWidth={1}
      borderBottomWidth={1}
      borderStyle="dashed"
      borderColor="$neutral4"
      overflow="hidden"
    >
      {scrollable ? <ScrollView>{children}</ScrollView> : children}
      {scrollable ? (
        <LinearGradient
          position="absolute"
          left={41}
          right={41}
          bottom={0}
          h="$10"
          colors={['$transparent', '$bgApp']}
        />
      ) : null}
    </YStack>
  );
};

function ContainerContent({
  children,
  ...rest
}: { children: React.ReactNode } & ComponentProps<typeof YStack>) {
  return (
    <YStack
      animation="quick"
      animateOnly={['opacity', 'transform']}
      enterStyle={{
        opacity: 0,
        x: 24,
      }}
      w="100%"
      maxWidth={400}
      alignSelf="center"
      py="$10"
      gap="$5"
      {...rest}
    >
      {children}
    </YStack>
  );
}

function ContainerFooter({ children }: { children?: React.ReactNode }) {
  return (
    <YStack
      h="$6"
      borderWidth={0}
      borderTopWidth={1}
      borderBottomWidth={1}
      borderStyle="dashed"
      borderColor="$neutral4"
      justifyContent="center"
      alignItems="center"
    >
      {children}
    </YStack>
  );
}

const ContainerRoot = ({ children }: { children: React.ReactNode }) => (
  <Stack
    w="100%"
    h="1080px"
    bg="$bgApp"
    borderRadius={40}
    borderWidth={1}
    borderColor="$borderStrong"
  >
    <YStack h="100%" px="$10">
      <YStack
        py="$10"
        h="100%"
        borderWidth={0}
        borderLeftWidth={1}
        borderRightWidth={1}
        borderStyle="dashed"
        borderColor="$neutral4"
      >
        <YStack h="100%" gap="$10" mx="$-10">
          {children}
        </YStack>
      </YStack>
    </YStack>
  </Stack>
);

export const Container = Object.assign(ContainerRoot, {
  Header: ContainerHeader,
  Body: ContainerBody,
  Content: ContainerContent,
  Footer: ContainerFooter,
  Close: ContainerClose,
  Language: ContainerLanguage,
  Back: ContainerBack,
  Title: ContainerTitle,
});

function GridBackground({
  gridSize,
  lineColor,
  ...rest
}: {
  gridSize: number;
  lineColor: string;
} & ComponentProps<typeof YStack>) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width: layoutWidth, height: layoutHeight } =
      event.nativeEvent.layout;
    setDimensions({ width: layoutWidth, height: layoutHeight });
  };

  const cols = Math.floor(dimensions.width / gridSize);
  const rows = Math.floor(dimensions.height / gridSize);

  return (
    <YStack onLayout={handleLayout} {...rest}>
      {Array.from({ length: rows + 1 }).map((_, index) => (
        <YStack
          key={`horizontal-${index}`}
          position="absolute"
          w="100%"
          h="$px"
          top={index * gridSize}
          bg={lineColor}
        />
      ))}

      {Array.from({ length: cols + 1 }).map((_, index) => (
        <YStack
          key={`vertical-${index}`}
          position="absolute"
          w="$px"
          h="100%"
          left={index * gridSize}
          bg={lineColor}
        />
      ))}
    </YStack>
  );
}

export const ExampleComponent = () => {
  const DEVICE_SIZE = 24;
  const themeVariant = useThemeVariant();

  const DEVICE_DATA: (keyof typeof HwWalletAvatarImages)[] = [
    themeVariant === 'light' ? `${EDeviceType.Pro}White` : EDeviceType.Pro,
    EDeviceType.Classic,
    EDeviceType.Touch,
    EDeviceType.Mini,
  ];

  return (
    <Container>
      <Container.Header>
        <Container.Close />
        <Container.Language />
      </Container.Header>
      <Container.Body scrollable={false}>
        <YStack gap={53} flex={1} justifyContent="center" alignItems="center">
          {/* <Image
            source={themeVariant === 'light' ? gridPattern : gridPatternDark}
            position="absolute"
            left="50%"
            top="$0"
            style={{
              width: 1200,
              height: 640,
              transform: [{ translateX: '-50%' }],
              zIndex: 0,
            }}
          /> */}

          <YStack>
            <YStack
              width={640}
              height={640}
              position="absolute"
              left="50%"
              top="50%"
              style={{
                transform: [{ translateX: '-50%' }, { translateY: '-50%' }],
              }}
              overflow="hidden"
            >
              <GridBackground
                w="100%"
                h="100%"
                gridSize={40}
                lineColor="$neutral4"
              />
              <Svg
                height="100%"
                width="100%"
                style={{
                  position: 'absolute',
                  inset: 0,
                }}
              >
                <Defs>
                  <RadialGradient id="grad" cx="50%" cy="50%">
                    <Stop
                      offset="0%"
                      stopColor={useThemeValue('$bgApp')}
                      stopOpacity="0"
                    />
                    <Stop
                      offset="50%"
                      stopColor={useThemeValue('$bgApp')}
                      stopOpacity="0.5"
                    />
                    <Stop
                      offset="100%"
                      stopColor={useThemeValue('$bgApp')}
                      stopOpacity="1"
                    />
                  </RadialGradient>
                </Defs>
                <Rect
                  x="0"
                  y="0"
                  width="100%"
                  height="100%"
                  fill="url(#grad)"
                />
              </Svg>
            </YStack>
            <YStack
              $platform-web={{
                boxShadow:
                  '0 8px 12px 0 rgba(4, 31, 0, 0.08), 0 1px 2px 0 rgba(4, 31, 0, 0.10), 0 0 2px 0 rgba(4, 31, 0, 0.10)',
              }}
              $platform-native={{
                elevation: 1,
              }}
              borderRadius={13}
            >
              <Image
                source={logoDecorative}
                width={58}
                height={58}
                zIndex={1}
              />
            </YStack>
          </YStack>
          <Stack gap="$4" minWidth="$80" zIndex={1}>
            <Button size="large" variant="primary" alignSelf="stretch">
              <XStack alignItems="center" gap="$2">
                <YStack
                  w="$5"
                  h={DEVICE_SIZE}
                  overflow="hidden"
                  alignItems="center"
                >
                  <MotiView
                    from={{
                      translateY: 0,
                    }}
                    animate={{
                      translateY: Array.from(
                        { length: DEVICE_DATA.length },
                        (_, index) => ({
                          type: 'spring',
                          // mass: 1,
                          // stiffness: 400,
                          // damping: 48,
                          value: -index * DEVICE_SIZE,
                          delay: 1000,
                        }),
                      ),
                    }}
                    transition={{
                      loop: true,
                    }}
                  >
                    <YStack>
                      {DEVICE_DATA.map((device, index) => (
                        <WalletAvatar
                          key={index}
                          wallet={undefined}
                          img={device}
                          size={DEVICE_SIZE}
                        />
                      ))}
                    </YStack>
                  </MotiView>
                </YStack>
                <SizableText size="$bodyLgMedium" color="$textInverse">
                  Get started
                </SizableText>
              </XStack>
            </Button>
            <Button
              bg="$gray3"
              hoverStyle={{ bg: '$gray4' }}
              pressStyle={{ bg: '$gray5' }}
              size="large"
              icon="PlusLargeOutline"
            >
              Create or import wallet
            </Button>
          </Stack>
        </YStack>
      </Container.Body>
      <Container.Footer>
        <TermsAndPrivacy />
      </Container.Footer>
    </Container>
  );
};

export const AnotherExample = () => {
  const intl = useIntl();
  const DEVICES = [
    {
      name: 'OneKey Pro',
      image: pickPro,
    },
    {
      name: 'OneKey Classic',
      tags: ['1S', '1S Pure'],
      image: pickClassic,
    },
    {
      name: 'OneKey Touch',
      image: pickTouch,
    },
    {
      name: 'OneKey Mini',
      image: pickMini,
    },
  ];

  return (
    <Container>
      <Container.Header>
        <Container.Back />
        <Container.Language />
        <Container.Title>Pick your device</Container.Title>
      </Container.Header>
      <Container.Body scrollable={false}>
        <XStack h="100%" flexWrap="wrap" gap="$px" bg="$neutral3">
          {DEVICES.map(({ name, tags, image }) => (
            <YStack
              key={name}
              animateOnly={['backgroundColor']}
              animation="quick"
              flexGrow={1}
              flexBasis={0}
              minWidth="45%"
              bg="$bgApp"
              hoverStyle={{ bg: '$bgSubdued' }}
              onPress={() => {}}
              userSelect="none"
              p="$10"
              gap="$3"
              group
            >
              <SizableText size="$heading2xl">{name}</SizableText>
              {tags?.length ? (
                <XStack gap="$2">
                  {tags.map((tag) => (
                    <YStack
                      key={tag}
                      px="$2"
                      py="$1"
                      borderRadius="$1"
                      borderCurve="continuous"
                      borderWidth={1}
                      borderColor="$borderActive"
                    >
                      <SizableText size="$bodySmMedium">{tag}</SizableText>
                    </YStack>
                  ))}
                </XStack>
              ) : null}
              <YStack
                position="absolute"
                w="50%"
                top={0}
                right={0}
                bottom={0}
                alignItems="center"
                justifyContent="center"
              >
                <Image
                  $group-hover={{
                    y: -4,
                  }}
                  style={{
                    transition:
                      'transform 150ms cubic-bezier(.455, .03, .515, .955)',
                  }}
                  source={image}
                  width="100%"
                  height="100%"
                  resizeMode="contain"
                />
              </YStack>
            </YStack>
          ))}
        </XStack>
      </Container.Body>
      <Container.Footer>
        <XStack
          px="$5"
          py="$0.5"
          mt="auto"
          justifyContent="center"
          alignItems="center"
        >
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              // eslint-disable-next-line spellcheck/spell-checker
              id: ETranslations.global_onekey_prompt_dont_have_yet,
            })}
          </SizableText>
          <Anchor
            display="flex"
            color="$text"
            hoverStyle={{
              color: '$textSubdued',
            }}
            href="https://bit.ly/3YsKilK"
            target="_blank"
            size="$bodySm"
            p="$2"
            pl="$0"
            style={{
              textDecoration: 'none',
            }}
          >
            {intl.formatMessage({ id: ETranslations.global_buy_one })}
          </Anchor>
        </XStack>
      </Container.Footer>
    </Container>
  );
};

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
}: { children: React.ReactNode } & ComponentProps<typeof SizableText>) {
  return (
    <SizableText size="$bodyMdMedium" {...rest}>
      {children}
    </SizableText>
  );
}

function CardBody({
  children,
  ...rest
}: { children: React.ReactNode } & ComponentProps<typeof YStack>) {
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

export const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Title: CardTitle,
  Body: CardBody,
});

export const CreateOrImportWallet = () => {
  const [expanded, setExpanded] = useState(false);

  const walletKeys = ['metamask', 'okx', 'rainbow', 'tokenpocket'] as const;

  const handleExpand = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  return (
    <Container>
      <Container.Header>
        <Container.Back />
        <Container.Title>Create or import wallet</Container.Title>
        <Container.Language />
      </Container.Header>
      <Container.Body>
        <Container.Content>
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
              <Button size="small" minWidth="$20">
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
        </Container.Content>
      </Container.Body>
      <Container.Footer />
    </Container>
  );
};

export function AddExitingWallet() {
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
    <Container>
      <Container.Header>
        <Container.Back />
        <Container.Title>Add existing wallet</Container.Title>
        <Container.Language />
      </Container.Header>
      <Container.Body>
        <Container.Content>
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
        </Container.Content>
      </Container.Body>
      <Container.Footer />
    </Container>
  );
}

function ConnectionIndicatorCard({ children }: { children: React.ReactNode }) {
  return (
    <YStack
      borderRadius={10}
      borderCurve="continuous"
      $platform-web={{
        boxShadow: '0 1px 1px 0 rgba(0, 0, 0, 0.20)',
      }}
      bg="$bg"
    >
      {children}
    </YStack>
  );
}

function ConnectionIndicatorAnimation({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <YStack h={320} overflow="hidden">
      {children}
    </YStack>
  );
}

function ConnectionIndicatorContent({
  children,
  ...rest
}: {
  children: React.ReactNode;
} & ComponentProps<typeof YStack>) {
  return (
    <YStack
      px="$5"
      py="$4"
      borderWidth={0}
      borderTopWidth={StyleSheet.hairlineWidth}
      borderTopColor="$borderSubdued"
      borderStyle="dashed"
      {...rest}
    >
      {children}
    </YStack>
  );
}

function ConnectionIndicatorTitle({ children }: { children: React.ReactNode }) {
  return <SizableText size="$bodyMdMedium">{children}</SizableText>;
}

function connectionIndicatorFooter({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <YStack
      pt="$5"
      pb="$2"
      gap="$2"
      animation="quick"
      animateOnly={['opacity']}
      enterStyle={{
        opacity: 0,
      }}
    >
      <Image
        source={radialGradient}
        position="absolute"
        left="50%"
        bottom="0"
        style={{
          transform: [{ translateX: '-50%' }, { translateY: '50%' }],
        }}
        width={520}
        height={226}
        zIndex={0}
      />
      {children}
    </YStack>
  );
}

function TroubleShootingButton({ type }: { type: 'usb' | 'bluetooth' }) {
  const [showHelper, setShowHelper] = useState(false);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowHelper(true);
    }, 10_000);

    return () => clearTimeout(timer);
  }, [showHelper]);

  return (
    <>
      {showHelper ? (
        <YStack
          bg="$bgSubdued"
          $platform-web={{
            boxShadow:
              '0 1px 1px 0 rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(0, 0, 0, 0.05), 0 4px 6px 0 rgba(0, 0, 0, 0.04), 0 24px 68px 0 rgba(0, 0, 0, 0.05), 0 2px 3px 0 rgba(0, 0, 0, 0.04)',
          }}
          $theme-dark={{
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: '$neutral3',
            bg: '$neutral3',
          }}
          $platform-native={{
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: '$neutral3',
          }}
          borderRadius="$2.5"
          borderCurve="continuous"
          overflow="hidden"
        >
          <HeightTransition initialHeight={0}>
            <XStack
              animation="quick"
              animateOnly={['opacity']}
              enterStyle={{ opacity: 0 }}
              m="0"
              px="$5"
              py="$2"
              hoverStyle={{
                bg: '$bgHover',
              }}
              focusable
              focusVisibleStyle={{
                outlineColor: '$focusRing',
                outlineStyle: 'solid',
                outlineWidth: 2,
                outlineOffset: 2,
              }}
              userSelect="none"
              onPress={() => setShowTroubleshooting(!showTroubleshooting)}
            >
              <SizableText size="$bodyMd" color="$textSubdued" flex={1}>
                Having trouble connecting your device?
              </SizableText>
              <Icon
                name={
                  showTroubleshooting ? 'MinusSmallOutline' : 'PlusSmallOutline'
                }
                size="$5"
                color="$iconSubdued"
              />
            </XStack>
          </HeightTransition>
          {showTroubleshooting ? (
            <ConnectionTroubleShootingAccordion connectionType={type} />
          ) : null}
        </YStack>
      ) : null}
    </>
  );
}

function ConnectionIndicatorRoot({ children }: { children: React.ReactNode }) {
  return (
    <YStack
      $platform-web={{
        boxShadow:
          '0 1px 1px 0 rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(0, 0, 0, 0.05), 0 4px 6px 0 rgba(0, 0, 0, 0.04), 0 24px 68px 0 rgba(0, 0, 0, 0.05), 0 2px 3px 0 rgba(0, 0, 0, 0.04)',
      }}
      $theme-dark={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '$neutral3',
        bg: '$neutral3',
      }}
      $platform-native={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '$neutral3',
      }}
      overflow="hidden"
      borderRadius={10}
      borderCurve="continuous"
      bg="$bgSubdued"
      animation="quick"
      animateOnly={['opacity', 'transform']}
      enterStyle={{
        opacity: 0,
        x: 24,
      }}
    >
      {children}
    </YStack>
  );
}

export const ConnectionIndicator = Object.assign(ConnectionIndicatorRoot, {
  Animation: ConnectionIndicatorAnimation,
  Card: ConnectionIndicatorCard,
  Content: ConnectionIndicatorContent,
  Title: ConnectionIndicatorTitle,
  Footer: connectionIndicatorFooter,
});

function USBConnectionIndicator() {
  const [{ hardwareTransportType }] = useSettingsPersistAtom();

  return (
    <>
      <TroubleShootingButton type="usb" />
      <ConnectionIndicator>
        <ConnectionIndicator.Card>
          <ConnectionIndicator.Animation>
            <SizableText>Placeholder</SizableText>
          </ConnectionIndicator.Animation>
          <ConnectionIndicator.Content gap="$2">
            <ConnectionIndicator.Title>
              Connect OneKey Pro to your computer via USB
            </ConnectionIndicator.Title>
            {hardwareTransportType === EHardwareTransportType.WEBUSB ? (
              <>
                <SizableText color="$textSubdued">
                  Click the button below then select your device in the popup to
                  connect
                </SizableText>
                <Button variant="primary" onPress={() => {}} mt="$2">
                  Start connection
                </Button>
              </>
            ) : null}
          </ConnectionIndicator.Content>
        </ConnectionIndicator.Card>
      </ConnectionIndicator>
    </>
  );
}

function BluetoothConnectionIndicator() {
  const intl = useIntl();
  const [bluetoothStatus, _setBluetoothStatus] = useState<
    | 'enabled'
    | 'disabledInSystem'
    | 'disabledInApp'
    | 'checking'
    | 'noSystemPermission'
  >('enabled');
  const [devices, setDevices] = useState<
    Array<{ id: string; name: string; type: string }>
  >([]);

  // Simulate loading devices after a delay
  const handleToggleDevices = useCallback(() => {
    if (devices.length > 0) {
      setDevices([]);
    } else {
      setDevices([
        { id: '1', name: 'Pro 062B', type: EDeviceType.Pro },
        { id: '2', name: 'Classic 1A3F', type: EDeviceType.Classic },
      ]);
    }
  }, [devices.length]);

  if (bluetoothStatus === 'disabledInApp') {
    return (
      <Empty
        title={intl.formatMessage({ id: ETranslations.bluetooth_disabled })}
        description={intl.formatMessage({
          id: ETranslations.bluetooth_enable_in_app_settings,
        })}
        buttonProps={{
          variant: 'primary',
          children: intl.formatMessage({
            id: ETranslations.onboarding_enable_bluetooth,
          }),
        }}
      />
    );
  }

  if (bluetoothStatus === 'noSystemPermission') {
    return (
      <Empty
        title={intl.formatMessage({
          id: ETranslations.onboarding_bluetooth_permission_needed,
        })}
        description={intl.formatMessage({
          id: ETranslations.bluetooth_permission_prompt,
        })}
        buttonProps={{
          variant: 'primary',
          children: intl.formatMessage({
            id: ETranslations.global_go_to_settings,
          }),
        }}
      />
    );
  }

  if (bluetoothStatus === 'disabledInSystem') {
    return (
      <Empty
        title={intl.formatMessage({ id: ETranslations.bluetooth_disabled })}
        description={intl.formatMessage({
          id: ETranslations.bluetooth_enable_in_system_settings,
        })}
        buttonProps={{
          variant: 'primary',
          children: intl.formatMessage({
            id: ETranslations.onboarding_enable_bluetooth,
          }),
        }}
      />
    );
  }

  return (
    <>
      <TroubleShootingButton type="bluetooth" />
      <ConnectionIndicator>
        <ConnectionIndicator.Card>
          <ConnectionIndicator.Animation>
            <YStack
              w="100%"
              h="100%"
              alignItems="center"
              justifyContent="center"
            >
              <YStack
                position="absolute"
                w={420}
                h={420}
                left="50%"
                top="50%"
                transform={[{ translateX: '-50%' }, { translateY: '-50%' }]}
                p={60}
                flex={1}
                borderWidth={3}
                borderColor="$neutral1"
                borderRadius="$full"
              >
                <YStack
                  p={50}
                  flex={1}
                  borderWidth={2}
                  borderColor="$neutral2"
                  borderRadius="$full"
                >
                  <YStack
                    flex={1}
                    borderWidth={1}
                    borderColor="$neutral3"
                    borderRadius="$full"
                  />
                </YStack>
              </YStack>
              <LottieView
                source={require('@onekeyhq/kit/assets/animations/bluetooth_signal_spreading.json')}
                width={320}
                height={320}
              />
            </YStack>
          </ConnectionIndicator.Animation>
          <ConnectionIndicator.Content>
            <ConnectionIndicator.Title>
              Keep your device near the computer to pair
            </ConnectionIndicator.Title>
          </ConnectionIndicator.Content>
        </ConnectionIndicator.Card>
        <ConnectionIndicator.Footer>
          <YStack px="$5">
            <XStack alignItems="center" justifyContent="space-between">
              <SizableText color="$textDisabled">
                Looking for your device...
              </SizableText>
              <Button
                size="small"
                variant="tertiary"
                onPress={handleToggleDevices}
              >
                {devices.length > 0 ? 'Delete data' : 'Mock data'}
              </Button>
            </XStack>
          </YStack>
          <HeightTransition initialHeight={0}>
            {devices.length > 0 ? (
              <>
                {devices.map((device) => (
                  <ListItem
                    key={device.id}
                    drillIn
                    onPress={() => {
                      console.log('clicked', device);
                    }}
                    userSelect="none"
                  >
                    <WalletAvatar wallet={undefined} img={device.type as any} />
                    <ListItem.Text primary={device.name} flex={1} />
                  </ListItem>
                ))}
              </>
            ) : null}
          </HeightTransition>
        </ConnectionIndicator.Footer>
      </ConnectionIndicator>
    </>
  );
}

function QRCodeConnectionIndicator() {
  return (
    <ConnectionIndicator>
      <ConnectionIndicator.Card>
        <ConnectionIndicator.Animation>
          <SizableText>Placeholder</SizableText>
        </ConnectionIndicator.Animation>
        <ConnectionIndicator.Content gap="$4">
          <SizableText>
            Swipe up and choose Connect App Wallet → QR Code → OneKey App.
          </SizableText>
          <SizableText>Tap below to scan the QR code.</SizableText>
          <Button variant="primary" onPress={() => {}}>
            Scan QR code
          </Button>
        </ConnectionIndicator.Content>
      </ConnectionIndicator.Card>
    </ConnectionIndicator>
  );
}

export function ConnectDevice() {
  const [value, setValue] = useState('usb');

  return (
    <Container>
      <Container.Header>
        <Container.Back />
        <Container.Title>Connect your device</Container.Title>
        <Container.Language />
      </Container.Header>
      <Container.Body>
        <Container.Content>
          <SegmentControl
            fullWidth
            value={value}
            onChange={(v) => setValue(v as string)}
            options={[
              { label: 'USB', value: 'usb' },
              { label: 'Bluetooth', value: 'bluetooth' },
              { label: 'QR Code', value: 'qr' },
            ]}
          />
          {value === 'usb' ? <USBConnectionIndicator /> : null}
          {value === 'bluetooth' ? <BluetoothConnectionIndicator /> : null}
          {value === 'qr' ? <QRCodeConnectionIndicator /> : null}
        </Container.Content>
      </Container.Body>
      <Container.Footer />
    </Container>
  );
}

const DEVICE_SETUP_INSTRUCTIONS = [
  {
    title: 'Choose your setup option',
    details: [
      'Create New Wallet: If this is your first wallet',
      'Import Wallet: If you have an existing recovery phrase',
    ],
  },
  {
    title: 'Setup PIN',
    details: [
      'Set a PIN of at least 4 on your device',
      "Remember this PIN — you'll need it to unlock your device",
    ],
  },
  {
    title: 'Setup recovery phrase',
    details: [
      "If you don't have a recovery phrase yet, write down the one shown on your device",
      'If you already have one, make sure it matches',
      'Keep your device charging during the process',
      'Do not power off or lock the device',
    ],
  },
];

export function CheckAndUpdate() {
  const themeVariant = useThemeVariant();
  const [steps, setSteps] = useState<
    {
      image: IImageProps['source'];
      id: string;
      title: string;
      description?: string;
      state?: 'idle' | 'inProgress' | 'warning' | 'success' | 'error';
      neededAction?: boolean;
    }[]
  >([
    {
      id: 'genuine-check',
      image: themeVariant === 'light' ? genuineCheck : genuineCheckDark,
      title: 'Genuine check',
      description: 'Make sure your OneKey Pro is authentic',
      state: 'idle',
    },
    {
      id: 'firmware-check',
      image: themeVariant === 'light' ? firmwareCheck : firmwareCheckDark,
      title: 'Firmware check',
      description: 'See if your OneKey Pro has the latest software',
      state: 'idle',
    },
    {
      id: 'setup-on-device',
      image: proAvatar,
      title: 'Device setup check',
      description: 'Checking wallet initialization on device',
      state: 'idle',
    },
  ]);

  const handleCheck = useCallback(() => {
    // Set first step to inProgress
    setSteps((prev) => {
      const newSteps = [...prev];
      newSteps[0] = { ...newSteps[0], state: 'inProgress' };
      return newSteps;
    });

    // Simulate first check completing after 2 seconds
    setTimeout(() => {
      setSteps((prev) => {
        const newSteps = [...prev];
        newSteps[0] = {
          ...newSteps[0],
          state: 'error',
        };
        // Start second step
        // newSteps[1] = { ...newSteps[1], state: 'inProgress' };
        return newSteps;
      });
    }, 2000);
  }, []);

  const handleRetry = useCallback(() => {
    // Set first step to inProgress
    setSteps((prev) => {
      const newSteps = [...prev];
      newSteps[0] = { ...newSteps[0], state: 'inProgress' };
      return newSteps;
    });

    // After 2 seconds, set first step to success and start second step
    setTimeout(() => {
      setSteps((prev) => {
        const newSteps = [...prev];
        newSteps[0] = {
          ...newSteps[0],
          state: 'success',
        };
        newSteps[1] = { ...newSteps[1], state: 'inProgress' };
        return newSteps;
      });

      // After another 2 seconds, set firmware check to warning
      setTimeout(() => {
        setSteps((prev) => {
          const newSteps = [...prev];
          newSteps[1] = { ...newSteps[1], state: 'warning' };
          return newSteps;
        });
      }, 2000);
    }, 2000);
  }, []);

  const handleDeviceSetupDone = useCallback(() => {
    // Set setup-on-device step to inProgress
    setSteps((prev) => {
      const newSteps = [...prev];
      newSteps[2] = { ...newSteps[2], state: 'inProgress' };
      return newSteps;
    });

    // After 2 seconds, set it to success
    setTimeout(() => {
      setSteps((prev) => {
        const newSteps = [...prev];
        newSteps[2] = { ...newSteps[2], state: 'success' };
        return newSteps;
      });
    }, 2000);
  }, []);

  return (
    <Container>
      <Container.Header>
        <Container.Back />
        <Container.Title>Check & Update</Container.Title>
        <Container.Language />
      </Container.Header>
      <Container.Body>
        <Container.Content gap="$10">
          {steps.map((step, index) => {
            // Don't show setup-on-device until firmware-check is completed
            if (step.id === 'setup-on-device' && steps[1].state !== 'success') {
              return null;
            }

            return (
              <YStack key={step.title}>
                <AnimatePresence>
                  {step.state &&
                  step.state !== 'success' &&
                  step.state !== 'idle' ? (
                    <YStack
                      animation="quick"
                      animateOnly={['opacity', 'transform']}
                      enterStyle={{
                        opacity: 0,
                        scale: 0.97,
                      }}
                      exitStyle={{
                        opacity: 0,
                        scale: 0.97,
                      }}
                      position="absolute"
                      left={-16}
                      top={-16}
                      right={-16}
                      bottom={-16}
                      bg="$bgSubdued"
                      borderRadius="$4"
                      borderCurve="continuous"
                      $platform-web={{
                        boxShadow:
                          '0 0 0 1px rgba(0, 0, 0, 0.04), 0 0 2px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                      }}
                      zIndex={0}
                    />
                  ) : null}
                </AnimatePresence>
                {index !== steps.length - 1 &&
                !(
                  steps[index + 1]?.id === 'setup-on-device' &&
                  steps[1].state !== 'success'
                ) ? (
                  <YStack
                    w={2}
                    borderWidth={0}
                    borderLeftWidth={2}
                    borderStyle="dashed"
                    borderColor="$neutral3"
                    position="absolute"
                    left={31}
                    top={64}
                    bottom={-40}
                  />
                ) : null}
                <XStack alignItems="center" gap="$5">
                  <YStack
                    w="$16"
                    h="$16"
                    borderRadius="$2"
                    bg="$bg"
                    borderCurve="continuous"
                    $platform-web={{
                      boxShadow:
                        '0 1px 1px 0 rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(0, 0, 0, 0.05), 0 4px 6px 0 rgba(0, 0, 0, 0.04), 0 24px 68px 0 rgba(0, 0, 0, 0.05), 0 2px 3px 0 rgba(0, 0, 0, 0.04)',
                    }}
                    $theme-dark={{
                      bg: '$whiteA1',
                      borderWidth: 1,
                      borderColor: '$neutral3',
                    }}
                    $platform-native={{
                      borderWidth: 1,
                      borderColor: '$neutral3',
                    }}
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Image
                      source={step.image}
                      width={step.id === 'setup-on-device' ? 48 : 64}
                      height={step.id === 'setup-on-device' ? 48 : 64}
                    />
                    {step.state !== 'idle' ? (
                      <YStack
                        position="absolute"
                        right={-9}
                        bottom={-9}
                        w={26}
                        h={26}
                        borderWidth={1}
                        bg="$bg"
                        borderRadius="$full"
                        borderColor="$borderSubdued"
                        alignItems="center"
                        justifyContent="center"
                      >
                        <AnimatePresence exitBeforeEnter initial={false}>
                          {step.state === 'inProgress' ? (
                            <Spinner
                              key="spinner"
                              size="small"
                              animation="quick"
                              enterStyle={{ scale: 0.7, opacity: 0 }}
                              exitStyle={{ scale: 0.7, opacity: 0 }}
                              scale={0.8}
                            />
                          ) : null}
                          {step.state === 'error' ? (
                            <YStack
                              animation="quick"
                              enterStyle={{ scale: 0.8, opacity: 0 }}
                              exitStyle={{ scale: 0.8, opacity: 0 }}
                              key="error"
                            >
                              <Icon
                                name="CrossedSmallOutline"
                                color="$iconCritical"
                                size="$5"
                              />
                            </YStack>
                          ) : null}
                          {step.state === 'warning' ? (
                            <YStack
                              animation="quick"
                              enterStyle={{ scale: 0.8, opacity: 0 }}
                              exitStyle={{ scale: 0.8, opacity: 0 }}
                              key="warning"
                            >
                              <Icon
                                name="InfoCircleOutline"
                                color="$iconInfo"
                                size="$5"
                              />
                            </YStack>
                          ) : null}
                          {step.state === 'success' ? (
                            <YStack
                              animation="quick"
                              enterStyle={{ scale: 0.8, opacity: 0 }}
                              exitStyle={{ scale: 0.8, opacity: 0 }}
                              key="checkmark"
                            >
                              <Icon
                                name="Checkmark2SmallOutline"
                                color="$iconSuccess"
                                size="$5"
                              />
                            </YStack>
                          ) : null}
                        </AnimatePresence>
                      </YStack>
                    ) : null}
                  </YStack>
                  <YStack gap="$1" flex={1}>
                    <SizableText size="$headingSm">{step.title}</SizableText>
                    {step.description ? (
                      <SizableText color="$textSubdued">
                        {step.description}
                      </SizableText>
                    ) : null}
                  </YStack>
                </XStack>
                <HeightTransition initialHeight={0}>
                  {step.id === 'setup-on-device' && step.state === 'warning' ? (
                    <YStack pt="$8" gap="$5">
                      <SizableText size="$bodyMdMedium" color="$textInfo">
                        Let's get your device set up.
                      </SizableText>
                      {DEVICE_SETUP_INSTRUCTIONS.map((instruction, idx) => (
                        <YStack key={instruction.title} gap="$5">
                          <Divider />
                          <YStack gap={instruction.details ? '$2' : undefined}>
                            <XStack gap="$2">
                              <YStack
                                w="$5"
                                h="$5"
                                borderRadius="$1"
                                borderCurve="continuous"
                                bg="$bgStrong"
                                alignItems="center"
                                justifyContent="center"
                              >
                                <SizableText textAlign="center">
                                  {idx + 1}
                                </SizableText>
                              </YStack>
                              <SizableText size="$bodyMdMedium" flex={1}>
                                {instruction.title}
                              </SizableText>
                            </XStack>
                            {instruction.details?.map((detail) => (
                              <XStack key={detail} gap="$2">
                                <YStack
                                  w="$5"
                                  h="$5"
                                  alignItems="center"
                                  justifyContent="center"
                                >
                                  <YStack
                                    w={5}
                                    h={5}
                                    borderRadius="$full"
                                    bg="$iconDisabled"
                                  />
                                </YStack>
                                <SizableText color="$textSubdued" flex={1}>
                                  {detail}
                                </SizableText>
                              </XStack>
                            ))}
                          </YStack>
                        </YStack>
                      ))}
                      <Button variant="primary" onPress={handleDeviceSetupDone}>
                        Done
                      </Button>
                    </YStack>
                  ) : null}
                  {/* update */}
                  {step.id === 'firmware-check' && step.state === 'warning' ? (
                    <XStack
                      gap="$2"
                      mt="$4"
                      pt="$4"
                      borderWidth={0}
                      borderTopWidth={StyleSheet.hairlineWidth}
                      borderTopColor="$borderSubdued"
                      alignItems="center"
                    >
                      <SizableText
                        size="$bodyMdMedium"
                        color="$textInfo"
                        flex={1}
                        textAlign="left"
                      >
                        Update available
                      </SizableText>
                      <XStack gap="$2">
                        <Button variant="primary">Update</Button>
                        <Button
                          onPress={() => {
                            setSteps((prev) => {
                              const newSteps = [...prev];
                              newSteps[1] = {
                                ...newSteps[1],
                                state: 'success',
                              };
                              newSteps[2] = {
                                ...newSteps[2],
                                state: 'inProgress',
                              };
                              return newSteps;
                            });

                            // After 2 seconds, set to warning to show setup instructions
                            setTimeout(() => {
                              setSteps((prev) => {
                                const newSteps = [...prev];
                                newSteps[2] = {
                                  ...newSteps[2],
                                  state: 'warning',
                                };
                                return newSteps;
                              });
                            }, 2000);
                          }}
                        >
                          Skip
                        </Button>
                      </XStack>
                    </XStack>
                  ) : null}
                  {/* fallback */}
                  {step.state === 'error' ? (
                    <XStack
                      gap="$2"
                      mt="$4"
                      pt="$4"
                      borderWidth={0}
                      borderTopWidth={StyleSheet.hairlineWidth}
                      borderTopColor="$borderSubdued"
                      alignItems="center"
                    >
                      <SizableText
                        size="$bodyMdMedium"
                        color="$textCritical"
                        flex={1}
                        textAlign="left"
                      >
                        Something wrong
                      </SizableText>
                      <XStack gap="$2">
                        <Button variant="primary" onPress={() => handleRetry()}>
                          Retry
                        </Button>
                      </XStack>
                    </XStack>
                  ) : null}
                </HeightTransition>
              </YStack>
            );
          })}
          <AnimatePresence initial={false}>
            {!steps.some((step) => step.state !== 'idle') ? (
              <Button
                animation="quick"
                animateOnly={['opacity', 'transform']}
                variant="primary"
                size="large"
                onPress={() => handleCheck()}
                exitStyle={{
                  opacity: 0,
                  scale: 0.97,
                }}
              >
                Check my OneKey Pro
              </Button>
            ) : null}
          </AnimatePresence>
        </Container.Content>
      </Container.Body>
      <Container.Footer />
    </Container>
  );
}

const MatrixBackground = ({
  lineCount = 30,
  charsPerLine = 60,
  updateInterval = 200,
  characterSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
}: {
  lineCount?: number;
  charsPerLine?: number;
  updateInterval?: number;
  characterSet?: string;
}) => {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    // generate lines of random characters
    const generateLines = () => {
      const newLines: string[] = [];

      for (let i = 0; i < lineCount; i += 1) {
        let line = '';
        for (let j = 0; j < charsPerLine; j += 1) {
          line += characterSet[Math.floor(Math.random() * characterSet.length)];
        }
        newLines.push(line);
      }
      setLines(() => newLines);
    };

    generateLines();

    // update all characters at regular intervals
    const interval = setInterval(generateLines, updateInterval);

    return () => clearInterval(interval);
  }, [lineCount, charsPerLine, updateInterval, characterSet]);

  return (
    <YStack>
      {lines.map((line, idx) => (
        <SizableText fontFamily="$monoRegular" letterSpacing={2} key={idx}>
          {line}
        </SizableText>
      ))}
    </YStack>
  );
};

const AnimatedPath = Animated.createAnimatedComponent(Path);

const STEPS_DATA = [
  {
    pathData:
      'M7 12V35C7 38.3138 9.6863 41 13 41H35C38.3138 41 41 38.3138 41 35V23C41 19.6863 38.3138 17 35 17H33M7 12C7 14.7614 9.23858 17 12 17H33M7 12C7 9.23858 9.23858 7 12 7H28.6666C31.06 7 33 8.9401 33 11.3333V17M35 29C35 31.2091 33.2091 33 31 33C28.7909 33 27 31.2091 27 29C27 26.7909 28.7909 25 31 25C33.2091 25 35 26.7909 35 29Z',
    title: 'Creating your wallet',
  },
  {
    pathData:
      'M31 19V12C31 8.134 27.866 5 24 5C20.134 5 17 8.134 17 12V19M24 28V34M15 43H33C36.3138 43 39 40.3138 39 37V25C39 21.6862 36.3138 19 33 19H15C11.6863 19 9 21.6862 9 25V37C9 40.3138 11.6863 43 15 43Z',
    title: 'Encrypted your data',
  },
  {
    pathData:
      'M43 24C43 34.4934 34.4934 43 24 43C13.5066 43 5 34.4934 5 24C5 13.5066 13.5066 5 24 5C34.4934 5 43 13.5066 43 24Z M22 14.7624C23.2376 14.0479 24.7624 14.0479 26 14.7624L31 17.6491C32.2376 18.3636 33 19.6842 33 21.1133V26.8865C33 28.3155 32.2376 29.6361 31 30.3505L26 33.2373C24.7624 33.9517 23.2376 33.9517 22 33.2373L17 30.3505C15.7624 29.6361 15 28.3155 15 26.8865V21.1133C15 19.6842 15.7624 18.3636 17 17.6491L22 14.7624Z',
    title: 'Creating addresses',
  },
];

export function CreatingWallet() {
  const [currentStep, setCurrentStep] = useState(0);
  const progress = useSharedValue(0);
  const pathLength = 150;

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(
      1,
      {
        duration: 2000,
        easing: Easing.inOut(Easing.ease),
      },
      (finished) => {
        if (finished) {
          runOnJS(setCurrentStep)((prev) => {
            if (prev < STEPS_DATA.length - 1) {
              return prev + 1;
            }
            return prev;
          });
        }
      },
    );
  }, [currentStep, progress]);

  const animatedProps = useAnimatedProps(() => {
    // eslint-disable-next-line spellcheck/spell-checker
    const strokeDashoffset = pathLength * (1 - progress.value);

    return {
      // eslint-disable-next-line spellcheck/spell-checker
      strokeDashoffset,
      // eslint-disable-next-line spellcheck/spell-checker
      strokeDasharray: pathLength,
    };
  });

  const currentStepData = STEPS_DATA[currentStep];

  return (
    <Container>
      <Container.Header />
      <Container.Body scrollable={false}>
        <YStack
          position="absolute"
          left="50%"
          top="50%"
          transform={[{ translateX: '-50%' }, { translateY: '-50%' }]}
          opacity={0.15}
        >
          <MatrixBackground />
          <Svg
            height="100%"
            width="100%"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              right: 0,
              bottom: 0,
            }}
          >
            <Defs>
              <RadialGradient id="grad" cx="50%" cy="50%">
                <Stop
                  offset="0%"
                  stopColor={useThemeValue('$bgApp')}
                  stopOpacity="0"
                />
                <Stop
                  offset="50%"
                  stopColor={useThemeValue('$bgApp')}
                  stopOpacity="0.5"
                />
                <Stop
                  offset="100%"
                  stopColor={useThemeValue('$bgApp')}
                  stopOpacity="1"
                />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#grad)" />
          </Svg>
        </YStack>
        <YStack flex={1} alignItems="center" justifyContent="center" gap="$6">
          <YStack>
            <Image
              position="absolute"
              $theme-dark={{
                opacity: 0.5,
              }}
              bottom={0}
              left="50%"
              style={{
                transform: [{ translateX: '-50%' }, { translateY: '50%' }],
              }}
              source={tinyShadowIllusion}
              w={87}
              h={49}
            />
            <YStack
              w="$16"
              h="$16"
              bg="$bg"
              borderRadius="$2"
              borderCurve="continuous"
              alignItems="center"
              justifyContent="center"
              $platform-web={{
                boxShadow:
                  '0 1px 1px 0 rgba(0, 0, 0, 0.05), 0 0 0 2px rgba(0, 0, 0, 0.10), 0 4px 6px 0 rgba(0, 0, 0, 0.04), 0 24px 68px 0 rgba(0, 0, 0, 0.05), 0 2px 3px 0 rgba(0, 0, 0, 0.04)',
              }}
              $theme-dark={{
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: '$borderSubdued',
              }}
              $platform-native={{
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: '$borderSubdued',
              }}
            >
              <LinearGradient
                colors={['$neutral1', '$neutral4']}
                start={{ x: 1, y: 0 }}
                end={{ x: 1, y: 1 }}
                w="$14"
                h="$14"
                borderRadius="$1"
                borderCurve="continuous"
                alignItems="center"
                justifyContent="center"
                borderWidth={1}
                borderColor="$borderSubdued"
              >
                <AnimatePresence exitBeforeEnter initial={false}>
                  <YStack
                    key={`icon-${currentStep}`}
                    animation="quick"
                    animateOnly={['transform', 'opacity']}
                    enterStyle={{
                      y: 4,
                      opacity: 0,
                    }}
                    exitStyle={{
                      y: -4,
                      opacity: 0,
                    }}
                  >
                    <Svg width="48" height="48" viewBox="0 0 48 48">
                      <Path
                        d={currentStepData.pathData}
                        stroke={useThemeValue('$borderDisabled')}
                        strokeWidth="2"
                        fill="none"
                      />

                      <AnimatedPath
                        d={currentStepData.pathData}
                        stroke={useThemeValue('$borderActive')}
                        fill="none"
                        stroke-width="2"
                        stroke-linecap="square"
                        stroke-linejoin="round"
                        animatedProps={animatedProps}
                      />
                    </Svg>
                  </YStack>
                </AnimatePresence>
              </LinearGradient>
            </YStack>
          </YStack>
          <AnimatePresence exitBeforeEnter initial={false}>
            <SizableText
              key={`title-${currentStep}`}
              size="$heading2xl"
              textAlign="center"
              animation="quick"
              animateOnly={['transform', 'opacity']}
              enterStyle={{
                y: 8,
                opacity: 0,
              }}
              exitStyle={{
                y: -8,
                opacity: 0,
              }}
            >
              {currentStepData.title}
            </SizableText>
          </AnimatePresence>
        </YStack>
      </Container.Body>
      <Container.Footer />
    </Container>
  );
}

export function ImportPhraseOrPrivateKey() {
  const [selected, setSelected] = useState<'phrase' | 'privateKey'>('phrase');
  return (
    <Container>
      <Container.Header>
        <Container.Back />
        <Container.Title>Import Phrase or Private Key</Container.Title>
        <Container.Language />
      </Container.Header>
      <Container.Body>
        <Container.Content gap="$10">
          <SegmentControl
            value={selected}
            fullWidth
            options={[
              { label: 'Recovery phrase', value: 'phrase' },
              { label: 'Private Key', value: 'privateKey' },
            ]}
            onChange={(value) => setSelected(value as 'phrase' | 'privateKey')}
          />
          <HeightTransition>
            {selected === 'phrase' ? (
              <YStack
                key="phrase"
                animation="quick"
                animateOnly={['opacity']}
                enterStyle={{
                  opacity: 0,
                }}
              >
                <SizableText>
                  Amet reprehenderit aute aute exercitation et consectetur ut
                  sit excepteur. Culpa eiusmod sunt ea proident eiusmod dolore
                  aliquip pariatur veniam minim incididunt fugiat do ipsum
                  commodo. Enim velit qui aliquip pariatur dolor Lorem ipsum
                  adipisicing voluptate ad excepteur.
                </SizableText>
              </YStack>
            ) : (
              <YStack
                key="privateKey"
                animation="quick"
                animateOnly={['opacity']}
                enterStyle={{
                  opacity: 0,
                }}
              >
                <SizableText>Private Key</SizableText>
              </YStack>
            )}
          </HeightTransition>
          <Button size="large" variant="primary">
            Confirm
          </Button>
        </Container.Content>
      </Container.Body>
      <Container.Footer />
    </Container>
  );
}
