import { useIntl } from 'react-intl';

import { Alert, Box } from '@onekeyhq/components';

import { TxDetailExtraInfoBox } from './components/TxDetailExtraInfoBox';
import { TxInteractInfo } from './components/TxInteractInfo';
import { getReplacedTxAlertTextKeys } from './elements/TxActionElementReplacedTxText';
import { TxActionsListView } from './TxActionsListView';
import { TxDetailContextProvider } from './TxDetailContext';

import type { ITxActionListViewProps } from './types';

export function TxDetailView(props: ITxActionListViewProps) {
  const {
    historyTx,
    decodedTx,
    isHistoryDetail,
    isSendConfirm,
    sendConfirmParamsParsed,
    advancedSettingsForm,
  } = props;
  const replacedTxTextKeys = getReplacedTxAlertTextKeys({ historyTx });
  const intl = useIntl();
  // const actions = getDisplayedActions({ decodedTx });
  // const isMultipleActions = actions.length > 1;
  const isMultipleActions = true;
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

      {/* {isMultipleActions ? ( */}
      {/*   <Box testID="TxDetailTopHeader" mb={6}> */}
      {/*     <TxDetailTopHeader */}
      {/*       showSubTitle={!!isHistoryDetail} */}
      {/*       decodedTx={decodedTx} */}
      {/*     /> */}
      {/*   </Box> */}
      {/* ) : null} */}

      <TxInteractInfo
        origin={
          decodedTx?.interactInfo?.url ??
          sendConfirmParamsParsed?.sourceInfo?.origin ??
          ''
        }
        networkId={decodedTx?.networkId ?? ''}
      />
      <TxDetailContextProvider
        isMultipleActions={isMultipleActions}
        isHistoryDetail={isHistoryDetail}
        isSendConfirm={isSendConfirm}
        sendConfirmParamsParsed={sendConfirmParamsParsed}
      >
        <>
          <TxDetailExtraInfoBox {...props} />
          {advancedSettingsForm}
          {isMultipleActions ? <Box h={6} /> : <Box h={8} />}
          <TxActionsListView {...props} transformType="T1" space={6} />
        </>
      </TxDetailContextProvider>
    </>
  );
}
