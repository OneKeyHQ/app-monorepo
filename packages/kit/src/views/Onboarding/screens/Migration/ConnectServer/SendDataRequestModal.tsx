import type { FC } from 'react';
import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  BottomSheetModal,
  Box,
  Button,
  Icon,
  Text,
} from '@onekeyhq/components';
import type { DeviceInfo } from '@onekeyhq/engine/src/types/migrate';

import { showOverlay } from '../../../../../utils/overlayUtils';
import { parseDeviceInfo } from '../util';

type Props = {
  deviceInfo: DeviceInfo;
  confirmPress: () => Promise<boolean>;
  closeOverlay: () => void;
};

const Content: FC<Props> = ({ deviceInfo, confirmPress, closeOverlay }) => {
  const intl = useIntl();
  const parseData = parseDeviceInfo(deviceInfo);

  const confirmAction = useCallback(async () => {
    const close = await confirmPress?.();
    if (close) {
      closeOverlay();
    }
  }, [closeOverlay, confirmPress]);

  return (
    <BottomSheetModal
      title={intl.formatMessage({ id: 'modal__send_data_request' })}
      closeOverlay={closeOverlay}
    >
      <Text typography="Body2" color="text-subdued">
        {intl.formatMessage({ id: 'modal__send_data_request_desc' })}
      </Text>
      <Box
        bgColor="surface-default"
        borderRadius="12px"
        borderColor="border-subdued"
        borderWidth={1}
        py="16px"
        mt="24px"
      >
        <Text typography="Body2" color="text-subdued" ml="16px">
          {intl.formatMessage({ id: 'content__to' })}
        </Text>
        <Box paddingX="16px" flexDirection="row" mt="12px">
          {/* TODO: icon name and platform name */}
          <Icon name="DevicePhoneMobileSolid" size={24} color="icon-subdued" />
          <Text ml="8px" typography="Body1Strong">
            {parseData.name}
          </Text>
        </Box>
      </Box>
      <Button mt="24px" size="xl" type="primary" onPromise={confirmAction}>
        {intl.formatMessage({ id: 'action__confirm' })}
      </Button>
    </BottomSheetModal>
  );
};
export const showSendDataRequestModal = (props: Omit<Props, 'closeOverlay'>) =>
  showOverlay((close) => <Content {...props} closeOverlay={close} />);
