import { useRoute } from '@react-navigation/core';

import {
  Anchor,
  Button,
  EVideoResizeMode,
  Page,
  SizableText,
  Video,
  XStack,
} from '@onekeyhq/components';
import type {
  EOnboardingPagesV2,
  IOnboardingParamListV2,
} from '@onekeyhq/shared/src/routes/onboardingv2';

import { OnboardingLayout } from '../components/OnboardingLayout';

import { ConnectionIndicator } from './ConnectYourDevice';

import type { RouteProp } from '@react-navigation/core';

export default function ConnectQRCode() {
  const params =
    useRoute<
      RouteProp<IOnboardingParamListV2, EOnboardingPagesV2.ConnectQRCode>
    >();
  const { deviceType } = params?.params || {};

  console.log('ConnectQRCode page, deviceType:', deviceType);

  const STEPS = [
    'Select Connect App Wallet on home screen',
    'Tap "•••" button on the top right, then tap continue',
    'Select OneKey App',
    'Tap show QR code button',
    'Tap below to scan the QR code',
  ];

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header title="Connect with QR Code" />
        <OnboardingLayout.Body>
          <ConnectionIndicator>
            <ConnectionIndicator.Card>
              <ConnectionIndicator.Animation>
                <Video
                  w="100%"
                  h="100%"
                  repeat
                  resizeMode={EVideoResizeMode.COVER}
                  controls={false}
                  playInBackground={false}
                  source={require('@onekeyhq/kit/assets/onboarding/onBoarding-QR.mp4')}
                />
              </ConnectionIndicator.Animation>
              <ConnectionIndicator.Content gap="$4">
                {STEPS.map((step, index) => (
                  <XStack key={index}>
                    <SizableText w="$6">{index + 1}.</SizableText>
                    <SizableText flex={1} flexShrink={1}>
                      {step}
                    </SizableText>
                  </XStack>
                ))}
                <Button mt="$2" variant="primary" onPress={() => {}}>
                  Scan QR code
                </Button>
              </ConnectionIndicator.Content>
            </ConnectionIndicator.Card>
          </ConnectionIndicator>
        </OnboardingLayout.Body>
        <OnboardingLayout.Footer>
          <Anchor
            href="https://help.onekey.so/articles/11461088"
            target="_blank"
            size="$bodySm"
            color="$textSubdued"
          >
            Learn more about QR-based wallet
          </Anchor>
        </OnboardingLayout.Footer>
      </OnboardingLayout>
    </Page>
  );
}
