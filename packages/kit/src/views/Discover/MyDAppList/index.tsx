import type { FC } from 'react';
import { useCallback, useLayoutEffect } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Box, useIsVerticalLayout } from '@onekeyhq/components';
import type {
  HomeRoutes,
  HomeRoutesParams,
} from '@onekeyhq/kit/src/routes/types';

import { MyDAppListContext } from './context';
import Desktop from './desktop';
import Mobile from './mobile';

import type { MatchDAppItemType } from '../Explorer/explorerUtils';
import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<HomeRoutesParams, HomeRoutes.MyDAppListScreen>;

const MyDappList: FC = () => {
  const isSmallScreen = useIsVerticalLayout();
  const navigation = useNavigation();
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { onItemSelect, defaultIndex } = route.params;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: intl.formatMessage({ id: 'title__my_dapps' }),
    });
  }, [navigation, intl]);

  const onSelect = useCallback(
    (item: MatchDAppItemType) => {
      onItemSelect?.(item);
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    },
    [navigation, onItemSelect],
  );

  return (
    <MyDAppListContext.Provider
      value={{ onItemSelect: onSelect, defaultIndex }}
    >
      <Box flex="1" bg="background-default">
        {isSmallScreen ? <Mobile /> : <Desktop />}
      </Box>
    </MyDAppListContext.Provider>
  );
};

export default MyDappList;
