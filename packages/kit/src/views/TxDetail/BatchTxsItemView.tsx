import { useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Container, Text } from '@onekeyhq/components';

import { useNetworkSimple } from '../../hooks';
import { MAX_ACTIONS_DISPLAY_IN_CONFIRM } from '../Send/constants';

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

  const renderBatchTxsItem = useCallback(() => {
    const batchTxs = [];
    const actionCount = displayedActions.length;
    for (
      let i = 0,
        len = BigNumber.min(
          actionCount,
          MAX_ACTIONS_DISPLAY_IN_CONFIRM,
        ).toNumber();
      i < len;
      i += 1
    ) {
      const action = displayedActions[i];
      const metaInfo = getTxActionMeta({
        action,
        decodedTx,
        intl,
        historyTx: undefined,
      });
      metaInfo.meta.transferAmount = transferAmount;

      const { meta, components } = metaInfo;
      const TxActionComponent = components[transformType];

      batchTxs.push(
        <Container.Item
          wrap={
            <TxActionComponent
              {...metaInfo.props}
              meta={meta}
              network={network}
            />
          }
          hidePadding
          key={i}
        />,
      );
    }

    if (actionCount > MAX_ACTIONS_DISPLAY_IN_CONFIRM) {
      batchTxs.push(
        <Text
          typography="Body2Strong"
          color="text-subdued"
          paddingY={4}
          textAlign="center"
        >
          {intl.formatMessage(
            { id: 'action__str_more_actions' },
            { count: actionCount - MAX_ACTIONS_DISPLAY_IN_CONFIRM },
          )}
        </Text>,
      );
    }

    return batchTxs;
  }, [
    decodedTx,
    displayedActions,
    intl,
    network,
    transferAmount,
    transformType,
  ]);

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
            <Container.Box p="0" borderWidth={1} borderColor="border-subdued">
              {renderBatchTxsItem()}
            </Container.Box>
          )}
        </>
      </TxDetailContextProvider>
    </>
  );
}

export { BatchTxsItemView };
