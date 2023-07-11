import { useCallback } from 'react';

import { useNavigation } from '../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { gotoSite, openMatchDApp } from '../Explorer/Controller/gotoSite';
import { DiscoverModalRoutes } from '../type';

import type { ModalScreenProps } from '../../../routes/types';
import type { MatchDAppItemType } from '../Explorer/explorerUtils';
import type { DiscoverRoutesParams } from '../type';

type NavigationProps = ModalScreenProps<DiscoverRoutesParams>;

export const useExplorerSearch = () => {
  const navigation = useNavigation<NavigationProps['navigation']>();
  return useCallback(
    ({
      isNewWindow,
      defaultUrl,
    }: {
      isNewWindow: boolean;
      defaultUrl?: string;
    }) => {
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Discover,
        params: {
          screen: DiscoverModalRoutes.SearchHistoryModal,
          params: {
            url: defaultUrl,
            onSelectorItem: (item: MatchDAppItemType | string) => {
              if (typeof item === 'string') {
                return gotoSite({
                  url: item,
                  isNewWindow,
                  userTriggered: true,
                });
              }
              openMatchDApp({ ...item, isNewWindow });
            },
          },
        },
      });
    },
    [navigation],
  );
};
