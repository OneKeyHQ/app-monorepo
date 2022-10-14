import React from 'react';

import { useIntl } from 'react-intl';

import { Alert, Box } from '@onekeyhq/components';

import { TxDetailExtraInfoBox } from './components/TxDetailExtraInfoBox';
import { TxDetailTopHeader } from './components/TxDetailTopHeader';
import { getReplacedTxAlertTextKeys } from './elements/TxActionElementReplacedTxText';
import { TxActionsListView } from './TxActionsListView';
import { TxDetailContextProvider } from './TxDetailContext';
import { ITxActionListViewProps } from './types';
import { getDisplayedActions } from './utils/utilsTxDetail';

export function TxDetailView(props: ITxActionListViewProps) {
  const {
    historyTx,
    decodedTx,
    isHistoryDetail,
    isSendConfirm,
    sendConfirmParamsParsed,
  } = props;
  const replacedTxTextKeys = getReplacedTxAlertTextKeys({ historyTx });
  const intl = useIntl();
  const actions = getDisplayedActions({ decodedTx });
  const isMultipleActions = actions.length > 1;
  return (
    <>
      {replacedTxTextKeys && replacedTxTextKeys.length ? (
        <Box testID="replacedTxTextKeys" mb={6}>
          <Alert
            title={intl.formatMessage({ id: replacedTxTextKeys[0] })}
            description={intl.formatMessage({ id: replacedTxTextKeys[1] })}
            alertType="info"
          />
        </Box>
      ) : null}

      {isMultipleActions ? (
        <Box testID="TxDetailTopHeader" mb={6}>
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
        sendConfirmParamsParsed={sendConfirmParamsParsed}
      >
        <TxActionsListView {...props} transformType="T1" space={6} />
      </TxDetailContextProvider>
      {isMultipleActions ? <Box h={6} /> : <Box h={8} />}
      <TxDetailExtraInfoBox {...props} />
    </>
  );
}
