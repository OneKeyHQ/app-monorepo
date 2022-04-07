import React from 'react';

import { useIntl } from 'react-intl';

import { Modal } from '@onekeyhq/components';
import { ModalProps } from '@onekeyhq/components/src/Modal';
import {
  IEncodedTxAny,
  IFeeInfoPayload,
} from '@onekeyhq/engine/src/types/vault';

import { IDappCallParams } from '../../../background/IBackgroundApi';
import { TransferSendParamsPayload } from '../types';
import useDappParams from "../../../hooks/useDappParams";

export type ITxPreviewModalProps = ModalProps & {
  source?: IDappCallParams;
  encodedTx: IEncodedTxAny;
  feeInfoPayload: IFeeInfoPayload | null;
  feeInfoLoading: boolean;
  feeInfoEditable?: boolean;
  payload?: any | TransferSendParamsPayload;
  children?: React.ReactElement;
};
function TxPreviewModal(props: ITxPreviewModalProps) {
  const intl = useIntl();
  const { children, ...others } = props;

  return (
    <Modal
      height="598px"
      primaryActionTranslationId="action__confirm"
      secondaryActionTranslationId="action__reject"
      header={intl.formatMessage({ id: 'transaction__transaction_confirm' })}
      // headerDescription={''}
      onSecondaryActionPress={({ close }) => close()}
      {...others}
      scrollViewProps={{
        children,
      }}
    />
  );
}
export { TxPreviewModal };
