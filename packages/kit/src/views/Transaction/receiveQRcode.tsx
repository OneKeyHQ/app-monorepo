import React from 'react';

import { Center, Row } from 'native-base';
import { useIntl } from 'react-intl';
import { TouchableOpacity } from 'react-native';

import {
  Account,
  Box,
  Dialog,
  Icon,
  QRCode,
  Typography,
  useThemeValue,
} from '@onekeyhq/components';

const ReceiveQRcode = ({ ...rest }) => {
  const { trigger } = rest;
  const borderColor = useThemeValue('border-subdued');
  const bgColor = useThemeValue('surface-subdued');
  const intl = useIntl();

  return (
    <Dialog trigger={trigger}>
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

        <TouchableOpacity onPress={() => {}}>
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
    </Dialog>
  );
};
export default ReceiveQRcode;
