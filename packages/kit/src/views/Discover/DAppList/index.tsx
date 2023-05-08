/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import type { FC } from 'react';
import { useLayoutEffect } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useRoute } from '@react-navigation/native';

import { Box, useIsVerticalLayout } from '@onekeyhq/components';
import type { HomeRoutesParams } from '@onekeyhq/kit/src/routes/types';

import { useTranslation } from '../../../hooks';

import type { HomeRoutes } from '../../../routes/routesEnum';
import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<HomeRoutesParams, HomeRoutes.DAppListScreen>;

let Mobile: any;
let Desktop: any;

const DAppList: FC = () => {
  const navigation = useNavigation();
  const t = useTranslation();
  const route = useRoute<RouteProps>();
  const { title, _title: $title } = route.params;
  const isSmall = useIsVerticalLayout();
  if (isSmall && !Mobile) {
    Mobile = require('./Mobile').Mobile;
  } else if (!isSmall && !Desktop) {
    Desktop = require('./Desktop').Desktop;
  }

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t($title) ?? title,
    });
  }, [navigation, title, t, $title]);

  return (
    <Box flex="1" bg="background-default">
      {isSmall ? <Mobile {...route.params} /> : <Desktop {...route.params} />}
    </Box>
  );
};

export default DAppList;
