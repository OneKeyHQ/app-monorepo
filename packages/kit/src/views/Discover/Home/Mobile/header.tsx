import { type FC, useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Icon,
  IconButton,
  Pressable,
  Typography,
} from '@onekeyhq/components';

import { useNavigation } from '../../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../../routes/routesEnum';
import { gotoScanQrcode } from '../../../../utils/gotoScanQrcode';
import { useExplorerSearch } from '../../hooks/useExplorerSearch';
import { DiscoverModalRoutes } from '../../type';

const ExplorerBar: FC<{ onSearch: () => void }> = ({ onSearch }) => {
  const intl = useIntl();

  return (
    <Box
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
        onPress={onSearch}
        flex={1}
        flexDirection="row"
        alignItems="center"
      >
        <Icon name="MagnifyingGlassMini" size={20} color="icon-subdued" />
        <Typography.Body2
          flex={1}
          h="full"
          color="text-subdued"
          numberOfLines={1}
          ml="13px"
        >
          {intl.formatMessage({
            id: 'content__search_dapps_or_type_url',
          })}
        </Typography.Body2>
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
        <Icon name="ViewfinderCircleMini" size={20} color="icon-subdued" />
      </Pressable>
    </Box>
  );
};

export const Header = () => {
  const intl = useIntl();
  const onSearch = useExplorerSearch();
  const navigation = useNavigation();
  const onHistory = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Discover,
      params: {
        screen: DiscoverModalRoutes.History,
      },
    });
  }, [navigation]);

  return (
    <Box px="4" py="3">
      <Box
        flexDirection="row"
        bg="background-default"
        justifyContent="space-between"
        alignItems="center"
      >
        <Typography.PageHeading>
          {intl.formatMessage({ id: 'form__explore' })}
        </Typography.PageHeading>
        <IconButton name="ClockOutline" type="plain" onPress={onHistory} />
      </Box>
      <Box h="3" />
      <ExplorerBar
        onSearch={() => onSearch({ isNewWindow: true, defaultUrl: '' })}
      />
    </Box>
  );
};
