import { type FC, useCallback, useContext, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Box, Center, Icon, Pressable, Typography } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useNavigation } from '../../../../hooks';
import { getAppNavigation } from '../../../../hooks/useAppNavigation';
import {
  HomeRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../../../routes/routesEnum';
import { GasPanelRoutes } from '../../../GasPanel/types';
import { GasPrice } from '../../components/GasPrice';
import { DiscoverModalRoutes } from '../../type';
import { DiscoverContext } from '../context';

import { RecentHistory } from './RecentHistory';

import type { HomeRoutesParams } from '../../../../routes/types';
import type { MatchDAppItemType } from '../../Explorer/explorerUtils';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  HomeRoutesParams,
  HomeRoutes.DAppListScreen
>;

type BrowserHeaderLayoutProps = {
  histories: MatchDAppItemType[];
};

export const BrowserHeaderLayout: FC<BrowserHeaderLayoutProps> = ({
  histories,
}) => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();

  const { onItemSelectHistory } = useContext(DiscoverContext);
  const items = useMemo(() => histories.slice(0, 4), [histories]);
  const onNavigation = useCallback(
    (itemSource: string) => {
      if (platformEnv.isNative) {
        getAppNavigation().navigate(RootRoutes.Modal, {
          screen: ModalRoutes.Discover,
          params: {
            screen: DiscoverModalRoutes.MyDAppListModal,
            params: {
              onItemSelect: onItemSelectHistory,
              defaultIndex: itemSource === 'Favorites' ? 0 : 1,
            },
          },
        });
      } else {
        navigation.navigate(HomeRoutes.MyDAppListScreen, {
          onItemSelect: onItemSelectHistory,
          defaultIndex: itemSource === 'Favorites' ? 0 : 1,
        });
      }
    },
    [navigation, onItemSelectHistory],
  );
  const onFav = useCallback(() => {
    onNavigation('Favorites');
  }, [onNavigation]);
  const onHistory = useCallback(() => {
    onNavigation('History');
  }, [onNavigation]);
  const onGas = useCallback(() => {
    getAppNavigation().navigate(RootRoutes.Modal, {
      screen: ModalRoutes.GasPanel,
      params: {
        screen: GasPanelRoutes.GasPanelModal,
        params: {
          networkId: '',
        },
      },
    });
  }, []);
  return (
    <Box
      w="full"
      flexDirection="row"
      mt="8"
      flexWrap="wrap"
      alignItems="flex-start"
    >
      <Center flexDirection="row" alignItems="flex-start" w="full">
        {items.slice(0, 4).map((item) => (
          <Center w="72px" key={item.id} mb="4">
            <RecentHistory item={item} />
          </Center>
        ))}
      </Center>
      <Center flexDirection="row" alignItems="flex-start" w="full">
        <Center w="72px" mb="4">
          <Pressable alignItems="center" onPress={onFav}>
            <Center
              w="12"
              h="12"
              borderRadius={12}
              borderColor="border-subdued"
              borderWidth={0.5}
              bg="surface-subdued"
            >
              <Icon name="StarMini" />
            </Center>
            <Box mt="2">
              <Typography.Caption>
                {intl.formatMessage({ id: 'title__favorite' })}
              </Typography.Caption>
            </Box>
          </Pressable>
        </Center>
        <Center w="72px" mb="4">
          <Pressable alignItems="center" onPress={onHistory}>
            <Center
              w="12"
              h="12"
              borderRadius={12}
              borderColor="border-subdued"
              borderWidth={0.5}
              bg="surface-subdued"
            >
              <Icon name="ClockMini" />
            </Center>
            <Box mt="2">
              <Typography.Caption>
                {intl.formatMessage({ id: 'transaction__history' })}
              </Typography.Caption>
            </Box>
          </Pressable>
        </Center>
        <Center w="72px" mb="4">
          <Pressable alignItems="center" onPress={onGas}>
            <GasPrice />
            <Box mt="2">
              <Typography.Caption>🔥Gas</Typography.Caption>
            </Box>
          </Pressable>
        </Center>
      </Center>
    </Box>
  );
};
