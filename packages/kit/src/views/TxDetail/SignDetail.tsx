/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import React, { FC, useMemo, useState } from 'react';

import * as ethUtils from 'ethereumjs-util';
import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Button,
  Center,
  HStack,
  Image,
  Text,
  Typography,
  VStack,
} from '@onekeyhq/components';
import { FormErrorMessage } from '@onekeyhq/components/src/Form/FormErrorMessage';
import { ETHMessageTypes } from '@onekeyhq/engine/src/types/message';
import { IUnsignedMessageEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import X from '@onekeyhq/kit/assets/red_x.png';

import { IDappSourceInfo } from '../../background/IBackgroundApi';
import { useActiveWalletAccount } from '../../hooks/redux';

import ConfirmHeader from './_legacy/ConfirmHeader';

type TabType = 'message' | 'data';

type TypedDataV1 = {
  type: string;
  name: string;
  value: string;
};

const getSignTypeString = (signType: ETHMessageTypes) => {
  const signTypeMap = {
    [ETHMessageTypes.ETH_SIGN]: 'eth_sign',
    [ETHMessageTypes.PERSONAL_SIGN]: 'personal_sign',
    [ETHMessageTypes.TYPED_DATA_V1]: 'signTypedData_v1',
    [ETHMessageTypes.TYPED_DATA_V3]: 'signTypedData_v3',
    [ETHMessageTypes.TYPED_DATA_V4]: 'signTypedData_v4',
  } as const;
  return signTypeMap[signType];
};

const renderCard = (text: string) => (
  <VStack bg="surface-default" borderRadius="12px" mt="4">
    <HStack justifyContent="space-between" space="16px" padding="16px">
      <Text
        typography={{ sm: 'Caption', md: 'Caption' }}
        color="text-subdued"
        flex={1}
        overflowWrap="anywhere"
      >
        {text || '-'}
      </Text>
    </HStack>
  </VStack>
);

// Render readable message recursively.
const renderMessage = (json: any, padding = 0) => {
  if (isNil(json)) {
    return <Typography.Body2>{'null\n'}</Typography.Body2>;
  }

  if (typeof json === 'boolean') {
    return (
      <Typography.Body2>{`${json ? 'true' : 'false'}\n`}</Typography.Body2>
    );
  }

  if (typeof json === 'string' || typeof json === 'number') {
    return (
      <Typography.Body2 wordBreak="break-all" whiteSpace="pre-wrap">
        {json}
        {'\n'}
      </Typography.Body2>
    );
  }

  const siblings = Object.keys(json).map((key) => (
    <Typography.Body2 color="text-subdued">
      {`${''.padStart(padding)}${key}: `}
      {renderMessage(json[key], padding + 4)}
    </Typography.Body2>
  ));

  return (
    <Typography.Body2>
      {padding ? '\n' : ''}
      {siblings}
    </Typography.Body2>
  );
};

const renderMessageCard = (unsignedMessage: IUnsignedMessageEvm) => {
  const { message, type } = unsignedMessage;

  if (type === ETHMessageTypes.PERSONAL_SIGN) {
    // if (message.startsWith('0x')) {
    //   const buffer = Buffer.from(message.substr(2), 'hex');
    //   message = buffer.toString('utf8');
    // }
    let personalSignMsg = message;
    try {
      const buffer = ethUtils.toBuffer(message);
      personalSignMsg = buffer.toString('utf-8');
    } catch (error) {
      console.error(error);
    }
    return renderCard(personalSignMsg);
  }

  let messageObject = JSON.parse(message) ?? {};
  messageObject = messageObject.message ?? messageObject;

  if (type === ETHMessageTypes.TYPED_DATA_V1 && Array.isArray(messageObject)) {
    const v1Message: TypedDataV1[] = messageObject;
    messageObject = v1Message.reduce((acc, cur) => {
      acc[cur.name] = cur.value;
      return acc;
    }, {} as Record<string, string>);
  }

  return (
    <VStack bg="surface-default" borderRadius="12px" mt="4">
      <HStack justifyContent="space-between" space="16px" padding="16px">
        <Text flex={1} overflowWrap="anywhere">
          {renderMessage(messageObject)}
        </Text>
      </HStack>
    </VStack>
  );
};

const renderDataCard = (unsignedMessage: IUnsignedMessageEvm) => {
  const { message, type } = unsignedMessage;

  if (type === ETHMessageTypes.PERSONAL_SIGN) {
    return renderCard(message);
  }

  let formattedJson = '';
  try {
    formattedJson = JSON.stringify(JSON.parse(message), null, 4);
  } catch (e) {
    console.error(e);
  }
  return renderCard(formattedJson);
};

const SignDetail: FC<{
  unsignedMessage: IUnsignedMessageEvm;
  sourceInfo?: IDappSourceInfo;
}> = ({ unsignedMessage, sourceInfo }) => {
  const intl = useIntl();
  const { accountId } = useActiveWalletAccount();
  const { type, message } = unsignedMessage;
  const [curTab, setCurTab] = useState<TabType>('message');

  const isWatchingAccount = useMemo(
    () => accountId && accountId.startsWith('watching-'),
    [accountId],
  );

  const header = useMemo(
    () => (
      <ConfirmHeader
        title={intl.formatMessage({
          id: 'title__signature_request',
        })}
        origin={sourceInfo?.origin}
      />
    ),
    [intl, sourceInfo?.origin],
  );

  const warning = useMemo(
    () => (
      <VStack
        bg="surface-critical-subdued"
        borderColor="border-critical-subdued"
        borderRadius="12px"
        borderWidth={1}
      >
        <HStack justifyContent="space-between" space="16px" padding="16px">
          <Image size="20px" source={X} />
          <Typography.Body2 maxW="95%">
            {intl.formatMessage({
              id: 'msg__signing_this_message_can_be_dangerous_Only_sign_this_message_if_you_fully_trust_this_site_and_understand_the_potential_risks',
            })}
          </Typography.Body2>
        </HStack>
      </VStack>
    ),
    [intl],
  );

  // CollapsibleTabView doesn't work on mobile
  const renderTabBar = () => {
    const isMessageTab = curTab === 'message';
    return (
      <HStack
        borderBottomWidth={1}
        borderBottomColor="border-subdued"
        space={2}
      >
        <VStack mb="-1px">
          <Button
            type="plain"
            size="base"
            _text={{ color: isMessageTab ? 'text-default' : 'text-subdued' }}
            onPress={() => setCurTab('message')}
          >
            {intl.formatMessage({
              id: 'form__message_tab',
            })}
          </Button>
          {isMessageTab && <Center bg="action-primary-default" height="2px" />}
        </VStack>
        <VStack mb="-1px">
          <Button
            type="plain"
            size="base"
            _text={{ color: !isMessageTab ? 'text-default' : 'text-subdued' }}
            onPress={() => setCurTab('data')}
          >
            {intl.formatMessage({
              id: 'form__data_tab',
            })}
          </Button>
          {!isMessageTab && <Center bg="action-primary-default" height="2px" />}
        </VStack>
      </HStack>
    );
  };

  return type === ETHMessageTypes.ETH_SIGN ? (
    <VStack>
      {header}
      {warning}
      <Typography.Subheading mt="24px" color="text-subdued">
        {intl.formatMessage({ id: 'form__message_tab' })}
      </Typography.Subheading>
      {renderCard(message)}
    </VStack>
  ) : (
    <VStack>
      {header}
      {renderTabBar()}
      {curTab === 'message' ? (
        <VStack>
          {renderMessageCard(unsignedMessage)}
          {isWatchingAccount ? (
            <FormErrorMessage
              message={intl.formatMessage({
                id: 'form__error_trade_with_watched_acocunt' as any,
              })}
            />
          ) : null}
        </VStack>
      ) : (
        <VStack flex="1">
          {renderDataCard(unsignedMessage)}
          <Typography.Subheading mt="24px" color="text-subdued">
            {intl.formatMessage({ id: 'form__sign_method_type_uppercase' })}
          </Typography.Subheading>
          <Typography.Body2 mt="6px">
            {getSignTypeString(type)}
          </Typography.Body2>
        </VStack>
      )}
    </VStack>
  );
};

export default SignDetail;
