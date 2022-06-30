import React from 'react';

import { NavigationProp } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Address,
  Box,
  Button,
  HStack,
  Pressable,
  Text,
  VStack,
} from '@onekeyhq/components';
import { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import {
  IDecodedTx,
  IDecodedTxStatus,
  IHistoryTx,
} from '@onekeyhq/engine/src/vaults/types';

import { useNavigation } from '../../hooks';
import {
  SendRoutes,
  TransactionDetailModalRoutes,
  TransactionDetailRoutesParams,
} from '../../routes';
import { ModalRoutes, RootRoutes } from '../../routes/routesEnum';
import { ModalScreenProps } from '../../routes/types';
import { SendConfirmActionType, SendConfirmParams } from '../Send/types';

import { TxActionElementTime } from './elements/TxActionElementTime';
import { TxActionsListView } from './TxActionsListView';
import { getTxStatusInfo } from './utils/utilsTxDetail';

type HistoryListViewNavigationProp =
  ModalScreenProps<TransactionDetailRoutesParams>;

// TODO move to service and use updateEncodedTx()
function speedUpOrCancelTx(props: {
  historyTx: IHistoryTx;
  actionType: SendConfirmActionType;
  navigation: NavigationProp<any>;
}) {
  const { historyTx, actionType, navigation } = props;
  const encodedTx = historyTx.decodedTx?.encodedTx ?? {};
  // TODO currently only support EVM
  const encodedTxEvm = { ...encodedTx } as IEncodedTxEvm;
  if (actionType === 'cancel') {
    encodedTxEvm.to = encodedTxEvm.from;
    encodedTxEvm.value = '0';
    encodedTxEvm.data = '0x';
  }
  if (actionType === 'speedUp') {
    //
  }

  const params: SendConfirmParams = {
    // actionType2: '',
    actionType,
    resendActionInfo: {
      type: actionType,
      replaceHistoryId: historyTx.id,
    },
    encodedTx: encodedTxEvm,
    feeInfoEditable: true,
    feeInfoUseFeeInTx: true,
  };
  navigation.navigate(RootRoutes.Modal, {
    screen: ModalRoutes.Send,
    params: {
      screen: SendRoutes.SendConfirm,
      params,
    },
  });
}

function TxListItemViewResendButtons(props: { historyTx: IHistoryTx }) {
  const { historyTx } = props;
  const navigation =
    useNavigation<HistoryListViewNavigationProp['navigation']>();
  const intl = useIntl();

  return (
    <>
      <Button
        size="xs"
        ml={2}
        onPress={() => {
          speedUpOrCancelTx({
            historyTx,
            actionType: 'cancel',
            navigation,
          });
        }}
      >
        {intl.formatMessage({ id: 'action__cancel' })}
      </Button>
      <Button
        type="primary"
        size="xs"
        ml={2}
        onPress={() => {
          speedUpOrCancelTx({
            historyTx,
            actionType: 'speedUp',
            navigation,
          });
        }}
      >
        {intl.formatMessage({ id: 'action__speed_up' })}
      </Button>
    </>
  );
}

function TxListItemView(props: {
  decodedTx: IDecodedTx;
  historyTx: IHistoryTx;
}) {
  const { decodedTx, historyTx } = props;
  const { status } = decodedTx;
  const intl = useIntl();
  const navigation =
    useNavigation<HistoryListViewNavigationProp['navigation']>();
  const statusInfo = getTxStatusInfo({ decodedTx });

  const txHashView = status !== IDecodedTxStatus.Pending && (
    <Address
      typography="Body2"
      color="text-subdued"
      text={decodedTx.txid ?? ''}
      short
      prefix="Hash: "
    />
  );
  const txStatusTextView = status !== IDecodedTxStatus.Confirmed && (
    <Text typography="Body2" color={statusInfo.textColor}>
      {intl.formatMessage({ id: statusInfo.text })}
    </Text>
  );
  let replacedTextView = null;
  if (historyTx.replacedType === 'cancel') {
    replacedTextView = (
      <Text typography="Body2" color="text-subdued">
        TxCancel
      </Text>
    );
  }
  if (historyTx.replacedType === 'speedUp') {
    replacedTextView = (
      <Text typography="Body2" color="text-subdued">
        TxSpeedUp
      </Text>
    );
  }
  const timeView = (
    <TxActionElementTime
      typography="Body2"
      color="text-subdued"
      isShort
      timestamp={decodedTx.updatedAt ?? decodedTx.createdAt}
    />
  );
  return (
    <Pressable.Item
      borderRadius={12}
      onPress={() => {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.TransactionDetail,
          params: {
            screen: TransactionDetailModalRoutes.HistoryDetailModal,
            params: {
              decodedTx,
              historyTx,
            },
          },
        });
      }}
    >
      <VStack>
        <TxActionsListView
          decodedTx={decodedTx}
          transformType="T0"
          space={4}
          showDivider
        />
        <HStack space={2} mt={2}>
          {/* <Box w={8} /> */}
          {txHashView}
          {/* Confirmed TX do not show status text */}
          {txStatusTextView}
          {replacedTextView}
          <Box flex={1} />
          {decodedTx.status === IDecodedTxStatus.Pending ? (
            <TxListItemViewResendButtons historyTx={historyTx} />
          ) : (
            timeView
          )}
        </HStack>
      </VStack>
    </Pressable.Item>
  );
}

export { TxListItemView };
