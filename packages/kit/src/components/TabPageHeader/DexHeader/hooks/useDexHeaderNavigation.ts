import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { useOnRouterChange } from '@onekeyhq/components';
import type { IHeaderNavigationItem } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useToReferFriendsModalByRootNavigation } from '@onekeyhq/kit/src/hooks/useReferFriends';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ERootRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';

interface IUseDexHeaderNavigationParams {
  onNavigationChange?: (key: string) => void;
  activeNavigationKey?: string;
}

export function useDexHeaderNavigation({
  onNavigationChange,
  activeNavigationKey: controlledActiveKey,
}: IUseDexHeaderNavigationParams = {}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const toReferFriendsModal = useToReferFriendsModalByRootNavigation();
  const [currentTab, setCurrentTab] = useState<ETabRoutes | null>(null);

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

  // Map tab routes to navigation keys
  const getActiveNavigationKey = useCallback(() => {
    if (controlledActiveKey) {
      return controlledActiveKey;
    }
    switch (currentTab) {
      case ETabRoutes.Market:
        return 'market';
      case ETabRoutes.Perp:
        return 'contract';
      case ETabRoutes.Earn:
        return 'defi';
      case ETabRoutes.Swap:
        return 'swap';
      default:
        return undefined;
    }
  }, [controlledActiveKey, currentTab]);

  const handleNavigationChange = useCallback(
    (key: string) => {
      // Call custom handler if provided
      onNavigationChange?.(key);

      // Handle navigation based on key
      switch (key) {
        case 'market':
          navigation.switchTab(ETabRoutes.Market);
          break;
        case 'contract':
          navigation.switchTab(ETabRoutes.Perp);
          break;
        case 'defi':
          navigation.switchTab(ETabRoutes.Earn);
          break;
        case 'swap':
          navigation.switchTab(ETabRoutes.Swap);
          break;
        case 'commission':
          // Open referral modal instead of switching tab
          void toReferFriendsModal();
          break;
        default:
          break;
      }
    },
    [navigation, onNavigationChange, toReferFriendsModal],
  );

  const navigationItems: IHeaderNavigationItem[] = useMemo(
    () => [
      {
        key: 'market',
        label: intl.formatMessage({ id: ETranslations.global_market }),
      },
      {
        key: 'contract',
        label: intl.formatMessage({ id: ETranslations.global_contract }),
      },
      {
        key: 'defi',
        label: intl.formatMessage({ id: ETranslations.global_earn }),
      },
      {
        key: 'swap',
        label: intl.formatMessage({ id: ETranslations.global_swap }),
      },
      {
        key: 'commission',
        label: intl.formatMessage({ id: ETranslations.sidebar_refer_a_friend }),
      },
    ],
    [intl],
  );

  return {
    navigationItems,
    activeNavigationKey: getActiveNavigationKey(),
    handleNavigationChange,
  };
}
