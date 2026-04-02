import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { CommonActions } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  OneKeyLogo,
  XStack,
  rootNavigationRef,
  useOnRouterChange,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePerpTabConfig } from '@onekeyhq/kit/src/hooks/usePerpTabConfig';
import { useToReferFriendsModalByRootNavigation } from '@onekeyhq/kit/src/hooks/useReferFriends';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EPerpPageEnterSource,
  setPerpPageEnterSource,
} from '@onekeyhq/shared/src/logger/scopes/perp/perpPageSource';
import {
  ERootRoutes,
  ETabEarnRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { HeaderNavigation } from './HeaderNavigation';

import type { IHeaderNavigationItem } from './HeaderNavigation';

interface IUseWebHeaderNavigationParams {
  onNavigationChange?: (key: string) => void;
  activeNavigationKey?: string;
}

const resolveKey = (key: string, perpTabShowWeb: boolean) => {
  switch (key) {
    case 'market':
      return ETabRoutes.Market;
    case 'perps':
      return perpTabShowWeb ? ETabRoutes.WebviewPerpTrade : ETabRoutes.Perp;
    case 'defi':
      return ETabRoutes.Earn;
    case 'swap':
      return ETabRoutes.Swap;
    default:
      break;
  }
};

const backToTabHomePage = async (depth: number) => {
  if (depth > 0) {
    if (rootNavigationRef.current?.canGoBack) {
      rootNavigationRef.current?.goBack();
      await timerUtils.wait(50);
      await backToTabHomePage(depth - 1);
    }
  }
};

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

      const tabKey = resolveKey(key, !!perpTabShowWeb);

      const rootState = rootNavigationRef.current?.getRootState();

      if (rootState) {
        const mainRouteState = rootState.routes?.[rootState.index]?.state;
        if (mainRouteState) {
          const tabRoute =
            mainRouteState.routes[
              mainRouteState?.index === undefined ? -1 : mainRouteState?.index
            ];
          console.log('tabRoute', tabRoute);
          if (tabRoute?.name === tabKey) {
            const stackDepths = tabRoute.state?.index || 0;
            if (stackDepths > 0) {
              void backToTabHomePage(stackDepths);
            } else {
              const tabHomeRouteName = tabRoute.state?.routes[0]?.name;
              if (tabHomeRouteName === 'commission') {
                return;
              }
              if (tabKey && tabHomeRouteName !== tabKey) {
                let tabName = '';
                switch (tabKey) {
                  case ETabRoutes.Market:
                    tabName = ETabMarketRoutes.TabMarket;
                    break;
                  case ETabRoutes.Earn:
                    tabName = ETabEarnRoutes.EarnHome;
                    break;
                  default:
                    break;
                }
                if (tabName) {
                  navigation.dispatch(
                    CommonActions.reset({
                      index: 0,
                      routes: [
                        {
                          name: tabName,
                        },
                      ],
                    }),
                  );
                }
              }
            }
            return;
          }
        }
      }

      if (key === 'commission') {
        void toReferFriendsModal();
        return;
      }

      if (key === 'defi') {
        navigation.switchTab(ETabRoutes.Earn);
        return;
      }

      if (tabKey === ETabRoutes.Perp) {
        setPerpPageEnterSource(EPerpPageEnterSource.TabBar);
      }
      if (tabKey) {
        navigation.switchTab(tabKey as ETabRoutes);
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
    <XStack ai="center" gap="$4">
      <OneKeyLogo px="$0" />
      <HeaderNavigation
        items={navigationItems}
        activeKey={activeNavigationKey}
        onTabChange={handleNavigationChange}
      />
    </XStack>
  );
}

export { useWebHeaderNavigation };
