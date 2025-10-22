import { useMemo } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import { MotiView } from 'moti';

import {
  Button,
  Image,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';
import type { HwWalletAvatarImages } from '@onekeyhq/shared/src/utils/avatarUtils';

import { WalletAvatar } from '../../../components/WalletAvatar';
import { useThemeVariant } from '../../../hooks/useThemeVariant';
import { TermsAndPrivacy } from '../../Onboarding/pages/GetStarted/components';
import { renderOnboardingHeaderRight } from '../components/HeaderRight';

const DEVICE_SIZE = 24;

export default function GetStarted() {
  const navigation = useAppNavigation();
  const handleGetStarted = () => {
    navigation.push(EOnboardingPagesV2.PickYourDevice);
  };

  const handleCreateOrImportWallet = () => {
    console.log('Connect external wallet');
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
    <Page scrollEnabled>
      <Page.Header title="" headerRight={renderOnboardingHeaderRight} />
      <Page.Body>
        <YStack gap={31} pt={168} flex={1} alignItems="center">
          <Image
            source={
              themeVariant === 'light'
                ? require('@onekeyhq/kit/assets/onboarding/grid-pattern.png')
                : require('@onekeyhq/kit/assets/onboarding/grid-pattern-dark.png')
            }
            position="absolute"
            left="50%"
            top="$0"
            style={{
              width: 1200,
              height: 640,
              transform: [{ translateX: '-50%' }],
              zIndex: 0,
            }}
          />

          <Image
            source={require('@onekeyhq/kit/assets/onboarding/logo-decorative.png')}
            width={82.33}
            height={82}
            zIndex={1}
          />
          <Stack gap="$4" zIndex={1}>
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
              size="large"
              icon="PlusLargeOutline"
              onPress={handleCreateOrImportWallet}
            >
              Create or import wallet
            </Button>
          </Stack>
        </YStack>
        <YStack pb="$10">
          <TermsAndPrivacy />
        </YStack>
      </Page.Body>
    </Page>
  );
}
