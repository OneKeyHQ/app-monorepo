import type { FC } from 'react';
import { useCallback } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Button } from '@onekeyhq/components';
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

type NavigationProps = NativeStackNavigationProp<
  HomeRoutesParams,
  HomeRoutes.DAppListScreen
>;

type SectionTitleProps = {
  title: string;
  tagId?: string;
  onItemSelect?: (item: DAppItemType) => void;
};

export const SeeAllButton: FC<SectionTitleProps> = ({
  title,
  tagId,
  onItemSelect,
}) => {
  const intl = useIntl();
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
    <Button
      onPress={() => {
        if (platformEnv.isNative) {
          getAppNavigation().navigate(RootRoutes.Modal, {
            screen: ModalRoutes.Discover,
            params: {
              screen: DiscoverModalRoutes.DAppListModal,
              params: {
                tagId: tagId || '',
                title,
                onItemSelect: onSelected,
              },
            },
          });
        } else {
          navigation.navigate(HomeRoutes.DAppListScreen, {
            tagId: tagId || '',
            title,
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
  );
};
