import React, { FC } from 'react';

import { useNavigation } from '@react-navigation/core';

import {
  Box,
  Button,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { HomeRoutes, HomeRoutesParams } from '@onekeyhq/kit/src/routes/types';

import { SectionDataType } from '../type';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  HomeRoutesParams,
  HomeRoutes.DAppListScreen
>;
export const SectionTitle: FC<SectionDataType> = ({
  title,
  data,
  onItemSelect,
}) => {
  const isSmallScreen = useIsVerticalLayout();
  const navigation = useNavigation<NavigationProps>();

  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      pl={isSmallScreen ? '16px' : '32px'}
      pr={isSmallScreen ? '8px' : '32px'}
      mb="14px"
    >
      <Typography.Heading>{title}</Typography.Heading>
      <Button
        onPress={() => {
          navigation.navigate(HomeRoutes.DAppListScreen, {
            data,
            title,
            onItemSelect,
          });
        }}
        height="32px"
        type="plain"
        size="sm"
        rightIconName="ChevronRightSolid"
        textProps={{ color: 'text-subdued' }}
      >
        See All
      </Button>
    </Box>
  );
};
