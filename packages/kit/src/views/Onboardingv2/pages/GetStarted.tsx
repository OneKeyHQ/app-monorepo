import { useMemo, useState } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import { MotiView } from 'moti';
import { useIntl } from 'react-intl';
import Svg, {
  Defs,
  Line,
  Pattern,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import type { IYStackProps } from '@onekeyhq/components';
import {
  BlurView,
  Button,
  Icon,
  Image,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
  useThemeValue,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';
import type { HwWalletAvatarImages } from '@onekeyhq/shared/src/utils/avatarUtils';

import { WalletAvatar } from '../../../components/WalletAvatar';
import { useThemeVariant } from '../../../hooks/useThemeVariant';
import { TermsAndPrivacy } from '../../Onboarding/pages/GetStarted/components';
import { OnboardingLayout } from '../components/OnboardingLayout';

import type { LayoutChangeEvent } from 'react-native';

const DEVICE_SIZE = 24;

// GridItem component - places items relative to center point
function GridItem({
  gridX,
  gridY,
  gridSize = 40,
  unitSize = 2,
  children,
  scale = 1,
  blur = false,
}: {
  gridX: number; // Grid unit X coordinate relative to center (negative = left, positive = right)
  gridY: number; // Grid unit Y coordinate relative to center (negative = up, positive = down)
  gridSize?: number; // Size of single grid cell (default 40px)
  unitSize?: number; // Number of cells per unit side (default 2, means 2x2=4 cells)
  children: React.ReactNode;
  blur?: boolean;
  scale?: number;
}) {
  const themeVariant = useThemeVariant();

  // Calculate the pixel size of one unit
  // unitSize=2, gridSize=40 => 2 * 40 = 80px (2x2 cells = 4 cells total)
  const unitPixelSize = gridSize * unitSize;

  // Calculate offset from center
  // Positive gridX = move right, Negative = move left
  // Positive gridY = move down, Negative = move up
  const offsetX = gridX * unitPixelSize;
  const offsetY = gridY * unitPixelSize;

  return (
    <YStack
      position="absolute"
      // Use transform to position relative to center
      // 50% moves to center, then offset by grid coordinates
      left="50%"
      top="50%"
      width={unitPixelSize}
      height={unitPixelSize}
      style={{
        transform: [
          { translateX: offsetX - unitPixelSize / 2 },
          { translateY: offsetY - unitPixelSize / 2 },
          { scale },
        ],
      }}
      alignItems="center"
      justifyContent="center"
      pointerEvents="none"
    >
      <YStack
        animation="quick"
        animateOnly={['transform']}
        enterStyle={{
          scale: 0.9,
        }}
        w="$14"
        h="$14"
        bg="$bg"
        borderRadius="$3"
        borderCurve="continuous"
        alignItems="center"
        justifyContent="center"
        $platform-native={{
          borderWidth: 1,
          borderColor: '$neutral3',
        }}
        $platform-android={{ elevation: 0.5 }}
        $platform-ios={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 0.5 },
          shadowOpacity: 0.2,
          shadowRadius: 0.5,
        }}
        $platform-web={{
          boxShadow: `0 1px 1px 0 rgba(0, 0, 0, 0.05), 0 0 0 1px ${
            themeVariant === 'light'
              ? 'rgba(0, 0, 0, 0.05)'
              : 'rgba(255, 255, 255, 0.05)'
          }, 0 2px 4px 0 rgba(0, 0, 0, 0.04), 0 12px 34px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.04)`,
        }}
        hoverStyle={{
          scale: 0.9,
        }}
      >
        {children}
      </YStack>
      {blur ? (
        <BlurView
          position="absolute"
          inset={0}
          intensity={10}
          tint={themeVariant === 'light' ? 'light' : 'dark'}
        />
      ) : null}
    </YStack>
  );
}

function GridBackground({
  gridSize,
  lineColor,
  ...rest
}: {
  gridSize: number;
  lineColor: string;
} & IYStackProps) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width: layoutWidth, height: layoutHeight } =
      event.nativeEvent.layout;
    setDimensions({ width: layoutWidth, height: layoutHeight });
  };

  // Ensure cols and rows are always even numbers for symmetry
  const cols = Math.floor(dimensions.width / gridSize / 2) * 2;
  const rows = Math.floor(dimensions.height / gridSize / 2) * 2;

  // Calculate offsets to center the grid
  const offsetX = (dimensions.width - cols * gridSize) / 2;
  const offsetY = (dimensions.height - rows * gridSize) / 2;

  return (
    <YStack onLayout={handleLayout} {...rest}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern
            id="grid"
            width={gridSize}
            height={gridSize}
            patternUnits="userSpaceOnUse"
            x={offsetX}
            y={offsetY}
          >
            {/* Horizontal line */}
            <Line
              x1="0"
              y1="0"
              x2={gridSize}
              y2="0"
              stroke={lineColor}
              strokeWidth="1"
            />
            {/* Vertical line */}
            <Line
              x1="0"
              y1="0"
              x2="0"
              y2={gridSize}
              stroke={lineColor}
              strokeWidth="1"
            />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#grid)" />
      </Svg>
    </YStack>
  );
}

