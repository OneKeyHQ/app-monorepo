import { cloneDeep } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Address,
  Box,
  HStack,
  Pressable,
  Text,
  VStack,
  useTheme,
} from '@onekeyhq/components';
import type { IHistoryTx } from '@onekeyhq/engine/src/vaults/types';
import { IDecodedTxStatus } from '@onekeyhq/engine/src/vaults/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useActiveWalletAccount, useNavigation } from '../../hooks';
import {
  ModalRoutes,
  RootRoutes,
  TransactionDetailModalRoutes,
} from '../../routes/routesEnum';

import { TxResendButtons } from './components/TxResendButtons';
import { TxActionElementTime } from './elements/TxActionElementTime';
import { TxActionsListView } from './TxActionsListView';
import { getTxStatusInfo } from './utils/utilsTxDetail';

import type { HistoryListViewNavigationProp } from './components/TxResendButtons';

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
    <TxResendButtons historyTx={historyTx} />
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
          showConnectionLine
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
