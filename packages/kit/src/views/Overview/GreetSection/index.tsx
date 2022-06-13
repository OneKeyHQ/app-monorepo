import React, { FC } from 'react';

import { useNavigation } from '@react-navigation/core';

import {
  Box,
  DesktopDragZoneBox,
  IconButton,
  Spinner,
  Typography,
  useIsVerticalLayout,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';

import { ScanQrcodeRoutes } from '../../ScanQrcode/types';

const DEFAULT_HEADER_VERTICAL = 54;

const GreetList = [
  '🌞 GM Frens！',
  '🌛 GN Frens!',
  '👻 WAGMI！',
  '😘 Love to See it！',
  '🚀 ToDaMoon！',
];

const GreetText = () => {
  const hour = new Date().getHours();
  if (hour < 6 || hour >= 20) {
    return '🌛 GN Frens!';
  }
  if (hour >= 6 && hour <= 10) {
    return '🌞 GM Frens！';
  }
  return GreetList[Math.floor(Math.random() * GreetList.length)];
};

const GreetSection: FC = () => {
  const insets = useSafeAreaInsets();
  const headerHeight = DEFAULT_HEADER_VERTICAL;
  const navigation = useNavigation();
  const small = useIsVerticalLayout();
  return (
    <DesktopDragZoneBox>
      <Box
        height={`${headerHeight + insets.top}px`}
        flexDirection="row"
        alignItems="flex-end"
        justifyContent="space-between"
      >
        <Box
          width="full"
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Typography.Heading color="text-subdued">
            {GreetText()}
          </Typography.Heading>{' '}
          <Box flexDirection="row">
            <Spinner size="sm" />
            <IconButton
              ml="16px"
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
        </Box>
      </Box>
    </DesktopDragZoneBox>
  );
};

export default GreetSection;
