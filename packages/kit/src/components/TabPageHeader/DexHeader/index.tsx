import { useMemo, useState } from 'react';

import {
  DexHeader,
  HeaderNavigation,
  OneKeyLogo,
  XStack,
  useOnRouterChange,
} from '@onekeyhq/components';
import { ERootRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  AccountSelectorProviderMirror,
  AccountSelectorTriggerHome,
} from '../../AccountSelector';
import { HeaderNotificationIconButton, OneKeyIdButton } from '../components';
import { MoreActionButton } from '../MoreActionButton';

import { DownloadButton, LanguageButton, ThemeButton } from './components';
import { useDexHeaderNavigation } from './hooks';

export interface IDexHeaderContainerProps {
  showNotificationButton?: boolean;
  showDownloadButton?: boolean;
  showLanguageButton?: boolean;
  showThemeButton?: boolean;
  downloadUrl?: string;
  activeNavigationKey?: string;
  onNavigationChange?: (key: string) => void;
}

export function DexHeaderContainer({
  showNotificationButton = true,
  showDownloadButton = true,
  showLanguageButton = true,
  showThemeButton = true,
  downloadUrl,
  activeNavigationKey,
  onNavigationChange,
}: IDexHeaderContainerProps = {}) {
  const {
    navigationItems,
    activeNavigationKey: derivedActiveKey,
    handleNavigationChange,
  } = useDexHeaderNavigation({
    onNavigationChange,
    activeNavigationKey,
  });

  const [currentTab, setCurrentTab] = useState<ETabRoutes>(ETabRoutes.Home);

  // Listen to route changes to update active tab
  useOnRouterChange((state) => {
    if (!state) {
      setCurrentTab(ETabRoutes.Home);
      return;
    }
    const rootState = state?.routes.find(
      ({ name }) => name === ERootRoutes.Main,
    )?.state;
    const currentTabName = rootState?.routeNames
      ? (rootState?.routeNames?.[rootState?.index || 0] as ETabRoutes)
      : (rootState?.routes[0].name as ETabRoutes);
    setCurrentTab(currentTabName);
  });

  // Map tab routes to account selector scene names
  const sceneName = useMemo(() => {
    switch (currentTab) {
      case ETabRoutes.Home:
        return EAccountSelectorSceneName.home;
      case ETabRoutes.Swap:
        return EAccountSelectorSceneName.swap;
      case ETabRoutes.Perp:
      case ETabRoutes.WebviewPerpTrade:
        return EAccountSelectorSceneName.perp;
      case ETabRoutes.Discovery:
        return EAccountSelectorSceneName.discover;
      case ETabRoutes.Market:
        return EAccountSelectorSceneName.market;
      default:
        return EAccountSelectorSceneName.home;
    }
  }, [currentTab]);

  const leftContent = (
    <XStack ai="center" gap="$2">
      <OneKeyLogo />
      <HeaderNavigation
        items={navigationItems}
        activeKey={derivedActiveKey}
        onTabChange={handleNavigationChange}
      />
    </XStack>
  );

  return (
    <DexHeader leftContent={leftContent}>
      <AccountSelectorProviderMirror
        enabledNum={[0]}
        config={{
          sceneName,
          sceneUrl: '',
        }}
      >
        <AccountSelectorTriggerHome num={0} />
      </AccountSelectorProviderMirror>
      <MoreActionButton key="more-action" />
      {showNotificationButton ? <HeaderNotificationIconButton /> : null}
      {showDownloadButton ? <DownloadButton downloadUrl={downloadUrl} /> : null}
      {showLanguageButton ? <LanguageButton /> : null}
      {showThemeButton ? <ThemeButton /> : null}
      <OneKeyIdButton testID="dex-header-onekey-id" />
    </DexHeader>
  );
}
