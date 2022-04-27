import React from 'react';

import { useIntl } from 'react-intl';

import { Spinner } from '@onekeyhq/components';

import { SwapQuote } from '../../Swap/typings';
import TxConfirmSwapDetail from '../../TxDetail/TxConfirmSwapDetail';
import { FeeInfoInputForConfirm } from '../FeeInfoInput';

import { ITxConfirmViewProps, SendConfirmModal } from './SendConfirmModal';

function TxConfirmSwap(props: ITxConfirmViewProps) {
  const {
    feeInfoPayload,
    feeInfoLoading,
    feeInfoEditable,
    encodedTx,
    sourceInfo,
    decodedTx,
    payload,
  } = props;
  const intl = useIntl();

  const feeInput = (
    <FeeInfoInputForConfirm
      editable={feeInfoEditable}
      encodedTx={encodedTx}
      feeInfoPayload={feeInfoPayload}
      loading={feeInfoLoading}
    />
  );

  let content = <Spinner />;
  if (decodedTx && payload && payload.payloadType === 'InternalSwap') {
    const swapQuote = payload as SwapQuote;
    content = (
      <TxConfirmSwapDetail
        tx={decodedTx}
        swapQuote={swapQuote}
        sourceInfo={sourceInfo}
        feeInfoPayload={feeInfoPayload}
        feeInput={feeInput}
      />
    );
  }

  return (
    <SendConfirmModal
      header={intl.formatMessage({ id: 'title__swap' })}
      {...props}
    >
      {content}
    </SendConfirmModal>
  );
}

export { TxConfirmSwap };
