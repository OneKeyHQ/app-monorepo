import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  HeaderIconButton,
  IconButton,
  NATIVE_HIT_SLOP,
  SizableText,
  Tooltip,
  XStack,
  useShare,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { OpenInAppButton } from '@onekeyhq/kit/src/components/OpenInAppButton';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useCopyAddressWithDeriveType } from '@onekeyhq/kit/src/hooks/useCopyAccountAddress';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { EOneKeyDeepLinkPath } from '@onekeyhq/shared/src/consts/deeplinkConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
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

function Address({ enableCopy = false }: { enableCopy?: boolean }) {
  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num: 0 });
  const intl = useIntl();
  const copyAddressWithDeriveType = useCopyAddressWithDeriveType();

  const handleCopyAddress = useCallback(async () => {
    if (!account?.address) return;

    let networkName = network?.name;
    if (
      network?.isAllNetworks &&
      accountUtils.isOthersWallet({ walletId: wallet?.id ?? '' }) &&
      account?.createAtNetwork
    ) {
      const createAtNetwork =
        await backgroundApiProxy.serviceNetwork.getNetworkSafe({
          networkId: account.createAtNetwork,
        });
      networkName = createAtNetwork?.shortname ?? networkName;
    }

    copyAddressWithDeriveType({
      address: account.address,
      networkName,
    });
  }, [
    account?.address,
    account?.createAtNetwork,
    copyAddressWithDeriveType,
    network?.isAllNetworks,
    network?.name,
    wallet?.id,
  ]);

  const addressContent = (
    <SizableText size="$headingLg" numberOfLines={1}>
      {accountUtils.shortenAddress({ address: account?.address })}
    </SizableText>
  );

  if (enableCopy && account?.address) {
    return (
      <Tooltip
        renderContent={intl.formatMessage({
          id: ETranslations.global_copy_address,
        })}
        placement="bottom"
        renderTrigger={
          <XStack
            alignItems="center"
            flexShrink={1}
            minWidth={0}
            onPress={handleCopyAddress}
            py="$1"
            px="$1.5"
            my="$-1"
            mx="$-1.5"
            borderRadius="$2"
            hoverStyle={{
              bg: '$bgHover',
            }}
            pressStyle={{
              bg: '$bgActive',
            }}
            focusVisibleStyle={{
              outlineColor: '$focusRing',
              outlineWidth: 2,
              outlineStyle: 'solid',
              outlineOffset: 0,
            }}
            hitSlop={NATIVE_HIT_SLOP}
            userSelect="none"
          >
            {addressContent}
          </XStack>
        }
      />
    );
  }

  return (
    <XStack alignItems="center" flexShrink={1} minWidth={0}>
      {/* use navigation built-in back button */}
      {/* <Back /> */}
      {addressContent}
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
