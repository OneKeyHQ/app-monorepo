import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import { OneKeyLogo, XStack, useOnRouterChange } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePerpTabConfig } from '@onekeyhq/kit/src/hooks/usePerpTabConfig';
import { useToReferFriendsModalByRootNavigation } from '@onekeyhq/kit/src/hooks/useReferFriends';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  ERootRoutes,
  ETabEarnRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';

import { HeaderNavigation } from './HeaderNavigation';

import type { IHeaderNavigationItem } from './HeaderNavigation';

interface IUseWebHeaderNavigationParams {
  onNavigationChange?: (key: string) => void;
  activeNavigationKey?: string;
}

function useWebHeaderNavigation({
  onNavigationChange,
  activeNavigationKey: controlledActiveKey,
}: IUseWebHeaderNavigationParams = {}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const toReferFriendsModal = useToReferFriendsModalByRootNavigation();
  const [currentTab, setCurrentTab] = useState<ETabRoutes | null>(null);

  useOnRouterChange((state) => {
    if (!state) {
      setCurrentTab(null);
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

  const getActiveNavigationKey = useCallback(() => {
    if (controlledActiveKey) {
      return controlledActiveKey;
    }
    switch (currentTab) {
      case ETabRoutes.Market:
        return 'market';
      case ETabRoutes.Perp:
      case ETabRoutes.WebviewPerpTrade:
        return 'perps';
      case ETabRoutes.Earn:
        return 'defi';
      case ETabRoutes.Swap:
        return 'swap';
      case ETabRoutes.ReferFriends:
        return 'commission';
      default:
        return null;
    }
  }, [controlledActiveKey, currentTab]);

  const { perpDisabled, perpTabShowWeb } = usePerpTabConfig();

  const handleNavigationChange = useCallback(
    (key: string) => {
      onNavigationChange?.(key);

      switch (key) {
        case 'market':
          navigation.switchTab(ETabRoutes.Market);
          break;
        case 'perps':
          if (perpTabShowWeb) {
            navigation.switchTab(ETabRoutes.WebviewPerpTrade);
          } else {
            navigation.switchTab(ETabRoutes.Perp);
          }
          break;
        case 'defi':
          navigation.switchTab(ETabRoutes.Earn, {
            screen: ETabEarnRoutes.EarnHome,
          });
          break;
        case 'swap':
          navigation.switchTab(ETabRoutes.Swap);
          break;
        case 'commission':
          void toReferFriendsModal();
          break;
        default:
          break;
      }
    },
    [navigation, onNavigationChange, perpTabShowWeb, toReferFriendsModal],
  );

  const navigationItems: IHeaderNavigationItem[] = useMemo(
    () => [
      {
        key: 'market',
        label: intl.formatMessage({ id: ETranslations.global_market }),
      },
      ...(!perpDisabled
        ? [
            {
              key: 'perps',
              label: intl.formatMessage({ id: ETranslations.global_perp }),
            },
          ]
        : []),
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
        label: intl.formatMessage({
          id: ETranslations.sidebar_refer_a_friend,
        }),
      },
    ],
    [intl, perpDisabled],
  );

  return {
    navigationItems,
    activeNavigationKey: getActiveNavigationKey(),
    handleNavigationChange,
  };
}

interface IWebHeaderNavigationProps extends IUseWebHeaderNavigationParams {
  children?: ReactNode;
  leftContent?: ReactNode;
  rightContent?: ReactNode;
}

export function WebHeaderNavigation({
  children,
  leftContent,
  rightContent,
  ...rest
}: IWebHeaderNavigationProps) {
  const { navigationItems, activeNavigationKey, handleNavigationChange } =
    useWebHeaderNavigation(rest);

  return (
    <XStack ai="center" gap="$4" width="100%" jc="space-between">
      {leftContent ?? (
        <XStack ai="center" gap="$4">
          <OneKeyLogo px="$0" />
          <HeaderNavigation
            items={navigationItems}
            activeKey={activeNavigationKey}
            onTabChange={handleNavigationChange}
          />
        </XStack>
      )}
      {children ?? rightContent ?? null}
    </XStack>
  );
}

export { useWebHeaderNavigation };
