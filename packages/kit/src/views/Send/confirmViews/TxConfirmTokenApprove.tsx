import React from 'react';

import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useIntl } from 'react-intl';

import { Container, Spinner } from '@onekeyhq/components';
import {
  EVMDecodedItemERC20Approve,
  InfiniteAmountText,
} from '@onekeyhq/engine/src/vaults/impl/evm/decoder/decoder';
import { IDecodedTxLegacy } from '@onekeyhq/engine/src/vaults/types';

import TxTokenApproveDetail from '../../TxDetail/_legacy/TxTokenApproveDetail';
import { FeeInfoInputForConfirm } from '../FeeInfoInput';
import {
  ITxConfirmViewProps,
  SendConfirmModal,
} from '../SendConfirmViews/SendConfirmModal';
import { SendRoutes, SendRoutesParams } from '../types';

type NavigationProps = NativeStackNavigationProp<
  SendRoutesParams,
  SendRoutes.TokenApproveAmountEdit
>;

function TxConfirmTokenApprove(props: ITxConfirmViewProps) {
  const {
    feeInfoPayload,
    feeInfoLoading,
    feeInfoEditable,
    encodedTx,
    sourceInfo,
    decodedTx: decodedTxLegacy,
    sendConfirmParams,
  } = props;
  const decodedTx = decodedTxLegacy as IDecodedTxLegacy;

  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();

  const info = decodedTx?.info as EVMDecodedItemERC20Approve | null;
  const approveAmount = info?.amount as string;
  const isMaxAmount = approveAmount === InfiniteAmountText;
  const feeInput = (
    <FeeInfoInputForConfirm
      sendConfirmParams={sendConfirmParams}
      editable={feeInfoEditable}
      encodedTx={encodedTx}
      feeInfoPayload={feeInfoPayload}
      loading={feeInfoLoading}
    />
  );

  const approveAmountInput = (
    <Container.Item
      title={intl.formatMessage({ id: 'content__spend_limit_amount' })}
      describe={
        isMaxAmount
          ? intl.formatMessage({ id: 'form__unlimited' })
          : `${approveAmount} ${info?.token?.symbol as string}`
      }
      hasArrow
      onPress={() => {
        if (!decodedTx) {
          return;
        }
        navigation.navigate(SendRoutes.TokenApproveAmountEdit, {
          sendConfirmParams,
          tokenApproveAmount: approveAmount,
          isMaxAmount,
          sourceInfo,
          encodedTx,
          decodedTx: decodedTx as any,
        });
        // TODO update Approve amount
        // const tx = cloneDeep(encodedTx) as IEncodedTxEvm;
        // tx.data = '0x095ea7b3000000000000000000000000888888888';
        // onEncodedTxUpdate?.(tx);
      }}
    />
  );

  return (
    <SendConfirmModal
      header={intl.formatMessage({ id: 'title__approve' })}
      {...props}
    >
      {decodedTx ? (
        <TxTokenApproveDetail
          tx={decodedTx}
          sourceInfo={sourceInfo}
          approveAmountInput={approveAmountInput}
          feeInput={feeInput}
        />
      ) : (
        <Spinner />
      )}
    </SendConfirmModal>
  );
}

export { TxConfirmTokenApprove };
