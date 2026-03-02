import type { ReactNode } from 'react';
import { useMemo } from 'react';

import { useMedia } from '@onekeyhq/components';
import { HeaderButtonGroup } from '@onekeyhq/components/src/layouts/Navigation/Header';
import { NetworkSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector/NetworkSelectorTrigger';
import { LegacyUniversalSearchInput } from '@onekeyhq/kit/src/components/TabPageHeader/LegacyUniversalSearchInput';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';
import TabCountButton from '../../views/Discovery/components/MobileBrowser/TabCountButton';
import { HistoryIconButton } from '../../views/Discovery/pages/components/HistoryIconButton';
import { AllNetworksManagerTrigger } from '../AccountSelector';
import { MoreActionButton } from '../MoreActionButton';

import {
  GiftAction,
  HeaderNotificationIconButton,
  WalletConnectionForWeb,
} from './components';

export function MoreAction() {
  return <MoreActionButton key="more-action" />;
}

export function SelectorTrigger() {
  const {
    activeAccount: { network, wallet },
  } = useActiveAccount({ num: 0 });

  if (
    network?.isAllNetworks &&
    !accountUtils.isOthersWallet({ walletId: wallet?.id ?? '' })
  ) {
    return <AllNetworksManagerTrigger num={0} unifiedMode />;
  }

  return (
    <NetworkSelectorTriggerHome
      num={0}
      size="small"
      recordNetworkHistoryEnabled
      unifiedMode
    />
  );
}

export function SearchInput({
  isUrlWallet = false,
}: { isUrlWallet?: boolean } = {}) {
  const { gtXl, gtLg, gt2xl } = useMedia();

  let size: boolean;
  if (isUrlWallet) {
    size = platformEnv.isWeb ? gt2xl : gtXl;
  } else {
    size = platformEnv.isWeb ? gtXl : gtLg;
  }

  return <LegacyUniversalSearchInput size={size ? 'large' : 'small'} />;
}

export function HeaderRight({
  selectedHeaderTab,
  sceneName,
  tabRoute,
  customHeaderRightItems,
  renderCustomHeaderRightItems,
}: {
  selectedHeaderTab?: ETranslations;
  sceneName: EAccountSelectorSceneName;
  tabRoute: ETabRoutes;
  customHeaderRightItems?: ReactNode;
  renderCustomHeaderRightItems?: ({
    fixedItems,
  }: {
    fixedItems: ReactNode;
  }) => ReactNode;
}) {
  const items = useMemo(() => {
    if (customHeaderRightItems) {
      return customHeaderRightItems;
    }

    const fixedItems = (
      <>
        <HeaderNotificationIconButton testID="header-right-notification" />
        <MoreAction />
      </>
    );

    const earnItems = (
      <>
        <GiftAction copyAsUrl />
        {fixedItems}
      </>
    );

    if (renderCustomHeaderRightItems) {
      return renderCustomHeaderRightItems({ fixedItems });
    }

    switch (tabRoute) {
      case ETabRoutes.Home: {
        if (
          platformEnv.isNative &&
          sceneName === EAccountSelectorSceneName.homeUrlAccount
        ) {
          return <SelectorTrigger />;
        }

        return (
          <>
            <SelectorTrigger />
            {fixedItems}
          </>
        );
      }
      case ETabRoutes.WebviewPerpTrade:
        return (
          <>
            <WalletConnectionForWeb tabRoute={tabRoute} />
          </>
        );
      case ETabRoutes.Market:
        return <>{fixedItems}</>;
      case ETabRoutes.Discovery:
        if (selectedHeaderTab === ETranslations.global_earn) {
          return (
            <>
              <GiftAction copyAsUrl />
            </>
          );
        }
        if (selectedHeaderTab === ETranslations.global_market) {
          return null;
        }
        // Browser tab
        return (
          <>
            <HistoryIconButton />
            {platformEnv.isNative ? (
              <TabCountButton testID="browser-header-tabs" />
            ) : null}
          </>
        );
      case ETabRoutes.Earn:
        return earnItems;
      case ETabRoutes.ReferFriends:
        return fixedItems;
      default:
        break;
    }
  }, [
    customHeaderRightItems,
    tabRoute,
    renderCustomHeaderRightItems,
    selectedHeaderTab,
    sceneName,
  ]);
  const width = useMemo(() => {
    if (platformEnv.isNative) {
      return undefined;
    }
    if (platformEnv.isDesktopMac) {
      return 'unset';
    }
    return '100%';
  }, []);
  return items ? (
    <HeaderButtonGroup
      testID="Wallet-Page-Header-Right"
      className="app-region-no-drag"
      width={width}
      jc={platformEnv.isNative ? undefined : 'flex-end'}
      flexShrink={platformEnv.isNative ? undefined : 1}
    >
      {items}
    </HeaderButtonGroup>
  ) : null;
}
