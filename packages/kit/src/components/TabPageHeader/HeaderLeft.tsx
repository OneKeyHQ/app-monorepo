import { type ReactNode, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  NavBackButton,
  Page,
  SizableText,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import { AccountSelectorActiveAccountHome } from '@onekeyhq/kit/src/components/AccountSelector';
import { NetworkSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector/NetworkSelectorTrigger';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import useListenTabFocusState from '../../hooks/useListenTabFocusState';
import {
  AccountSelectorProviderMirror,
  AccountSelectorTriggerHome,
} from '../AccountSelector';
import { useSpotlight } from '../Spotlight';

import { UrlAccountPageHeader } from './urlAccountPageHeader';

export function HeaderLeftCloseButton() {
  return (
    <Page.Close>
      <NavBackButton />
    </Page.Close>
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
  const intl = useIntl();
  const { tourTimes, tourVisited } = useSpotlight(
    ESpotlightTour.switchDappAccount,
  );
  const { gtMd } = useMedia();

  const [isFocus, setIsFocus] = useState(false);

  useListenTabFocusState(
    ETabRoutes.Home,
    async (focus: boolean, hideByModal: boolean) => {
      setIsFocus(!hideByModal && focus);
    },
  );
  const spotlightVisible = useMemo(
    () => tourTimes === 1 && isFocus,
    [isFocus, tourTimes],
  );
  const items = useMemo(() => {
    if (customHeaderLeftItems) {
      return customHeaderLeftItems;
    }
    if (sceneName === EAccountSelectorSceneName.homeUrlAccount) {
      return (
        <XStack gap="$1.5">
          <HeaderLeftCloseButton />
          {platformEnv.isNativeIOS ? <UrlAccountPageHeader /> : null}
        </XStack>
      );
    }

    const accountSelectorTrigger = (
      <AccountSelectorTriggerHome
        num={0}
        key="accountSelectorTrigger"
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

    if (tabRoute === ETabRoutes.Discovery) {
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
        {tabRoute === ETabRoutes.Home && gtMd ? (
          <NetworkSelectorTriggerHome
            num={0}
            recordNetworkHistoryEnabled
            hideOnNoAccount
          />
        ) : null}
        <AccountSelectorActiveAccountHome
          num={0}
          showAccountAddress={false}
          showCopyButton={tabRoute === ETabRoutes.Home}
          showCreateAddressButton={false}
          showNoAddressTip={false}
        />
      </XStack>
    );
  }, [
    gtMd,
    intl,
    sceneName,
    spotlightVisible,
    tabRoute,
    tourVisited,
    customHeaderLeftItems,
  ]);
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName,
        sceneUrl: '',
      }}
    >
      {items}
    </AccountSelectorProviderMirror>
  );
}
