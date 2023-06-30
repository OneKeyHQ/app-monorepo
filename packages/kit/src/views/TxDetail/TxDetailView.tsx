import { useIntl } from 'react-intl';

import { Alert, Box, Text } from '@onekeyhq/components';

import { TxDetailAdvanceInfoBox } from './components/TxDetailAdvanceInfoBox';
import { TxDetailExtraInfoBox } from './components/TxDetailExtraInfoBox';
import { TxTopInfoBox } from './components/TxDetailTopInfoBox';
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

      <TxDetailContextProvider
        isMultipleActions={isMultipleActions}
        isHistoryDetail={isHistoryDetail}
        isSendConfirm={isSendConfirm}
        sendConfirmParamsParsed={sendConfirmParamsParsed}
      >
        <>
          <TxTopInfoBox {...props} />
          <TxInteractInfo
            origin={
              decodedTx?.interactInfo?.url ??
              sendConfirmParamsParsed?.sourceInfo?.origin ??
              ''
            }
            networkId={decodedTx?.networkId ?? ''}
          />
          <TxDetailExtraInfoBox {...props} />
          <TxDetailAdvanceInfoBox {...props} />
          {advancedSettingsForm}
          {isMultipleActions ? <Box h={6} /> : <Box h={8} />}
          <Box>
            {isSendConfirm ? null : (
              <Text
                typography="Subheading"
                textTransform="uppercase"
                mb={3}
                color="text-subdued"
              >
                {intl.formatMessage({ id: 'form__transaction' })}
              </Text>
            )}
            <TxActionsListView {...props} transformType="T1" space={6} />
          </Box>
        </>
      </TxDetailContextProvider>
    </>
  );
}
