/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import React from 'react';

import {
  Box,
  Button,
  Container,
  ScrollView,
  Typography,
  useToast,
} from '@onekeyhq/components';
import { analyticLogEvent } from '@onekeyhq/shared/src/analytics';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { navigationGoBack } from '../../../hooks/useAppNavigation';

let crashlytics: any | undefined;

if (platformEnv.isNative) {
  (async () => {
    const Crashlytics = await import('@react-native-firebase/crashlytics');
    crashlytics = Crashlytics.default();
  })();
}

const FirebaseGallery = () => {
  const toast = useToast();
  return (
    <ScrollView bg="background-hovered" p={4}>
      <Button onPress={navigationGoBack}>Back to HOME</Button>
      <Box pb="2" mt={6}>
        <Typography.Subheading color="text-subdued">
          分析 Analytics
        </Typography.Subheading>
      </Box>
      <Container.Box>
        <Container.Item
          title="Custom Event"
          titleColor="text-default"
          onPress={() => {
            analyticLogEvent('pv', {
              type: 'analytics',
              ONEKEY_PLATFORM: process.env.ONEKEY_PLATFORM ?? 'undefined',
              EXT_CHANNEL: process.env.EXT_CHANNEL ?? 'undefined',
              ANDROID_CHANNEL: process.env.ANDROID_CHANNEL ?? 'undefined',
              DESKTOP_PLATFORM: window?.desktopApi?.platform,
              DESKTOP_ARCH: window?.desktopApi?.arch,
            });
            toast.show({
              title: JSON.stringify({
                type: 'analytics',
                ONEKEY_PLATFORM: process.env.ONEKEY_PLATFORM ?? 'undefined',
                EXT_CHANNEL: process.env.EXT_CHANNEL ?? 'undefined',
                ANDROID_CHANNEL: process.env.ANDROID_CHANNEL ?? 'undefined',
                DESKTOP_PLATFORM: window?.desktopApi?.platform,
                DESKTOP_ARCH: window?.desktopApi?.arch,
              }),
            });
          }}
        />
      </Container.Box>

      <Box pb="2" mt={6}>
        <Typography.Subheading color="text-subdued">
          崩溃 Crashlytics
        </Typography.Subheading>
      </Box>
      <Container.Box>
        <Container.Item
          title="Set User ID"
          titleColor="text-default"
          onPress={async () => {
            await Promise.all([
              //   crashlytics().setUserId(user.uid),
              await crashlytics?.setAttributes({
                ONEKEY_PLATFORM: process.env.ONEKEY_PLATFORM ?? 'undefined',
                EXT_CHANNEL: process.env.EXT_CHANNEL ?? 'undefined',
                ANDROID_CHANNEL: process.env.ANDROID_CHANNEL ?? 'undefined',
                DESKTOP_PLATFORM: window?.desktopApi?.platform,
                DESKTOP_ARCH: window?.desktopApi?.arch,
              }),
            ]);
          }}
        />
        <Container.Item
          title="Crash Test"
          titleColor="text-default"
          onPress={async () => {
            await crashlytics?.crash();
          }}
        />
        <Container.Item
          title="Log Upload Test"
          titleColor="text-default"
          onPress={async () => {
            await crashlytics?.log('Manually Uploading Logs');
          }}
        />
      </Container.Box>
    </ScrollView>
  );
};

export default FirebaseGallery;
