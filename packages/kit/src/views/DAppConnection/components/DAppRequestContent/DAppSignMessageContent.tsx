import { useCallback, useMemo, useState } from 'react';

import * as ethUtils from 'ethereumjs-util';
import { useIntl } from 'react-intl';

import { Button, SizableText, TextArea, YStack } from '@onekeyhq/components';
import type { IUnsignedMessage } from '@onekeyhq/core/src/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EMessageTypesBtc,
  EMessageTypesCommon,
  EMessageTypesEth,
} from '@onekeyhq/shared/types/message';

type ITypedDataV1 = {
  type: string;
  name: string;
  value: string;
};

function DAppSignMessageContent({
  unsignedMessage,
}: {
  unsignedMessage: IUnsignedMessage;
}) {
  const intl = useIntl();
  const [showRawMessage, setShowRawMessage] = useState(false);

  const parseMessage = useMemo(() => {
    const { message, type } = unsignedMessage;

    if (
      type === EMessageTypesBtc.ECDSA ||
      type === EMessageTypesBtc.BIP322_SIMPLE ||
      type === EMessageTypesEth.ETH_SIGN ||
      type === EMessageTypesCommon.SIMPLE_SIGN
    ) {
      return message;
    }

    if (
      type === EMessageTypesEth.PERSONAL_SIGN ||
      type === EMessageTypesCommon.SIGN_MESSAGE
    ) {
      try {
        const buffer = ethUtils.toBuffer(message);
        return buffer.toString('utf8');
      } catch (e) {
        console.error('Failed to parse personal sign message: ', e);
        return message;
      }
    }

    let messageObject = JSON.parse(message) ?? {};
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    messageObject = messageObject.message ?? messageObject;

    if (
      type === EMessageTypesEth.TYPED_DATA_V1 &&
      Array.isArray(messageObject)
    ) {
      const v1Message: ITypedDataV1[] = messageObject;
      messageObject = v1Message.reduce((acc, cur) => {
        acc[cur.name] = cur.value;
        return acc;
      }, {} as Record<string, string>);
    }

    return JSON.stringify(messageObject, null, 2);
  }, [unsignedMessage]);

  const renderRawMessage = useCallback(() => {
    const { message, type } = unsignedMessage;
    if (
      type === EMessageTypesBtc.ECDSA ||
      type === EMessageTypesBtc.BIP322_SIMPLE ||
      type === EMessageTypesEth.ETH_SIGN ||
      type === EMessageTypesCommon.SIMPLE_SIGN
    ) {
      return null;
    }

    let text = message;
    if (
      type === EMessageTypesEth.TYPED_DATA_V1 ||
      type === EMessageTypesEth.TYPED_DATA_V3 ||
      type === EMessageTypesEth.TYPED_DATA_V4
    ) {
      try {
        text = JSON.parse(text);
      } catch (e) {
        console.error('Failed to parse typed data v4 message: ', e);
      }
    }
    return (
      <YStack space="$2">
        <Button
          variant="secondary"
          onPress={() => setShowRawMessage(!showRawMessage)}
        >
          {showRawMessage
            ? intl.formatMessage({
                id: ETranslations.dapp_connect_hide_full_message,
              })
            : intl.formatMessage({
                id: ETranslations.dapp_connect_view_full_message,
              })}
        </Button>
        {showRawMessage ? (
          <TextArea editable={false} numberOfLines={11}>
            {JSON.stringify(text, null, 2)}
          </TextArea>
        ) : null}
      </YStack>
    );
  }, [intl, unsignedMessage, showRawMessage]);

  return (
    <YStack justifyContent="center">
      <SizableText color="$text" size="$headingMd" mb="$2">
        {intl.formatMessage({ id: ETranslations.dapp_connect_message })}
      </SizableText>
      <YStack space="$2">
        <TextArea value={parseMessage} editable={false} numberOfLines={11} />
        {renderRawMessage()}
      </YStack>
    </YStack>
  );
}

export { DAppSignMessageContent };
