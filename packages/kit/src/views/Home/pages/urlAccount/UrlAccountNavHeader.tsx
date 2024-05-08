import { StackActions } from '@react-navigation/native';

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
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { DOWNLOAD_URL } from '@onekeyhq/shared/src/config/appConfig';
import { ETabHomeRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
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
                <Icon name="OnekeyBrand" width={60} height={60} color="$text" />
                <QRCode
                  value={text}
                  // logo={{
                  //   uri: network.logoURI,
                  // }}
                  size={240}
                />
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
      onPress={() => {
        const text = buildUrlAccountFullUrl({
          account,
          network,
        });
        copyText(text);
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
