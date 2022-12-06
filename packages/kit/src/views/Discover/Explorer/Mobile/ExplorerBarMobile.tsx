import { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, Icon, Pressable, Typography } from '@onekeyhq/components';

import { gotoScanQrcode } from '../../../../utils/gotoScanQrcode';

const ExplorerBar: FC<{ onSearch: () => void }> = ({ onSearch }) => {
  const intl = useIntl();

  return (
    <Box
      mt="12px"
      mx="15px"
      h="42px"
      bg="action-secondary-default"
      flexDirection="row"
      alignItems="center"
      borderColor="border-default"
      borderWidth="1px"
      borderRadius="12px"
    >
      <Pressable px="13px" py="13px" onPress={onSearch} flex={1}>
        <Icon name="MagnifyingGlassMini" size={20} color="icon-subdued" />
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
        <Icon name="ViewfinderCircleMini" size={20} color="icon-subdued" />
      </Pressable>
    </Box>
  );
};

export default ExplorerBar;
