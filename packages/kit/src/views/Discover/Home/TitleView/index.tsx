import type { FC } from 'react';
import { useCallback } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import {
  HomeRoutes,
  ModalRoutes,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/routesEnum';
import type { HomeRoutesParams } from '@onekeyhq/kit/src/routes/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { getAppNavigation } from '../../../../hooks/useAppNavigation';
import { DiscoverModalRoutes } from '../../type';

import type { DAppItemType } from '../../type';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type SectionTitleProps = {
  title: string;
  _title?: string;
  tagId: string;
  onItemSelect?: (item: DAppItemType) => void;
};

type NavigationProps = NativeStackNavigationProp<
  HomeRoutesParams,
  HomeRoutes.DAppListScreen
>;

export const SectionTitle: FC<SectionTitleProps> = ({
  title,
  _title,
  tagId,
  onItemSelect,
}) => {
  const intl = useIntl();
  const isSmallScreen = useIsVerticalLayout();
  const navigation = useNavigation<NavigationProps>();
  const onSelected = useCallback(
    (item: DAppItemType) => {
      onItemSelect?.(item);
      // use root nav instead of tab nav to goback
      getAppNavigation().goBack();
    },
    [onItemSelect],
  );

  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      pl={isSmallScreen ? '16px' : '32px'}
      pr={isSmallScreen ? '8px' : '32px'}
      mb="14px"
    >
      <Box flex={1}>
        <Typography.Heading numberOfLines={1}>{title}</Typography.Heading>
      </Box>
      <Button
        onPress={() => {
          if (platformEnv.isNative) {
            getAppNavigation().navigate(RootRoutes.Modal, {
              screen: ModalRoutes.Discover,
              params: {
                screen: DiscoverModalRoutes.DAppListModal,
                params: {
                  tagId,
                  title,
                  _title,
                  onItemSelect: onSelected,
                },
              },
            });
          } else {
            navigation.navigate(HomeRoutes.DAppListScreen, {
              tagId,
              title,
              _title,
              onItemSelect: onSelected,
            });
          }
        }}
        height="32px"
        type="plain"
        size="sm"
        rightIconName="ChevronRightMini"
        textProps={{ color: 'text-subdued' }}
      >
        {intl.formatMessage({ id: 'action__see_all' })}
      </Button>
    </Box>
  );
};
