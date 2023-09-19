import { type FC, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Box, Center, Icon, Pressable, Typography } from '@onekeyhq/components';

import { useNavigation } from '../../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../../routes/routesEnum';
import { GasPanelRoutes } from '../../../GasPanel/types';
import { PriceBox } from '../../../GasPanel/widgets/PriceBox';
import { DiscoverModalRoutes } from '../../type';

import { RecentHistory } from './RecentHistory';

import type { MatchDAppItemType } from '../../Explorer/explorerUtils';

type BrowserHeaderLayoutProps = {
  histories: MatchDAppItemType[];
};

export const BrowserHeaderLayout: FC<BrowserHeaderLayoutProps> = ({
  histories,
}) => {
  const intl = useIntl();
  const navigation = useNavigation();

  const items = useMemo(() => histories.slice(0, 4), [histories]);

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
  const onGas = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.GasPanel,
      params: {
        screen: GasPanelRoutes.GasPanelModal,
        params: {
          networkId: '',
        },
      },
    });
  }, [navigation]);
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
            <PriceBox />
            <Box mt="2">
              <Typography.Caption>🔥Gas</Typography.Caption>
            </Box>
          </Pressable>
        </Center>
      </Center>
    </Box>
  );
};
