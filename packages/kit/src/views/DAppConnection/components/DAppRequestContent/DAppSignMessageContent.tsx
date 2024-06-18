import { useMemo } from 'react';

import * as ethUtils from 'ethereumjs-util';
import { useIntl } from 'react-intl';

import { SizableText, TextArea, YStack } from '@onekeyhq/components';
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

  return (
    <YStack justifyContent="center">
      <SizableText color="$text" size="$headingMd" mb="$2">
        {intl.formatMessage({ id: ETranslations.dapp_connect_message })}
      </SizableText>
      <TextArea value={parseMessage} editable={false} numberOfLines={11} />
    </YStack>
  );
}

export { DAppSignMessageContent };
