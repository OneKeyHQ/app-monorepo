import { useMemo } from 'react';

import * as ethUtils from 'ethereumjs-util';
import { useIntl } from 'react-intl';

import type { IUnsignedMessage } from '@onekeyhq/core/src/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EMessageTypesAptos,
  EMessageTypesBtc,
  EMessageTypesCommon,
  EMessageTypesEth,
  EMessageTypesSolana,
  EMessageTypesTron,
} from '@onekeyhq/shared/types/message';

import { SignatureConfirmItem } from '../SignatureConfirmItem';

import { DataViewer } from './DataViewer';

type ITypedDataV1 = {
  type: string;
  name: string;
  value: string;
};

type IProps = {
  unsignedMessage: IUnsignedMessage;
};

function MessageDataViewer(props: IProps) {
  const { unsignedMessage } = props;
  const intl = useIntl();

  const parseMessage = useMemo(() => {
    const { message, type, payload } = unsignedMessage;

    switch (type) {
      case EMessageTypesBtc.ECDSA:
      case EMessageTypesBtc.BIP322_SIMPLE:
      case EMessageTypesEth.ETH_SIGN:
      case EMessageTypesCommon.SIMPLE_SIGN: {
        return message;
      }

      case EMessageTypesEth.PERSONAL_SIGN:
      case EMessageTypesCommon.SIGN_MESSAGE:
      case EMessageTypesSolana.SIGN_OFFCHAIN_MESSAGE:
      case EMessageTypesTron.SIGN_MESSAGE_V2: {
        try {
          const buffer = ethUtils.toBuffer(message);
          return buffer.toString('utf8');
        } catch (e) {
          console.error('Failed to parse personal sign message: ', e);
          return message;
        }
      }

      case EMessageTypesCommon.HEX_MESSAGE: {
        return Buffer.from(message, 'hex').toString('utf8');
      }

      case EMessageTypesAptos.SIGN_MESSAGE: {
        return payload?.message ?? message;
      }

      case EMessageTypesAptos.SIGN_IN: {
        return payload?.message ?? message;
      }

      case EMessageTypesTron.SIGN_MESSAGE: {
        return message;
      }

      case EMessageTypesEth.TYPED_DATA_V1: {
        let messageObject = JSON.parse(message) ?? {};
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        messageObject = messageObject.message ?? messageObject;
        if (Array.isArray(messageObject)) {
          const v1Message: ITypedDataV1[] = messageObject;
          messageObject = v1Message.reduce((acc, cur) => {
            acc[cur.name] = cur.value;
            return acc;
          }, {} as Record<string, string>);
        }
        return JSON.stringify(messageObject, null, 2);
      }

      case EMessageTypesEth.TYPED_DATA_V3:
      case EMessageTypesEth.TYPED_DATA_V4: {
        try {
          let messageObject = JSON.parse(message);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          messageObject = messageObject?.message ?? messageObject;
          return JSON.stringify(
            typeof messageObject === 'string'
              ? JSON.parse(messageObject) ?? {}
              : messageObject,
            null,
            2,
          );
        } catch {
          return message;
        }
      }

      default: {
        return message;
      }
    }
  }, [unsignedMessage]);

  return (
    <SignatureConfirmItem>
      <SignatureConfirmItem.Label>
        {intl.formatMessage({ id: ETranslations.dapp_connect_message })}
      </SignatureConfirmItem.Label>
      <DataViewer data={parseMessage} />
    </SignatureConfirmItem>
  );
}

export { MessageDataViewer };
