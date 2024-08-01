import { useCallback } from 'react';

import {
  HeaderIconButton,
  IconButton,
  SizableText,
  XStack,
  useMedia,
  useShare,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { OpenInAppButton } from '@onekeyhq/kit/src/components/OpenInAppButton';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { EOneKeyDeepLinkPath } from '@onekeyhq/shared/src/consts/deeplinkConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
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

  const media = useMedia();
  return (
    <XStack alignItems="center">
      {/* use navigation built-in back button */}
      {/* <Back /> */}
      <SizableText size="$headingLg">
        {accountUtils.shortenAddress({ address: account?.address })}
      </SizableText>
      {platformEnv.isDev && media.gtLg ? (
        <SizableText
          ml="$4"
          onPress={() => {
            void backgroundApiProxy.serviceAccount.removeAccount({
              account,
            });
          }}
        >
          {account?.id || ''} {account?.name || ''}
        </SizableText>
      ) : null}
    </XStack>
  );
}

function OpenInAppButtonContainer() {
  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });

  const buildDeepLinkUrl = useCallback(
    () =>
      account && network
        ? uriUtils.buildDeepLinkUrl({
            path: EOneKeyDeepLinkPath.url_account,
            query: {
              networkCode: network.code,
              address: account.address,
            },
          })
        : '',
    [account, network],
  );

  const buildFullUrl = useCallback(
    async () =>
      account && network
        ? buildUrlAccountFullUrl({
            account,
            network,
          })
        : 'n',
    [account, network],
  );

  if (!account?.address || !network?.id) {
    return null;
  }

  return (
    <OpenInAppButton
      buildDeepLinkUrl={buildDeepLinkUrl}
      buildFullUrl={buildFullUrl}
    />
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
      <OpenInAppButtonContainer />
    </AccountSelectorProviderMirror>
  );
}

function ShareButton() {
  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });
  const { shareText } = useShare();

  if (!account?.address || !network?.id) {
    return null;
  }
  return (
    <HeaderIconButton
      onPress={async () => {
        const text = await buildUrlAccountFullUrl({
          account,
          network,
        });
        await shareText(text);
      }}
      icon="ShareOutline"
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
