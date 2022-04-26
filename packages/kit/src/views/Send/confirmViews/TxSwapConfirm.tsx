import React from 'react';

import { Spinner } from '@onekeyhq/components';

import { SwapQuote } from '../../Swap/typings';
import TxSwapConfirmDetail from '../../TxDetail/TxSwapConfirmDetail';
import { FeeInfoInputForConfirm } from '../FeeInfoInput';

import { ITxConfirmViewProps, SendConfirmModal } from './SendConfirmModal';

function TxSwapConfirm(props: ITxConfirmViewProps) {
  const {
    feeInfoPayload,
    feeInfoLoading,
    feeInfoEditable,
    encodedTx,
    sourceInfo,
    decodedTx,
    payload,
  } = props;

  if (!decodedTx || !payload || payload.payloadType !== 'InternalSwap') {
    // TODO: make sure decodedTx is always set
    return <Spinner />;
  }
  const swapQuote = payload as SwapQuote;

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
      <TxSwapConfirmDetail
        tx={decodedTx}
        swapQuote={swapQuote}
        sourceInfo={sourceInfo}
        feeInfoPayload={feeInfoPayload}
        feeInput={feeInput}
      />
    </SendConfirmModal>
  );
}

export { TxSwapConfirm };
