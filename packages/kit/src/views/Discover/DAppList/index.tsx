/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { FC, useLayoutEffect } from 'react';

import { useNavigation } from '@react-navigation/core';
import { RouteProp, useRoute } from '@react-navigation/native';

import { Box, useIsVerticalLayout } from '@onekeyhq/components';
import { HomeRoutes, HomeRoutesParams } from '@onekeyhq/kit/src/routes/types';

type RouteProps = RouteProp<HomeRoutesParams, HomeRoutes.DAppListScreen>;

let Mobile: any;
let Desktop: any;

const DAppList: FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { title } = route.params;
  const isSmall = useIsVerticalLayout();
  if (isSmall && !Mobile) {
    Mobile = require('./Mobile').Mobile;
  } else if (!isSmall && !Desktop) {
    Desktop = require('./Desktop').Desktop;
  }

  useLayoutEffect(() => {
    navigation.setOptions({
      title,
    });
  }, [navigation, title]);
  return (
    <Box flex="1" bg="background-default">
      {isSmall ? <Mobile {...route.params} /> : <Desktop {...route.params} />}
    </Box>
  );
};

export default DAppList;
