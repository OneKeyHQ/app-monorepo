import React, { useCallback, useRef } from 'react';

import { Center, Row } from 'native-base';
import { useIntl } from 'react-intl';
import { TouchableOpacity } from 'react-native';

import {
  Account,
  Box,
  Icon,
  Modal,
  QRCode,
  Toast,
  Typography,
  useThemeValue,
  useToast,
} from '@onekeyhq/components';

import { copyToClipboard } from '../../utils/ClipboardUtils';

const ReceiveQRcode = () => {
  const borderColor = useThemeValue('border-subdued');
  const bgColor = useThemeValue('surface-subdued');
  const intl = useIntl();
  const toast = useToast();
  const toastIdRef = useRef<string>();

  const showToast = useCallback(
    (msg: string) => {
      toastIdRef.current = toast.show({
        render: () => <Toast title={msg} status="success" dismiss />,
      }) as string;
    },
    [toast],
  );

  const copyAddressToClipboard = () => {
    copyToClipboard('0x41f28833Be34e6EDe3c58D1f597bef429861c4E2');
    showToast(intl.formatMessage({ id: 'msg__copied' }));
  };

  return (
    <Modal
      footer={null}
      header={intl.formatMessage({ id: 'action__receive' })}
      scrollViewProps={{
        children: (
          <Box flexDirection="column" alignItems="center">
            <Account avatarSize="sm" name="ETH #1" address="" />
            <Center
              mt="16px"
              padding="16px"
              borderWidth="1px"
              borderRadius="12px"
              borderColor={borderColor}
            >
              <QRCode value="https://onekey.so/" size={160} />
            </Center>
            <Center
              padding="16px"
              mt="24px"
              borderWidth="1px"
              borderRadius="12px"
              bgColor={bgColor}
              borderColor={borderColor}
              borderStyle="dashed"
            >
              <Typography.Body2 textAlign="center">
                0x41f28833Be34e6EDe3c58D1f597bef429861c4E2
              </Typography.Body2>
            </Center>

            <TouchableOpacity onPress={copyAddressToClipboard}>
              <Row mt="12px" space="12px" padding="10px">
                <Icon name="DuplicateSolid" />
                <Typography.Button1 textAlign="center">
                  {intl.formatMessage({
                    id: 'action__copy_address',
                  })}
                </Typography.Button1>
              </Row>
            </TouchableOpacity>
          </Box>
        ),
      }}
    />
  );
};
export default ReceiveQRcode;
