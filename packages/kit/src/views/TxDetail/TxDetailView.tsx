import React from 'react';

import { useIntl } from 'react-intl';

import { Alert, Box, HStack, Text } from '@onekeyhq/components';
import { IDecodedTxStatus } from '@onekeyhq/engine/src/vaults/types';

import { TxDetailFeeInfoBox } from './components/TxDetailFeeInfoBox';
import { TxDetailTopHeader } from './components/TxDetailTopHeader';
import { TxListActionBox } from './components/TxListActionBox';
import {
  TxActionElementIconNormal,
  TxActionElementIconXLarge,
} from './elements/TxActionElementIcon';
import {
  getReplacedTxAlertTextKeys,
  getReplacedTxTextKey,
} from './elements/TxActionElementReplacedTxText';
import { TxActionElementStatusText } from './elements/TxActionElementStatusText';
import { TxActionElementTime } from './elements/TxActionElementTime';
import {
  TxActionElementTitleHeading,
  TxActionElementTitleNormal,
} from './elements/TxActionElementTitle';
import { TxActionsListView } from './TxActionsListView';
import { TxDetailContextProvider } from './TxDetailContext';
import { ITxActionListViewProps } from './types';
import { getDisplayedActions } from './utils/utilsTxDetail';

export function TxDetailView(props: ITxActionListViewProps) {
  const { historyTx, decodedTx, isHistoryDetail, isSendConfirm } = props;
  const replacedTxTextKeys = getReplacedTxAlertTextKeys({ historyTx });
  const intl = useIntl();
  const actions = getDisplayedActions({ decodedTx });
  const isMultipleActions = actions.length > 1;
  return (
    <>
      {replacedTxTextKeys && replacedTxTextKeys.length ? (
        <Box mb={6}>
          <Alert
            title={intl.formatMessage({ id: replacedTxTextKeys[0] })}
            description={intl.formatMessage({ id: replacedTxTextKeys[1] })}
            alertType="info"
          />
        </Box>
      ) : null}

      {isMultipleActions ? (
        <Box mb={6}>
          <TxDetailTopHeader
            showSubTitle={!!isHistoryDetail}
            decodedTx={decodedTx}
          />
        </Box>
      ) : null}

      <TxDetailContextProvider
        isMultipleActions={isMultipleActions}
        isHistoryDetail={isHistoryDetail}
        isSendConfirm={isSendConfirm}
      >
        <TxActionsListView {...props} transformType="T1" space={6} />
      </TxDetailContextProvider>
      {isMultipleActions ? <Box h={6} /> : <Box h={8} />}
      <TxDetailFeeInfoBox {...props} />
    </>
  );
}
