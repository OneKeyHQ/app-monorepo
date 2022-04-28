/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-var-requires,global-require */
import React, { useMemo } from 'react';

import { Column, Row } from 'native-base';
import { useIntl } from 'react-intl';

import {
  Box,
  ScrollView,
  Text,
  Typography,
  useThemeValue,
} from '@onekeyhq/components';
import { IUnsignedMessageEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';

import { IDappCallParams } from '../../../background/IBackgroundApi';

import {
  ISignMessageConfirmViewProps,
  SignMessageConfirmModal,
} from './SignMessageConfirmModal';

function stringifyMessage(
  unsignedMessage: IUnsignedMessageEvm,
  sourceInfo?: IDappCallParams,
) {
  // **** jsonToy may cause iOS building memory leak ****
  // const jsonToy = require('json-toy');
  // return (jsonToy as { treeify: (data: any, options: any) => string }).treeify(
  //   unsignedMessage,
  //   {
  //     space: 2,
  //     vSpace: 0,
  //     jsonName: sourceInfo?.data?.method || 'SIGN_DATA',
  //     needValueOut: true,
  //   },
  // );

  return JSON.stringify(unsignedMessage, null, 4);
}

function MsgConfirmBlind(props: ISignMessageConfirmViewProps) {
  const intl = useIntl();
  const cardBgColor = useThemeValue('surface-default');
  const { unsignedMessage, sourceInfo } = props;

  const msgText = useMemo(
    () => stringifyMessage(unsignedMessage, sourceInfo),
    [sourceInfo, unsignedMessage],
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
