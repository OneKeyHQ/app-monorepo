import React from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Icon,
  Pressable,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import { gotoScanQrcode } from '../../../utils/gotoScanQrcode';

export const UtilSection = () => {
  const intl = useIntl();
  const small = useIsVerticalLayout();
  return (
    <Box
      w="full"
      mb="6"
      borderRadius="12"
      bg="surface-default"
      shadow="depth.2"
    >
      <Pressable
        display="flex"
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        py={4}
        px={{ base: 4, md: 6 }}
        onPress={() => {
          gotoScanQrcode();
        }}
      >
        <Icon name={small ? 'ScanOutline' : 'ScanSolid'} />
        <Text
          typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
          flex="1"
          numberOfLines={1}
          mx={3}
        >
          {intl.formatMessage({
            id: 'title__scan_qr_code',
          })}
        </Text>
        <Box>
          <Icon name="ChevronRightSolid" size={20} />
        </Box>
      </Pressable>
    </Box>
  );
};
