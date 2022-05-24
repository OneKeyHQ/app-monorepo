import React, { FC } from 'react';

import { Row } from 'native-base';
import { useIntl } from 'react-intl';
import { Platform, useWindowDimensions } from 'react-native';

import { Box, Icon, Typography } from '@onekeyhq/components';

export type OfflineProps = {
  offline: boolean;
};

const OfflineView: FC<OfflineProps> = ({ offline }) => {
  const intl = useIntl();
  const screenWidth = useWindowDimensions().width;
  if (!['ios', 'android'].includes(Platform.OS)) {
    return null;
  }
  if (!offline) {
    return null;
  }
  return (
    <Box
      position="absolute"
      height="36px"
      width={`${screenWidth}px`}
      bottom="20px"
      justifyContent="center"
      alignItems="center"
    >
      <Row
        space="4px"
        borderRadius="18px"
        paddingX="12px"
        height="36px"
        justifyContent="center"
        alignItems="center"
        bgColor="surface-neutral-default"
      >
        <Icon name="OfflineSolid" size={20} />
        <Typography.Body2Strong>
          {intl.formatMessage({ id: 'msg__offline' })}
        </Typography.Body2Strong>
      </Row>
    </Box>
  );
};

export default OfflineView;
