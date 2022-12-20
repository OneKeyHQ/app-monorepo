import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Container } from '@onekeyhq/components';

import { useNetworkSimple } from '../../hooks';

import { TxInteractInfo } from './components/TxInteractInfo';
import { TxActionsListView } from './TxActionsListView';
import { TxDetailContextProvider } from './TxDetailContext';
import { getTxActionMeta } from './utils/getTxActionMeta';
import { getDisplayedActions } from './utils/utilsTxDetail';

import type { ITxActionListViewProps } from './types';

function BatchTxsItemView(props: ITxActionListViewProps) {
  const {
    decodedTx,
    isSendConfirm,
    transferAmount,
    transformType = 'T1',
    sendConfirmParamsParsed,
    isSingleTransformMode,
  } = props;
  const intl = useIntl();
  const network = useNetworkSimple(decodedTx.networkId);

  const displayedActions = getDisplayedActions({ decodedTx });

  const renderBatchTxsItem = useCallback(
    () =>
      displayedActions.map((action, index) => {
        const metaInfo = getTxActionMeta({
          action,
          decodedTx,
          intl,
          historyTx: undefined,
        });
        metaInfo.meta.transferAmount = transferAmount;

        const { meta, components } = metaInfo;
        const TxActionComponent = components[transformType];

        return (
          <Container.Item
            wrap={
              <TxActionComponent
                {...metaInfo.props}
                meta={meta}
                network={network}
              />
            }
            hidePadding
            key={index}
          />
        );
      }),
    [decodedTx, displayedActions, intl, network, transferAmount, transformType],
  );

  return (
    <>
      <TxInteractInfo
        origin={
          decodedTx?.interactInfo?.url ??
          sendConfirmParamsParsed?.sourceInfo?.origin ??
          ''
        }
        networkId={decodedTx?.networkId ?? ''}
      />
      <TxDetailContextProvider
        isSendConfirm={isSendConfirm}
        isCollapse={!isSingleTransformMode}
        isMultipleActions
      >
        <>
          {isSingleTransformMode && (
            <TxActionsListView {...props} transformType="T1" space={6} />
          )}
          {!isSingleTransformMode && (
            <Container.Box p="0">{renderBatchTxsItem()}</Container.Box>
          )}
        </>
      </TxDetailContextProvider>
    </>
  );
}

export { BatchTxsItemView };