export default function GetStarted() {
  const navigation = useAppNavigation();
  const handleGetStarted = () => {
    navigation.push(EOnboardingPagesV2.PickYourDevice);
  };
  const { gtMd } = useMedia();
  const intl = useIntl();

  const handleCreateOrImportWallet = () => {
    navigation.push(EOnboardingPagesV2.CreateOrImportWallet);
  };

  const themeVariant = useThemeVariant();

  const DEVICE_DATA: (keyof typeof HwWalletAvatarImages)[] = useMemo(() => {
    return [
      themeVariant === 'light' ? `${EDeviceType.Pro}White` : EDeviceType.Pro,
      EDeviceType.Classic,
      EDeviceType.Touch,
      EDeviceType.Mini,
    ];
  }, [themeVariant]);

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header showBackButton={false}>
          <OnboardingLayout.Back exit />
        </OnboardingLayout.Header>
        <OnboardingLayout.Body scrollable={false} constrained={false}>
          <YStack flex={1} justifyContent="center" alignItems="center">
            <YStack
              position="absolute"
              left={0}
              right={0}
              top={0}
              bottom={0}
              overflow="hidden"
              alignItems="center"
              justifyContent="center"
            >
              <GridBackground
                w="100%"
                h="100%"
                gridSize={40}
                lineColor={useThemeValue('$neutral6')}
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
                  <RadialGradient
                    id="grad"
                    cx="50%"
                    cy="50%"
                    rx={gtMd ? '90%' : '50%'}
                    ry={gtMd ? '30%' : '50%'}
                  >
                    <Stop
                      offset="0%"
                      stopColor={useThemeValue('$bg')}
                      stopOpacity="0"
                    />
                    <Stop
                      offset="50%"
                      stopColor={useThemeValue('$bg')}
                      stopOpacity="0.5"
                    />
                    <Stop
                      offset="100%"
                      stopColor={useThemeValue('$bg')}
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
              <YStack
                position="absolute"
                inset={0}
                animation="quick"
                animateOnly={['opacity']}
                opacity={0.5}
                enterStyle={{
                  opacity: 0,
                }}
              >
                <GridItem gridX={gtMd ? -6 : -0.5} gridY={gtMd ? -2 : 4} blur>
                  <Icon name="OpCircleIllus" size="$8" />
                </GridItem>
                <GridItem gridX={gtMd ? -3 : -1.5} gridY={-2}>
                  <Icon name="BtcCircleIllus" size="$8" />
                </GridItem>
                <GridItem
                  gridX={gtMd ? -4.5 : -1}
                  gridY={gtMd ? -0.5 : -3.5}
                  // scale={gtMd ? 1 : 0.75}
                >
                  <Icon name="TrxCircleIllus" size="$8" />
                </GridItem>
                <GridItem gridX={-3.5} gridY={2}>
                  <Icon name="SuiCircleIllus" size="$8" />
                </GridItem>
                <GridItem gridX={1} gridY={gtMd ? -3.5 : -4} blur>
                  <Icon name="SolCircleIllus" size="$8" />
                </GridItem>
                <GridItem gridX={1} gridY={3}>
                  <Icon name="ArbCircleIllus" size="$8" />
                </GridItem>
                <GridItem gridX={gtMd ? 3.5 : 1.5} gridY={gtMd ? 0 : -2.5}>
                  <Icon name="EthCircleIllus" size="$8" />
                </GridItem>
                <GridItem gridX={4.5} gridY={-2}>
                  <Icon name="MaticCircleIllus" size="$8" />
                </GridItem>
                <GridItem gridX={gtMd ? 5 : -1} gridY={gtMd ? 2 : 2.5}>
                  <Icon name="BnbCircleIllus" size="$8" />
                </GridItem>
              </YStack>
            </YStack>
            <YStack
              gap={44}
              justifyContent="center"
              alignItems="center"
              animation="quick"
              animateOnly={['opacity', 'transform']}
              enterStyle={{ opacity: 0, scale: 0.98 }}
            >
              <YStack
                $platform-web={{
                  boxShadow:
                    '0 8px 12px 0 rgba(4, 31, 0, 0.08), 0 1px 2px 0 rgba(4, 31, 0, 0.10), 0 0 2px 0 rgba(4, 31, 0, 0.10)',
                }}
                $platform-native={{
                  elevation: 1,
                }}
                borderRadius={13}
                animation="quick"
                animateOnly={['transform']}
                hoverStyle={{
                  scale: 0.95,
                }}
              >
                <Image
                  source={require('@onekeyhq/kit/assets/onboarding/logo-decorative.png')}
                  width={58}
                  height={58}
                  zIndex={1}
                />
              </YStack>
              <Stack gap="$4" minWidth="$80" zIndex={1}>
                <Button
                  size="large"
                  variant="primary"
                  alignSelf="stretch"
                  childrenAsText={false}
                  onPress={handleGetStarted}
                >
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
                      {intl.formatMessage({
                        id: ETranslations.global_get_started,
                      })}
                    </SizableText>
                  </XStack>
                </Button>
                <Button
                  bg="$gray3"
                  hoverStyle={{ bg: '$gray4' }}
                  pressStyle={{ bg: '$gray5' }}
                  size="large"
                  icon="PlusLargeOutline"
                  onPress={handleCreateOrImportWallet}
                >
                  {intl.formatMessage({
                    id: ETranslations.onboarding_create_or_import_wallet,
                  })}
                </Button>
              </Stack>
            </YStack>
          </YStack>
        </OnboardingLayout.Body>
        <OnboardingLayout.Footer>
          <TermsAndPrivacy />
        </OnboardingLayout.Footer>
      </OnboardingLayout>
    </Page>
  );
}
