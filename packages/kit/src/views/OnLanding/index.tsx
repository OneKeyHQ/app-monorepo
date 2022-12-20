import { useCallback, useEffect, useMemo } from 'react';

import * as Linking from 'expo-linking';
import { useIntl } from 'react-intl';

import { Button, Center, Icon, Typography } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import walletConnectUtils from '../../components/WalletConnect/utils/walletConnectUtils';
import { WalletConnectUniversalLinkPath } from '../../routes/deepLink';

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
  const onDesktopDownload = useCallback(() => {
    openLinkUrl('https://onekey.so/download');
  }, [openLinkUrl]);
  const locationUrl = global?.location?.href || '';
  const autoLaunchAppUrl = useMemo(() => {
    if (!locationUrl) {
      return '';
    }
    const { queryParams, path } = Linking.parse(locationUrl);
    if (path === WalletConnectUniversalLinkPath && queryParams?.uri) {
      const linkUrl = walletConnectUtils.buildOneKeyWalletConnectDeepLinkUrl({
        uri: queryParams?.uri as string,
      });
      return linkUrl;
    }
    if (queryParams?.redirectURL) {
      return queryParams.redirectURL as string;
    }
    return '';
  }, [locationUrl]);
  const onLaunchApp = useCallback(() => {
    if (autoLaunchAppUrl) {
      // **** openLink will be blocked by browser
      // openLinkUrl(autoLaunchAppUrl);
      window.location.href = autoLaunchAppUrl;
    }
  }, [autoLaunchAppUrl]);
  useEffect(() => {
    (async () => {
      if (autoLaunchAppUrl && (await Linking.canOpenURL(autoLaunchAppUrl))) {
        onLaunchApp();
      }
    })();
  }, [autoLaunchAppUrl, onLaunchApp]);
  return (
    <Center w="full" h="full" bg="background-default">
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
          leftIconName="AppStoreMini"
          onPress={oniOSDownload}
        >
          App Store
        </Button>
        <Button
          size="xl"
          w="full"
          mt="4"
          borderRadius="full"
          leftIconName="AndroidMini"
          onPress={onAndroidDownload}
        >
          Android
        </Button>
        <Button
          size="xl"
          w="full"
          mt="4"
          borderRadius="full"
          leftIconName="DesktopComputerMini"
          onPress={onDesktopDownload}
        >
          Desktop
        </Button>
      </Center>
    </Center>
  );
}
