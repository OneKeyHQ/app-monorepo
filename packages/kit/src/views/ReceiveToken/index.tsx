import React, { useCallback } from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';
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

import { ReceiveTokenRoutes, ReceiveTokenRoutesParams } from './types';

const AccountName = 'ETH #1';

type NavigationProps = RouteProp<
  ReceiveTokenRoutesParams,
  ReceiveTokenRoutes.ReceiveToken
>;

const ReceiveToken = () => {
  const intl = useIntl();
  const toast = useToast();
  const borderColor = useThemeValue('border-subdued');
  const route = useRoute<NavigationProps>();

  const { address } = route.params;

  const showToast = useCallback(
    (msg: string) => {
      toast.show({
        render: () => <Toast title={msg} />,
      });
    },
    [toast],
  );

  const copyAddressToClipboard = () => {
    copyToClipboard(address);
    showToast(intl.formatMessage({ id: 'msg__copied' }));
  };

  return (
    <Modal
      footer={null}
      header={intl.formatMessage({ id: 'action__receive' })}
      height="auto"
      scrollViewProps={{
        children: (
          <Column flex={1}>
            <Center>
              <Account avatarSize="sm" name={AccountName} address="" />
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
                {address}
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
export default ReceiveToken;
