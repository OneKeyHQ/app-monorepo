import React, { FC } from 'react';

import { useNavigation } from '@react-navigation/core';
// import { useIntl } from 'react-intl';

import { Box, IconButton, useIsVerticalLayout } from '@onekeyhq/components';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';

import { ScanQrcodeRoutes } from '../ScanQrcode/types';

const Overview: FC = () => {
  const navigation = useNavigation();
  const small = useIsVerticalLayout();
  return (
    <Box>
      <IconButton
        type="plain"
        size="xl"
        circle
        name={small ? 'ScanOutline' : 'ScanSolid'}
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
