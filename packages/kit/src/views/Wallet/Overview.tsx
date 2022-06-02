import React, { FC } from 'react';

import { useNavigation } from '@react-navigation/core';
// import { useIntl } from 'react-intl';

import { Box, IconButton, useIsVerticalLayout } from '@onekeyhq/components';
import { gotoScanQrcode } from '../../utils/gotoScanQrcode';

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
          gotoScanQrcode();
        }}
      />
    </Box>
  );
};

export default Overview;
