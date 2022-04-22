import React, { FC, useCallback, useEffect, useState } from 'react';

import NetInfo, { NetInfoStateType } from '@react-native-community/netinfo';
import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Empty,
  IconButton,
  useIsVerticalLayout,
  useThemeValue,
} from '@onekeyhq/components';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

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
