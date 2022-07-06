import React from 'react';

import { NavigationProp } from '@react-navigation/native';
import { cloneDeep } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Address,
  Box,
  Button,
  HStack,
  Pressable,
  Text,
  VStack,
  useTheme,
} from '@onekeyhq/components';
import { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import {
  IDecodedTxStatus,
  IHistoryTx,
} from '@onekeyhq/engine/src/vaults/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useActiveWalletAccount, useNavigation } from '../../hooks';
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
  const encodedTx = (historyTx.decodedTx?.encodedTx ?? {}) as IEncodedTxEvm;
  if (!historyTx.decodedTx.nonce) {
    console.error('speedUpOrCancelTx ERROR: nonce is missing!');
    return;
  }
  // set only fields of IEncodedTxEvm
  const encodedTxEvm: IEncodedTxEvm = {
    from: encodedTx.from,
    to: encodedTx.to,
    value: encodedTx.value,
    data: encodedTx.data,
    nonce: historyTx.decodedTx.nonce, // must be number, 0x string will send new tx
  };
  if (actionType === 'cancel') {
    encodedTxEvm.to = encodedTxEvm.from;
    encodedTxEvm.value = '0';
    encodedTxEvm.data = '0x';
    console.log('cancel TX >>>>>> :', encodedTxEvm);
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
      params: cloneDeep(params),
    },
  });
}

function TxListItemViewResendButtons(props: { historyTx: IHistoryTx }) {
  const { historyTx } = props;
  const navigation =
    useNavigation<HistoryListViewNavigationProp['navigation']>();
  const intl = useIntl();

  const isCancel = historyTx.replacedType === 'cancel';

  return (
    <>
      {!isCancel ? (
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
      ) : null}

      <Button
        type="primary"
        size="xs"
        ml={2}
        onPress={() => {
          if (isCancel) {
            speedUpOrCancelTx({
              historyTx,
              actionType: 'cancel',
              navigation,
            });
          } else {
            speedUpOrCancelTx({
              historyTx,
              actionType: 'speedUp',
              navigation,
            });
          }
        }}
      >
        {intl.formatMessage({ id: 'action__speed_up' })}
      </Button>
    </>
  );
}

function TxListItemView(props: {
  historyTx: IHistoryTx;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { historyTx, isFirst, isLast } = props;
  const { decodedTx } = historyTx;
  const { status } = decodedTx;
  const intl = useIntl();
  const { network } = useActiveWalletAccount();
  const { isLight } = useTheme();
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
  const speedUpOrCancelView = network?.settings?.txCanBeReplaced ? (
    <TxListItemViewResendButtons historyTx={historyTx} />
  ) : undefined;
  const timeView = (
    <TxActionElementTime
      typography="Body2"
      color="text-subdued"
      isShort
      timestamp={decodedTx.updatedAt ?? decodedTx.createdAt}
    />
  );
  /*
      borderTopRadius={index === 0 ? '12px' : '0px'}
      borderRadius={index === section.data.length - 1 ? '12px' : '0px'}
      borderWidth={1}
      borderColor={themeVariant === 'light' ? 'border-subdued' : 'transparent'}
      borderTopWidth={index === 0 ? 1 : 0}
      borderBottomWidth={index === section.data.length - 1 ? 1 : 0}
      mb={index === section.data.length - 1 ? 6 : undefined}
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const extraFooterInDev = platformEnv.isDev ? (
    <HStack space={2} mt={2}>
      {/* <Box w={8} /> */}
      {txHashView}
      {/* Confirmed TX do not show status text */}
      {txStatusTextView}
      {replacedTextView}
      <Box flex={1} />
      {timeView}
    </HStack>
  ) : null;
  const paddingY = 16; // should convert to px string
  return (
    <Pressable.Item
      borderTopRadius={isFirst ? 12 : 0}
      borderBottomRadius={isLast ? 12 : 0}
      borderWidth={isLight ? 1 : 0}
      borderBottomWidth={isLast && isLight ? 1 : 0}
      borderTopWidth={isFirst && isLight ? 1 : 0}
      borderColor="border-subdued"
      px={{ base: '4', lg: '6' }}
      py={`${paddingY}px`}
      onPress={() => {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.TransactionDetail,
          params: {
            screen: TransactionDetailModalRoutes.HistoryDetailModal,
            params: cloneDeep({
              decodedTx,
              historyTx,
            }),
          },
        });
      }}
    >
      <VStack>
        <TxActionsListView
          historyTx={historyTx}
          decodedTx={decodedTx}
          transformType="T0"
          space={`${paddingY * 2 - 1}px`}
          showDivider
        />
        {decodedTx.status === IDecodedTxStatus.Pending ? (
          <HStack space={2} mt={2}>
            <Box flex={1} />
            {speedUpOrCancelView}
          </HStack>
        ) : null}
        {/* {extraFooterInDev} */}
      </VStack>
    </Pressable.Item>
  );
}

export { TxListItemView };
