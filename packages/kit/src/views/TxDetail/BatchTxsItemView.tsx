import React, { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Container } from '@onekeyhq/components';

import { useNetworkSimple } from '../../hooks';

import { TxDetailContextProvider } from './TxDetailContext';
import { ITxActionListViewProps } from './types';
import { getTxActionMeta } from './utils/getTxActionMeta';
import { getDisplayedActions } from './utils/utilsTxDetail';

function BatchTxsItemView(props: ITxActionListViewProps) {
  const {
    decodedTx,
    isSendConfirm,
    transferAmount,
    transformType = 'T1',
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
    <TxDetailContextProvider
      isSendConfirm={isSendConfirm}
      isCollapse
      isMultipleActions
    >
      <Container.Box p="0">{renderBatchTxsItem()}</Container.Box>
    </TxDetailContextProvider>
  );
}

export { BatchTxsItemView };
