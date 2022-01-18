import React, { useCallback, useMemo, useRef } from 'react';

import { Center, Column, Row } from 'native-base';
import { useIntl } from 'react-intl';
import { TouchableOpacity } from 'react-native';

import {
  Account,
  Box,
  Icon,
  Modal,
  QRCode,
  Text,
  Toast,
  Typography,
  useThemeValue,
  useToast,
} from '@onekeyhq/components';

import { copyToClipboard } from '../../utils/ClipboardUtils';

const Address = '0x41f28833Be34e6EDe3c58D1f5900x41f28833Be34e6EDe3c58D1f590';
const AccountName = 'ETH #1';

const ReceiveQRcode = () => {
  const borderColor = useThemeValue('border-subdued');
  const intl = useIntl();
  const toast = useToast();
  const toastIdRef = useRef<string>();

  const showToast = useCallback(
    (msg: string) => {
      toastIdRef.current = toast.show({
        render: () => <Toast title={msg} />,
      }) as string;
    },
    [toast],
  );

  const copyAddressToClipboard = () => {
    copyToClipboard(Address);
    showToast(intl.formatMessage({ id: 'msg__copied' }));
  };

  const account = useMemo(
    () => <Account avatarSize="sm" name={AccountName} address="" />,
    [],
  );

  return (
    <Modal
      footer={null}
      header={intl.formatMessage({ id: 'action__receive' })}
      height="auto"
      scrollViewProps={{
        children: (
          <Column flex={1}>
            <Center>
              {account}
              <Box
                mt="16px"
                padding="16px"
                borderWidth="1px"
                borderRadius="12px"
                bgColor="surface-default"
                borderColor={borderColor}
                width="192px"
              >
                <QRCode value="https://onekey.so/" size={160} />
              </Box>
            </Center>
            <Row
              justifyContent="space-between"
              padding="16px"
              borderWidth="1px"
              borderRadius="12px"
              borderColor={borderColor}
              borderStyle="dashed"
              mt="24px"
            >
              <Text
                textAlign="center"
                typography="Body2"
                flex={1}
                noOfLines={3}
              >
                {Address}
              </Text>
            </Row>

            <TouchableOpacity onPress={copyAddressToClipboard}>
              <Row
                mt="12px"
                space="12px"
                padding="10px"
                justifyContent="center"
              >
                <Icon name="DuplicateSolid" />
                <Typography.Button1 textAlign="center">
                  {intl.formatMessage({
                    id: 'action__copy_address',
                  })}
                </Typography.Button1>
              </Row>
            </TouchableOpacity>
          </Column>
        ),
      }}
    />
  );
};
export default ReceiveQRcode;
