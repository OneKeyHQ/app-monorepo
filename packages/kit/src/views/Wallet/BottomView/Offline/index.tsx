import type { FC } from 'react';
import { memo } from 'react';

import { Row } from 'native-base';
import { useIntl } from 'react-intl';

import { Box, Icon, Typography } from '@onekeyhq/components';

const OfflineView: FC = () => {
  const intl = useIntl();
  return (
    <Box w="full" justifyContent="center" alignItems="center">
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

export default memo(OfflineView);
