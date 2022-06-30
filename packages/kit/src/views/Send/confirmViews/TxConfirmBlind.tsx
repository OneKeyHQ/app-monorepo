import React from 'react';

import { Spinner } from '@onekeyhq/components';
import { IDecodedTxLegacy } from '@onekeyhq/engine/src/vaults/types';

import TxConfirmBlindDetail from '../../TxDetail/_legacy/TxConfirmBlindDetail';
import { FeeInfoInputForConfirm } from '../FeeInfoInput';
import {
  ITxConfirmViewProps,
  SendConfirmModal,
} from '../SendConfirmViews/SendConfirmModal';

function TxConfirmBlind(props: ITxConfirmViewProps) {
  const {
    feeInfoPayload,
    feeInfoLoading,
    feeInfoEditable,
    encodedTx,
    sourceInfo,
    decodedTx: decodedTxLegacy,
  } = props;
  const decodedTx = decodedTxLegacy as IDecodedTxLegacy;

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
      {decodedTx ? (
        <TxConfirmBlindDetail
          tx={decodedTx}
          sourceInfo={sourceInfo}
          feeInput={feeInput}
          feeInfoPayload={feeInfoPayload}
        />
      ) : (
        <Spinner />
      )}
    </SendConfirmModal>
  );
}

export { TxConfirmBlind };
