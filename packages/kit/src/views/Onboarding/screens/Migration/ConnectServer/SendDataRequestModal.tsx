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
    <BottomSheetModal title="Send Data Request" closeOverlay={closeOverlay}>
      <Text typography="Body2" color="text-subdued">
        Your data will be encrypted and transferred. Only proceed if you are
        migrating between OneKey.
      </Text>
      <Box
        height="92px"
        bgColor="surface-default"
        borderRadius="12px"
        borderColor="border-subdued"
        borderWidth={1}
        mt="24px"
      >
        <Text typography="Body2" color="text-subdued" mt="16px" ml="16px">
          {intl.formatMessage({ id: 'content__to' })}
        </Text>
        <Box
          paddingX="16px"
          flexDirection="row"
          justifyContent="space-between"
          mt="12px"
        >
          <Text typography="Body1Strong">{parseData.name}</Text>
          <Icon name="PlaySolid" size={28} />
        </Box>
      </Box>
      <Button mt="24px" size="xl" type="primary" onPromise={confirmAction}>
        Confirm
      </Button>
    </BottomSheetModal>
  );
};
export const showSendDataRequestModal = (props: Omit<Props, 'closeOverlay'>) =>
  showOverlay((close) => <Content {...props} closeOverlay={close} />);
