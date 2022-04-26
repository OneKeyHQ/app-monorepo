import React from 'react';

import { Spinner } from '@onekeyhq/components';

import TxConfirmBlindDetail from '../../TxDetail/TxConfirmBlindDetail';
import { FeeInfoInputForConfirm } from '../FeeInfoInput';

import { ITxConfirmViewProps, SendConfirmModal } from './SendConfirmModal';

function TxConfirmBlind(props: ITxConfirmViewProps) {
  const {
    feeInfoPayload,
    feeInfoLoading,
    feeInfoEditable,
    encodedTx,
    sourceInfo,
    decodedTx,
  } = props;

  if (!decodedTx) {
    // TODO: make sure decodedTx is always set
    return <Spinner />;
  }

  const feeInput = (
    <FeeInfoInputForConfirm
      editable={feeInfoEditable}
      encodedTx={encodedTx}
      feeInfoPayload={feeInfoPayload}
      loading={feeInfoLoading}
    />
  );

  return (
    <SendConfirmModal {...props}>
      <TxConfirmBlindDetail
        tx={decodedTx}
        sourceInfo={sourceInfo}
        feeInput={feeInput}
      />
    </SendConfirmModal>
  );
}

export { TxConfirmBlind };
