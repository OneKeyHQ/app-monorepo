import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  OneKeyLogo,
  XStack,
  useMedia,
  useOnRouterChange,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useToReferFriendsModalByRootNavigation } from '@onekeyhq/kit/src/hooks/useReferFriends';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ERootRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';

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
      onNavigationChange?.(key);

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
        label: intl.formatMessage({
          id: ETranslations.sidebar_refer_a_friend,
        }),
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
  const { gtMd } = useMedia();

  const { navigationItems, activeNavigationKey, handleNavigationChange } =
    useWebHeaderNavigation(rest);

  if (!(platformEnv.isWeb && gtMd)) {
    return <>{children ?? null}</>;
  }

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
