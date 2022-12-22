import type { FC } from 'react';
import { useEffect, useState } from 'react';

import { Row } from 'native-base';
import { useIntl } from 'react-intl';

import { Box, Icon, Typography } from '@onekeyhq/components';

import { useActiveWalletAccount } from '../../hooks';
import { useRpcMeasureStatus } from '../ManageNetworks/hooks';

const OfflineView: FC = () => {
  const intl = useIntl();
  const [offline, setOffline] = useState(false);

  const { networkId } = useActiveWalletAccount();

  const { status } = useRpcMeasureStatus(networkId);

  useEffect(() => {
    if (status && typeof status?.responseTime === 'undefined') {
      setOffline(true);
    } else {
      setOffline(false);
    }
  }, [status]);

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
