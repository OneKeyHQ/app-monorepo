import React, { useCallback } from 'react';

import * as Linking from 'expo-linking';
import { useIntl } from 'react-intl';

import { Button, Center, Icon, Typography } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export default function OnLanding() {
  const intl = useIntl();
  const openLinkUrl = useCallback((url: string) => {
    if (platformEnv.isNative) {
      Linking.openURL(url);
    } else {
      window.open(url, '_blank');
    }
  }, []);
  const onAndroidDownload = useCallback(() => {
    openLinkUrl(
      'https://play.google.com/store/apps/details?id=so.onekey.app.wallet',
    );
  }, [openLinkUrl]);
  const oniOSDownload = useCallback(() => {
    openLinkUrl(
      'https://apps.apple.com/us/app/onekey-open-source-wallet/id1609559473',
    );
  }, [openLinkUrl]);
  const onLaunchApp = useCallback(() => {
    const { queryParams } = Linking.parse(global.location.href);
    if (queryParams?.redirectURL) {
      openLinkUrl(queryParams.redirectURL as string);
    }
  }, [openLinkUrl]);
  return (
    <Center w="full" h="full">
      <Center maxW="375px" w="full" p="6">
        <Icon name="BrandLogoIllus" size={90} />
        <Typography.DisplayLarge mt="8">
          {intl.formatMessage({ id: 'title__continuing_to_oneKey' })}
        </Typography.DisplayLarge>
        <Typography.Body1Strong mt="16">
          {intl.formatMessage({ id: 'title__have_installed_the_app' })}
        </Typography.Body1Strong>
        <Button
          size="xl"
          w="full"
          type="primary"
          mt="6"
          borderRadius="full"
          onPress={onLaunchApp}
        >
          {intl.formatMessage({ id: 'title__launch_onekey' })}
        </Button>
        <Typography.Body1Strong mt="16">
          {intl.formatMessage({ id: 'title__havent_installed_onekey' })}
        </Typography.Body1Strong>
        <Button
          size="xl"
          w="full"
          mt="4"
          borderRadius="full"
          leftIconName="AppStoreSolid"
          onPress={oniOSDownload}
        >
          App Store
        </Button>
        <Button
          size="xl"
          w="full"
          mt="4"
          borderRadius="full"
          leftIconName="AndroidSolid"
          onPress={onAndroidDownload}
        >
          Android
        </Button>
      </Center>
    </Center>
  );
}
