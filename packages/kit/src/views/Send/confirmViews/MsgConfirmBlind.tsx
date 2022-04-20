import React, { useMemo } from 'react';

// @ts-ignore
import jsonToy from 'json-toy';
import { Column, Row } from 'native-base';
import { useIntl } from 'react-intl';

import {
  Box,
  ScrollView,
  Text,
  Typography,
  useThemeValue,
} from '@onekeyhq/components';

import {
  ISignMessageConfirmViewProps,
  SignMessageConfirmModal,
} from './SignMessageConfirmModal';

function MsgConfirmBlind(props: ISignMessageConfirmViewProps) {
  const intl = useIntl();
  const cardBgColor = useThemeValue('surface-default');
  const { unsignedMessage, sourceInfo } = props;

  const msgText = useMemo(
    () =>
      (jsonToy as { treeify: (data: any, options: any) => string }).treeify(
        unsignedMessage,
        {
          space: 2,
          vSpace: 0,
          jsonName: sourceInfo?.data?.method || 'SIGN_DATA',
          needValueOut: true,
        },
      ),
    [sourceInfo?.data?.method, unsignedMessage],
  );
  return (
    <SignMessageConfirmModal {...props}>
      <Column flex="1">
        <Box>
          <Typography.Subheading mt="24px" color="text-subdued">
            {intl.formatMessage({ id: 'form__contract_data' })}
          </Typography.Subheading>
          <Column bg={cardBgColor} borderRadius="12px" mt="2">
            <Row justifyContent="space-between" space="16px" padding="16px">
              <ScrollView horizontal flex={1}>
                <Text
                  typography={{ sm: 'Caption', md: 'Caption' }}
                  // flex={1}
                  // overflowWrap="anywhere"
                >
                  {msgText || '-'}
                </Text>
              </ScrollView>
            </Row>
          </Column>
        </Box>
      </Column>
    </SignMessageConfirmModal>
  );
}
export { MsgConfirmBlind };
