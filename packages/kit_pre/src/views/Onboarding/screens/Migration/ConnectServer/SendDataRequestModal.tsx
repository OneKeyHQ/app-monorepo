import type { FC } from 'react';
import { useCallback, useState } from 'react';

import { Row } from 'native-base';
import { useIntl } from 'react-intl';

import {
  BottomSheetModal,
  Box,
  Button,
  CheckBox,
  Icon,
  Text,
} from '@onekeyhq/components';
import type { DeviceInfo } from '@onekeyhq/engine/src/types/migrate';

import { showOverlay } from '../../../../../utils/overlayUtils';
import { deviceInfo, parseDeviceInfo } from '../util';

type Props = {
  deviceInfo: DeviceInfo;
  confirmPress: (confirm: boolean) => Promise<boolean>;
  closeOverlay: () => void;
};

const Content: FC<Props> = ({
  deviceInfo: toInfo,
  confirmPress,
  closeOverlay,
}) => {
  const intl = useIntl();
  const parseToData = parseDeviceInfo(toInfo);
  const parseFromData = parseDeviceInfo(deviceInfo());
  const [confirmed, setConfirmed] = useState(false);

  const confirmAction = useCallback(async () => {
    const close = await confirmPress?.(true);
    if (close) {
      closeOverlay();
    }
  }, [closeOverlay, confirmPress]);

  const cancelAction = useCallback(() => {
    confirmPress?.(false);
    closeOverlay();
  }, [closeOverlay, confirmPress]);

  return (
    <BottomSheetModal
      title={intl.formatMessage({ id: 'modal__send_data_request' })}
      closeOverlay={cancelAction}
    >
      <Box
        bgColor="surface-default"
        borderRadius="12px"
        borderColor="border-subdued"
        borderWidth={1}
        py="16px"
      >
        <Text typography="Body2" color="text-subdued" ml="16px">
          {intl.formatMessage({ id: 'content__to' })}
        </Text>
        <Box paddingX="16px" flexDirection="row" mt="12px">
          <Icon name={parseToData.logo} size={24} color="icon-subdued" />
          <Text ml="8px" typography="Body1Strong">
            {parseToData.name}
          </Text>
        </Box>
      </Box>

      <CheckBox
        w="full"
        mt="24px"
        isChecked={confirmed}
        defaultIsChecked={false}
        onChange={(checked) => {
          setConfirmed(checked);
        }}
        title={intl.formatMessage(
          {
            id: 'modal__send_data_request_checkbox_label',
          },
          { to: parseToData.name, from: parseFromData.name },
        )}
        description={intl.formatMessage({
          id: 'modal__send_data_request_desc',
        })}
      />
      <Row mt="24px" space="12px" w="full">
        <Button flex={1} size="xl" type="basic" onPress={cancelAction}>
          {intl.formatMessage({ id: 'action__reject' })}
        </Button>
        <Button
          flex={1}
          isDisabled={!confirmed}
          size="xl"
          type="primary"
          onPromise={confirmAction}
        >
          {intl.formatMessage({ id: 'action__confirm' })}
        </Button>
      </Row>
    </BottomSheetModal>
  );
};
export const showSendDataRequestModal = (props: Omit<Props, 'closeOverlay'>) =>
  showOverlay((close) => <Content {...props} closeOverlay={close} />);
