import type { FC } from 'react';
import { useEffect } from 'react';

import { useIntl } from 'react-intl';

import { Box, Dialog, Spinner, Typography } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

export type HardwareLoadingDialogProps = {
  deviceId?: string;
  connectId?: string;
  onHandler?: () => Promise<any>;
  onClose?: () => void;
};

const HardwareLoadingDialog: FC<HardwareLoadingDialogProps> = ({
  deviceId,
  connectId,
  onHandler,
  onClose,
}) => {
  const intl = useIntl();
  const { serviceHardware } = backgroundApiProxy;

  useEffect(() => {
    if (deviceId && connectId) {
      serviceHardware.getFeatures(connectId).finally(() => onClose?.());
    } else if (onHandler) {
      onHandler().finally(() => onClose?.());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Dialog visible>
      <Box
        flexDirection="column"
        alignItems="center"
        px={{ base: 4, md: 6 }}
        my={{ base: 12, md: 6 }}
      >
        <Spinner size="lg" />
        <Typography.DisplayMedium mt={6}>
          {intl.formatMessage({ id: 'modal__device_status_check' })}
        </Typography.DisplayMedium>
      </Box>
    </Dialog>
  );
};

export default HardwareLoadingDialog;
