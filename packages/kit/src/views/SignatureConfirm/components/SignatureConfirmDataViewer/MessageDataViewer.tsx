import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { IUnsignedMessage } from '@onekeyhq/core/src/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

import { SignatureConfirmItem } from '../SignatureConfirmItem';

import { DataViewer } from './DataViewer';

type IProps = {
  unsignedMessage: IUnsignedMessage;
};

function MessageDataViewer(props: IProps) {
  const { unsignedMessage } = props;
  const intl = useIntl();

  const renderRawMessage = useCallback(() => {
    const { message, type } = unsignedMessage;
    let text = message;

    if (
      type === EMessageTypesEth.TYPED_DATA_V1 ||
      type === EMessageTypesEth.TYPED_DATA_V3 ||
      type === EMessageTypesEth.TYPED_DATA_V4
    ) {
      try {
        text = JSON.parse(text);
      } catch (e) {
        console.error('Failed to parse typed data message: ', e);
      }
      text = JSON.stringify(text, null, 2);
    }
    return <DataViewer data={text} />;
  }, [unsignedMessage]);

  return (
    <SignatureConfirmItem>
      <SignatureConfirmItem.Label>
        {intl.formatMessage({ id: ETranslations.dapp_connect_message })}
      </SignatureConfirmItem.Label>
      {renderRawMessage()}
    </SignatureConfirmItem>
  );
}

export { MessageDataViewer };
