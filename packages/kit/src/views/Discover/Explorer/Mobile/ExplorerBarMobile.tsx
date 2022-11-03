import { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, Icon, Pressable, Typography } from '@onekeyhq/components';
import useNavigation from '@onekeyhq/kit/src/hooks/useNavigation';
import {
  DiscoverModalRoutes,
  DiscoverRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/Discover';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';

import { gotoScanQrcode } from '../../../../utils/gotoScanQrcode';
import { ExplorerBarProps, MatchDAppItemType } from '../explorerUtils';

type NavigationProps = ModalScreenProps<DiscoverRoutesParams>;

const ExplorerBar: FC<ExplorerBarProps> = ({ onSearchSubmitEditing }) => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();

  const onSearch = () => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Discover,
      params: {
        screen: DiscoverModalRoutes.SearchHistoryModal,
        params: {
          url: '',
          onSelectorItem: (item: MatchDAppItemType | string) => {
            onSearchSubmitEditing?.(item);
          },
        },
      },
    });
  };

  return (
    <Box
      mx="15px"
      h="42px"
      bg="action-secondary-default"
      flexDirection="row"
      alignItems="center"
      borderColor="border-default"
      borderWidth="1px"
      borderRadius="12px"
    >
      <Pressable
        px="13px"
        py="13px"
        onPress={() => {
          onSearch();
        }}
        flex={1}
      >
        <Icon name="SearchSolid" size={20} color="icon-subdued" />
        <Typography.Caption flex={1} color="text-subdued" numberOfLines={1}>
          {intl.formatMessage({
            id: 'content__search_dapps_or_type_url',
          })}
        </Typography.Caption>
      </Pressable>
      <Pressable
        h="42px"
        justifyContent="center"
        alignItems="center"
        px="15px"
        onPress={() => {
          gotoScanQrcode();
        }}
      >
        <Icon name="ScanSolid" size={20} color="icon-subdued" />
      </Pressable>
    </Box>
  );
};

export default ExplorerBar;
