import React, { useMemo } from 'react';

// @ts-ignore
import jsonToy from 'json-toy';
import { Column, Row } from 'native-base';
import { useIntl } from 'react-intl';

import { Box, Text, Typography, useThemeValue } from '@onekeyhq/components';

import {
  ISignMessageConfirmViewProps,
  SignMessageConfirmModal,
} from './SignMessageConfirmModal';

function MsgConfirmBlind(props: ISignMessageConfirmViewProps) {
  const intl = useIntl();
  const cardBgColor = useThemeValue('surface-default');
  const { unsignedMessage } = props;

  const msgText = useMemo(
    () =>
      (jsonToy as { treeify: (data: any, options: any) => string }).treeify(
        unsignedMessage,
        {
          vSpace: 0,
        },
      ),
    [unsignedMessage],
  );
  return (
    <SignMessageConfirmModal {...props}>
      <Column flex="1">
        <Box>
          <Typography.Subheading mt="24px" color="text-subdued">
            {intl.formatMessage({ id: 'content__more_details' })}
          </Typography.Subheading>
          <Column bg={cardBgColor} borderRadius="12px" mt="2">
            <Row justifyContent="space-between" space="16px" padding="16px">
              <Text
                color="text-subdued"
                typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
              >
                {intl.formatMessage({ id: 'form__contract_data' })}
              </Text>
              <Text
                typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
                flex={1}
              >
                {msgText || '-'}
              </Text>
            </Row>
          </Column>
        </Box>
      </Column>
    </SignMessageConfirmModal>
  );
}
export { MsgConfirmBlind };
