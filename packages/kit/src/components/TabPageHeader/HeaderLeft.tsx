import { type ReactNode, memo, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  DebugRenderTracker,
  NavBackButton,
  Page,
  SizableText,
  XStack,
  rootNavigationRef,
  useMedia,
} from '@onekeyhq/components';
import { AccountSelectorActiveAccountHome } from '@onekeyhq/kit/src/components/AccountSelector';
import { NetworkSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector/NetworkSelectorTrigger';
import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { PERPS_NETWORK_ID } from '@onekeyhq/shared/src/consts/perp';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabHomeRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import useListenTabFocusState from '../../hooks/useListenTabFocusState';
import {
  AccountSelectorProviderMirror,
  AccountSelectorTriggerHome,
} from '../AccountSelector';
import { useSpotlight } from '../Spotlight';

import { UrlAccountPageHeader } from './urlAccountPageHeader';
import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';
import { WALLET_TYPE_HD } from '@onekeyhq/shared/src/consts/dbConsts';

export function HeaderLeftCloseButton() {
  return (
    <Page.Close>
      <NavBackButton />
    </Page.Close>
  );
}

function AccountSelectorTriggerWithSpotlight({
  isFocus,
  linkNetworkId,
  hideAddress,
}: {
  isFocus: boolean;
  linkNetworkId?: string;
  hideAddress?: boolean;
}) {
  const intl = useIntl();
  const { tourTimes, tourVisited } = useSpotlight(
    ESpotlightTour.switchDappAccount,
  );
  const [isLocked] = useAppIsLockedAtom();

  const spotlightVisible = useMemo(
    () => tourTimes === 1 && isFocus && !isLocked,
    [isFocus, isLocked, tourTimes],
  );
  return (
    <AccountSelectorTriggerHome
      num={0}
      key="accountSelectorTrigger"
      linkNetworkId={linkNetworkId}
      hideAddress={hideAddress}
      spotlightProps={{
        visible: spotlightVisible,
        content: (
          <SizableText size="$bodyMd">
            {intl.formatMessage({
              id: ETranslations.spotlight_account_alignment_desc,
            })}
          </SizableText>
        ),
        onConfirm: () => {
          void tourVisited(2);
        },
        childrenPaddingVertical: 0,
      }}
    />
  );
}

const MemoizedAccountSelectorTriggerWithSpotlight = memo(
  AccountSelectorTriggerWithSpotlight,
);

function HeaderLeftContent({
  sceneName,
  tabRoute,
  customHeaderLeftItems,
}: {
  sceneName: EAccountSelectorSceneName;
  tabRoute: ETabRoutes;
  customHeaderLeftItems?: ReactNode;
}) {
  const { gtMd } = useMedia();

  const [isFocus, setIsFocus] = useState(false);

  const {
    activeAccount: { wallet },
  } = useActiveAccount({
    num: 0,
  });

  const isWalletNotBackedUp = useMemo(() => {
    if (wallet && wallet.type === WALLET_TYPE_HD && !wallet.backuped) {
      return true;
    }
    return false;
  }, [wallet]);

  useListenTabFocusState(
    ETabRoutes.Home,
    async (focus: boolean, hideByModal: boolean) => {
      setIsFocus(!hideByModal && focus);
    },
  );
  const items = useMemo(() => {
    if (customHeaderLeftItems) {
      return customHeaderLeftItems;
    }
    if (sceneName === EAccountSelectorSceneName.homeUrlAccount) {
      return (
        <XStack gap="$1.5">
          <NavBackButton
            onPress={() => {
              rootNavigationRef.current?.navigate(
                ETabRoutes.Home,
                {
                  screen: ETabHomeRoutes.TabHome,
                },
                {
                  pop: true,
                },
              );
            }}
          />
          {platformEnv.isNativeIOS ? <UrlAccountPageHeader /> : null}
        </XStack>
      );
    }

    let linkNetworkId: string | undefined;
    let hideAddress: boolean | undefined;
    if (
      tabRoute === ETabRoutes.WebviewPerpTrade ||
      tabRoute === ETabRoutes.Perp
    ) {
      linkNetworkId = PERPS_NETWORK_ID;
      hideAddress = false;
    }

    const accountSelectorTrigger = (
      <MemoizedAccountSelectorTriggerWithSpotlight
        isFocus={isFocus}
        linkNetworkId={linkNetworkId}
        hideAddress={hideAddress}
      />
    );

    if (tabRoute === ETabRoutes.Discovery) {
      return (
        <SizableText size="$headingLg">
          {/* {intl.formatMessage({
            id: ETranslations.global_browser,
          })} */}
        </SizableText>
      );
    }

    if (tabRoute === ETabRoutes.WebviewPerpTrade) {
      return (
        <SizableText size="$headingLg">
          {/* {intl.formatMessage({
            id: ETranslations.global_browser,
          })} */}
        </SizableText>
      );
    }
    return (
      <XStack gap="$3" ai="center">
        {accountSelectorTrigger}
        {!isWalletNotBackedUp && tabRoute === ETabRoutes.Home && gtMd ? (
          <NetworkSelectorTriggerHome
            num={0}
            recordNetworkHistoryEnabled
            hideOnNoAccount
          />
        ) : null}
        {isWalletNotBackedUp ? null : (
          <AccountSelectorActiveAccountHome
            num={0}
            showAccountAddress={false}
            showCopyButton={tabRoute === ETabRoutes.Home}
            showCreateAddressButton={false}
            showNoAddressTip={false}
          />
        )}
      </XStack>
    );
  }, [
    customHeaderLeftItems,
    sceneName,
    isFocus,
    tabRoute,
    gtMd,
    isWalletNotBackedUp,
  ]);
  return (
    <DebugRenderTracker name="TabPageHeader__HeaderLeft" position="top-right">
      {items}
    </DebugRenderTracker>
  );
}

export function HeaderLeft({
  sceneName,
  tabRoute,
  customHeaderLeftItems,
}: {
  sceneName: EAccountSelectorSceneName;
  tabRoute: ETabRoutes;
  customHeaderLeftItems?: ReactNode;
}) {
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName,
        sceneUrl: '',
      }}
    >
      <HeaderLeftContent
        sceneName={sceneName}
        tabRoute={tabRoute}
        customHeaderLeftItems={customHeaderLeftItems}
      />
    </AccountSelectorProviderMirror>
  );
}
