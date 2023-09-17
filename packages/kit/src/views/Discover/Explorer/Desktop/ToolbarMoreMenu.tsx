import { type FC, useCallback, useMemo } from 'react';

import { useNavigation } from '../../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../../routes/routesEnum';
import BaseMenu from '../../../Overlay/BaseMenu';
import { DiscoverModalRoutes } from '../../type';

import type { IBaseMenuOptions } from '../../../Overlay/BaseMenu';

export const ToolbarMoreMenu: FC = ({ children }) => {
  const navigation = useNavigation();
  const onFav = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Discover,
      params: {
        screen: DiscoverModalRoutes.Favorites,
      },
    });
  }, [navigation]);
  const onHistory = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Discover,
      params: {
        screen: DiscoverModalRoutes.History,
      },
    });
  }, [navigation]);
  const options = useMemo(() => {
    const baseOptions: IBaseMenuOptions = [
      {
        id: 'transaction__history',
        onPress: onHistory,
        icon: 'ClockMini',
      },
      {
        id: 'title__favorites',
        onPress: onFav,
        icon: 'StarMini',
      },
    ];
    return baseOptions;
  }, [onHistory, onFav]);

  return <BaseMenu options={options}>{children}</BaseMenu>;
};
