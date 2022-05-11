import React, { FC } from 'react';

import { useNavigation } from '@react-navigation/core';
// import { useIntl } from 'react-intl';

import { Box, IconButton } from '@onekeyhq/components';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';

import { ScanQrcodeRoutes } from '../ScanQrcode/types';

const Overview: FC = () => {
  const navigation = useNavigation();
  return (
    <Box>
      <IconButton
        type="plain"
        size="xl"
        circle
        name="ScanSolid"
        onPress={() => {
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.ScanQrcode,
            params: { screen: ScanQrcodeRoutes.ScanQrcode },
          });
        }}
      />
    </Box>
  );
};

export default Overview;
