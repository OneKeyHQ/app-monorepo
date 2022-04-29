import React from 'react';

import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useIntl } from 'react-intl';

import { Container, Spinner } from '@onekeyhq/components';
import { InfiniteAmountText } from '@onekeyhq/engine/src/vaults/impl/evm/decoder/decoder';

import TxTokenApproveDetail from '../../TxDetail/TxTokenApproveDetail';
import { FeeInfoInputForConfirm } from '../FeeInfoInput';
import { SendRoutes, SendRoutesParams } from '../types';

import { ITxConfirmViewProps, SendConfirmModal } from './SendConfirmModal';

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
    decodedTx,
  } = props;
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();

  const approveAmount = decodedTx?.info?.amount as string;
  const isMaxAmount = approveAmount === InfiniteAmountText;
  const feeInput = (
    <FeeInfoInputForConfirm
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
          : `${approveAmount} ${decodedTx?.info?.token?.symbol as string}`
      }
      hasArrow
      onPress={() => {
        navigation.navigate(SendRoutes.TokenApproveAmountEdit, {
          tokenApproveAmount: approveAmount,
          isMaxAmount,
          sourceInfo,
          encodedTx,
          decodedTx,
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
