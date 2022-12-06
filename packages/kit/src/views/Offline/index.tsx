import React, { FC, useEffect, useState } from 'react';

import NetInfo, { NetInfoStateType } from '@react-native-community/netinfo';
import { Row } from 'native-base';
import { useIntl } from 'react-intl';

import { Box, Icon, Typography } from '@onekeyhq/components';
import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';

setTimeout(() => {
  NetInfo.configure({
    reachabilityUrl: `${getFiatEndpoint()}/health`,
  });
}, 300);

const OfflineView: FC = () => {
  const intl = useIntl();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOffline(state.type === NetInfoStateType.none);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  if (!offline) {
    return null;
  }
  return (
    <Box
      position="absolute"
      height="36px"
      w="full"
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
        <Icon name="OfflineMini" size={20} />
        <Typography.Body2Strong>
          {intl.formatMessage({ id: 'msg__offline' })}
        </Typography.Body2Strong>
      </Row>
    </Box>
  );
};

export default OfflineView;
