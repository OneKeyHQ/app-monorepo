import React from 'react';

import { useIntl } from 'react-intl';

import { Modal } from '@onekeyhq/components';
import { ModalProps } from '@onekeyhq/components/src/Modal';
import {
  IEncodedTxAny,
  IFeeInfoPayload,
} from '@onekeyhq/engine/src/types/vault';

import { IDappCallParams } from '../../../background/IBackgroundApi';
import { useActiveWalletAccount } from '../../../hooks/redux';
import { TransferSendParamsPayload } from '../types';

// TODO networkId, accountId, onSuccess
export type ITxConfirmViewProps = ModalProps & {
  // TODO rename sourceInfo
  sourceInfo?: IDappCallParams;
  encodedTx: IEncodedTxAny;
  decodedTx?: any;
  onEncodedTxUpdate?: (encodedTx: IEncodedTxAny) => void;
  feeInfoPayload: IFeeInfoPayload | null;
  feeInfoLoading: boolean;
  feeInfoEditable?: boolean;
  payload?: any | TransferSendParamsPayload;
  children?: React.ReactElement;
};

// TODO rename SendConfirmModalBase
function SendConfirmModal(props: ITxConfirmViewProps) {
  const intl = useIntl();
  const { network } = useActiveWalletAccount();
  const { children, encodedTx, decodedTx, ...others } = props;

  return (
    <Modal
      height="598px"
      primaryActionTranslationId="action__confirm"
      primaryActionProps={{
        isDisabled: !encodedTx || !decodedTx,
      }}
      secondaryActionTranslationId="action__reject"
      header={intl.formatMessage({ id: 'transaction__transaction_confirm' })}
      headerDescription={
        network?.network?.name || network?.network?.shortName || undefined
      }
      onSecondaryActionPress={({ close }) => close()}
      {...others}
      scrollViewProps={{
        children,
      }}
    />
  );
}
export { SendConfirmModal };
