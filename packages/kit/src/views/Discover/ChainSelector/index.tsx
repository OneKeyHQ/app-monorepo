import type { FC } from 'react';
import { useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Icon,
  Image,
  Modal,
  Pressable,
  Searchbar,
  Typography,
} from '@onekeyhq/components';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';

import { useManageNetworks, useNavigation } from '../../../hooks';

import type { DiscoverModalRoutes, DiscoverRoutesParams } from '../type';
import type { RouteProp } from '@react-navigation/core';
import type { ListRenderItem } from 'react-native';

type RouteProps = RouteProp<
  DiscoverRoutesParams,
  DiscoverModalRoutes.ChainSelector
>;

type NetworkItem = {
  name: string;
  networkId: string;
  logoURI: string;
  fullname?: string;
};

type ListHeaderComponentProps = {
  searchContent: string;
  setSearchContext: (value: string) => void;
};

const ListHeaderComponent: FC<ListHeaderComponentProps> = ({
  searchContent,
  setSearchContext,
}) => {
  const intl = useIntl();
  return (
    <Box>
      <Searchbar
        w="full"
        placeholder={intl.formatMessage({
          id: 'form__search',
        })}
        mb="4"
        value={searchContent}
        onClear={() => setSearchContext('')}
        onChangeText={setSearchContext}
      />
    </Box>
  );
};

export const ChainSelector = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation();
  const [searchContent, setSearchContext] = useState('');
  const { allNetworks } = useManageNetworks({ allowSelectAllNetworks: true });

  const items = useMemo(() => {
    if (!route.params.networkIds) {
      return allNetworks;
    }
    const set = new Set(route.params.networkIds);
    return allNetworks?.filter(
      (item) => set.has(item.id) || isAllNetworks(item.id),
    );
  }, [allNetworks, route.params.networkIds]);

  const data = useMemo<NetworkItem[]>(() => {
    if (!items) {
      return [];
    }
    let result = items.map((item) => ({
      name: item.name,
      networkId: item.id,
      logoURI: item.logoURI,
      fullname: item.name,
    }));
    const text = searchContent.trim();
    if (text) {
      result = result.filter((item) => {
        const name = item.fullname ? item.fullname : item.name;
        return name.toLowerCase().includes(text.toLowerCase());
      });
    }
    return result;
  }, [items, searchContent]);

  const renderItem: ListRenderItem<NetworkItem> = ({ item }) => (
    <Pressable
      onPress={() => {
        route.params.onSelect?.(item.networkId);
        navigation.goBack();
      }}
    >
      {({ isHovered, isPressed }) => {
        const boxBg = () => {
          // if (isCurrent) return 'surface-selected';
          if (isPressed) return 'surface-pressed';
          if (isHovered) return 'surface-hovered';
          return 'transparent';
        };
        const isActive = item.networkId === route.params.currentNetworkId;
        return (
          <Box
            p="2"
            alignItems="center"
            borderRadius={12}
            flexDirection="row"
            bg={boxBg()}
            justifyContent="space-between"
          >
            <Box flexDirection="row" alignItems="center">
              <Image
                borderRadius="full"
                overflow="hidden"
                src={item.logoURI}
                w="10"
                h="10"
                mr="2"
              />
              <Typography.Body1Strong>
                {item.fullname ? item.fullname : item.name}
              </Typography.Body1Strong>
            </Box>
            {isActive ? (
              <Box>
                <Icon
                  name="CheckCircleSolid"
                  size={20}
                  color="interactive-default"
                />
              </Box>
            ) : null}
          </Box>
        );
      }}
    </Pressable>
  );

  return (
    <Modal
      height="560px"
      footer={null}
      header={intl.formatMessage({ id: 'network__networks' })}
      flatListProps={{
        data,
        // @ts-ignore
        renderItem,
        ListHeaderComponent: (
          <ListHeaderComponent
            searchContent={searchContent}
            setSearchContext={setSearchContext}
          />
        ),
      }}
    />
  );
};
