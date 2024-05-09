import { useMemo } from 'react';

import * as ExpoSharing from 'expo-sharing';

import {
  Button,
  Dialog,
  Icon,
  IconButton,
  QRCode,
  SizableText,
  Stack,
  XStack,
  useClipboard,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { DOWNLOAD_URL } from '@onekeyhq/shared/src/config/appConfig';
import { EOneKeyDeepLinkPath } from '@onekeyhq/shared/src/consts/deeplinkConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import openUrlUtils, {
  openUrlExternal,
} from '@onekeyhq/shared/src/utils/openUrlUtils';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  buildUrlAccountFullUrl,
  urlAccountNavigation,
} from './urlAccountUtils';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function Back() {
  const navigation = useAppNavigation();
  return (
    <IconButton
      icon="ChevronLeftSolid"
      onPress={() => {
        urlAccountNavigation.replaceHomePage(navigation);
      }}
    />
  );
}

function Address() {
  const {
    activeAccount: { account },
  } = useActiveAccount({ num: 0 });

  return (
    <XStack alignItems="center">
      {/* use navigation built-in back button */}
      {/* <Back /> */}
      <SizableText>
        {accountUtils.shortenAddress({ address: account?.address })}
      </SizableText>
    </XStack>
  );
}

function OpenInAppButton() {
  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });

  const { result: deepLinkUrl } = usePromiseResult(async () => {
    if (platformEnv.isWeb || platformEnv.isExtension) {
      if (network && account) {
        const url = uriUtils.buildDeepLinkUrl({
          path: EOneKeyDeepLinkPath.url_account,
          query: {
            networkCode: network.code,
            address: account.address,
          },
        });
        if (await openUrlUtils.linkingCanOpenURL(url)) {
          return url;
        }
      }
    }
    return '';
  }, [account, network]);

  const openByAppButtonLabel = useMemo<string | undefined>(() => {
    if (!platformEnv.isWebMobile) {
      return 'Open by OneKey Desktop';
    }
    if (platformEnv.isWebMobileAndroid) {
      return 'Open by OneKey Android';
    }

    if (platformEnv.isWebMobileIOS) {
      return 'Open by OneKey iOS';
    }
  }, []);

  if (!account?.address || !network?.id) {
    return null;
  }

  return (
    <Button
      size="small"
      onPress={() => {
        const text = buildUrlAccountFullUrl({
          account,
          network,
        });
        Dialog.show({
          title: 'Scan to open in OneKey',
          renderContent: (
            <Stack>
              <Stack
                alignItems="center"
                justifyContent="center"
                overflow="hidden"
              >
                {deepLinkUrl && openByAppButtonLabel ? (
                  <Button
                    onPress={() => {
                      console.log(
                        'URL Account openByApp deepLinkUrl',
                        deepLinkUrl,
                      );
                      void openUrlUtils.linkingOpenURL(deepLinkUrl);
                    }}
                  >
                    {openByAppButtonLabel}
                  </Button>
                ) : null}
                <QRCode value={text} logoSvg="OnekeyBrand" size={240} />
              </Stack>
              <XStack mt="$6">
                <SizableText flex={1}>Don’t have the app yet?</SizableText>
                <Button
                  size="small"
                  onPress={() => {
                    openUrlExternal(DOWNLOAD_URL);
                  }}
                >
                  Download
                </Button>
              </XStack>
            </Stack>
          ),
          showFooter: false,
        });
      }}
    >
      Open in the app
    </Button>
  );
}

function OpenInApp() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.homeUrlAccount,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <OpenInAppButton />
    </AccountSelectorProviderMirror>
  );
}

function ShareButton() {
  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });
  const { copyText } = useClipboard();

  if (!account?.address || !network?.id) {
    return null;
  }
  return (
    <IconButton
      onPress={async () => {
        const text = buildUrlAccountFullUrl({
          account,
          network,
        });
        if (await ExpoSharing.isAvailableAsync()) {
          // https://docs.expo.dev/versions/latest/sdk/sharing/
          await ExpoSharing.shareAsync(text);
        } else {
          copyText(text);
        }
      }}
      size="small"
      icon="ShareArrowSolid"
    />
  );
}
function Share() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.homeUrlAccount,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <ShareButton />
    </AccountSelectorProviderMirror>
  );
}

export const UrlAccountNavHeader = {
  Address,
  OpenInApp,
  Share,
};
