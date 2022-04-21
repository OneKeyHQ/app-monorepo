/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Column, Row } from 'native-base';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Divider,
  Pressable,
  Spinner,
  Text,
  Token,
  Typography,
  useThemeValue,
} from '@onekeyhq/components';
import { IEncodedTxAny } from '@onekeyhq/engine/src/types/vault';
import {
  EVMDecodedItem,
  InfiniteAmountText,
} from '@onekeyhq/engine/src/vaults/impl/evm/decoder/decoder';
import { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../../hooks/redux';
import TokenApprove from '../../TxDetail/TokenApprove';
import { DecodeTxButtonTest } from '../DecodeTxButtonTest';
import { FeeInfoInputForConfirm } from '../FeeInfoInput';
import { TxTitleDetailView } from '../TxTitleDetailView';
import { SendRoutes, SendRoutesParams } from '../types';

import { ITxConfirmViewProps, SendConfirmModal } from './SendConfirmModal';

type NavigationProps = NativeStackNavigationProp<
  SendRoutesParams,
  SendRoutes.TokenApproveAmountEdit
>;
type RouteProps = RouteProp<
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
  } = props;
  const intl = useIntl();
  const [decodedTx, setDecodedTx] = useState<EVMDecodedItem | null>(null);
  const cardBgColor = useThemeValue('surface-default');
  const encodedTxEvm = encodedTx as IEncodedTxEvm;
  const { networkId, accountId } = useActiveWalletAccount();
  const navigation = useNavigation<NavigationProps>();
  // const route = useRoute<RouteProps>();
  // const { tokenApproveAmount } = route.params;
  const { engine } = backgroundApiProxy;
  useEffect(() => {
    (async () => {
      // TODO move to SendConfirm
      const tx = await engine.decodeTx({
        networkId,
        accountId,
        encodedTx,
      });
      setDecodedTx(tx);
    })();
  }, [accountId, encodedTx, engine, networkId]);

  const approveAmount = decodedTx?.info?.amount as string;
  const isMaxAmount = approveAmount === InfiniteAmountText;
  const token = decodedTx?.info?.token;
  const feeInput = (
    <FeeInfoInputForConfirm
      editable={feeInfoEditable}
      encodedTx={encodedTx}
      feeInfoPayload={feeInfoPayload}
      loading={feeInfoLoading}
    />
  );
  const approveAmountInput = (
    <Pressable
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
    >
      {({ isHovered }) => (
        <TxTitleDetailView
          arrow
          title={intl.formatMessage({
            id: 'content__spend_limit_amount',
          })}
          detail={
            isMaxAmount
              ? intl.formatMessage({ id: 'form__unlimited' })
              : `${approveAmount} ${decodedTx?.info?.token?.symbol as string}`
          }
          isHovered={isHovered}
        />
      )}
    </Pressable>
  );

  return (
    <SendConfirmModal
      header={intl.formatMessage({ id: 'title__approve' })}
      {...props}
    >
      {decodedTx ? (
        <TokenApprove
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
