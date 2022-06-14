import React, { FC, useCallback } from 'react';

import {
  Box,
  DesktopDragZoneBox,
  IconButton,
  Spinner,
  Typography,
  useIsVerticalLayout,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { useOverview } from '@onekeyhq/kit/src/hooks';

import { gotoScanQrcode } from '../../../utils/gotoScanQrcode';

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
  const small = useIsVerticalLayout();
  const { loading } = useOverview();
  const greetText = useCallback(() => GreetText(), []);
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
            {greetText()}
          </Typography.Heading>
          <Box flexDirection="row">
            {loading && <Spinner size="sm" />}

            <IconButton
              ml="16px"
              type="plain"
              size="xl"
              circle
              name={small ? 'ScanOutline' : 'ScanSolid'}
              onPress={() => {
                gotoScanQrcode();
              }}
            />
          </Box>
        </Box>
      </Box>
    </DesktopDragZoneBox>
  );
};

export default GreetSection;
