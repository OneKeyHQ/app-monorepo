import { useMemo, useState } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import { MotiView } from 'moti';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import type { IYStackProps } from '@onekeyhq/components';
import {
  Button,
  Image,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
  useThemeValue,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';
import type { HwWalletAvatarImages } from '@onekeyhq/shared/src/utils/avatarUtils';

import { WalletAvatar } from '../../../components/WalletAvatar';
import { useThemeVariant } from '../../../hooks/useThemeVariant';
import { TermsAndPrivacy } from '../../Onboarding/pages/GetStarted/components';
import { OnboardingLayout } from '../components/OnboardingLayout';

import type { LayoutChangeEvent } from 'react-native';

const DEVICE_SIZE = 24;

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

export default function GetStarted() {
  const navigation = useAppNavigation();
  const handleGetStarted = () => {
    navigation.push(EOnboardingPagesV2.PickYourDevice);
  };

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
        <OnboardingLayout.Header />
        <OnboardingLayout.Body scrollable={false} constrained={false}>
          <YStack gap={53} flex={1} justifyContent="center" alignItems="center">
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
                  source={require('@onekeyhq/kit/assets/onboarding/logo-decorative.png')}
                  width={58}
                  height={58}
                  zIndex={1}
                />
              </YStack>
            </YStack>
            <Stack gap="$4" minWidth="$80" zIndex={1}>
              <Button
                size="large"
                variant="primary"
                alignSelf="stretch"
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
                onPress={handleCreateOrImportWallet}
              >
                Create or import wallet
              </Button>
            </Stack>
          </YStack>
        </OnboardingLayout.Body>
        <OnboardingLayout.Footer>
          <TermsAndPrivacy />
        </OnboardingLayout.Footer>
      </OnboardingLayout>
    </Page>
  );
}
