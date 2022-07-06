import React, { useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Box, Divider, VStack } from '@onekeyhq/components';
import { IHistoryTx } from '@onekeyhq/engine/src/vaults/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useNetwork } from '../../hooks/redux';

import { TxActionErrorBoundary } from './components/TxActionErrorBoundary';
import { ITxActionListViewProps } from './types';
import { getTxActionMeta } from './utils/getTxActionMeta';

function useOriginHistoryTxOfCancelTx(cancelTx?: IHistoryTx) {
  const [originTx, setOriginTx] = useState<IHistoryTx | undefined>();
  useEffect(() => {
    (async () => {
      const tx =
        await backgroundApiProxy.serviceHistory.getOriginHistoryTxOfCancelTx(
          cancelTx,
        );
      setOriginTx(tx);
    })();
  }, [cancelTx]);
  return originTx;
}

export function TxActionsListView(props: ITxActionListViewProps) {
  const {
    historyTx,
    decodedTx,
    transformType = 'T0',
    space = 0,
    showDivider = false,
    transferAmount,
  } = props;
  const intl = useIntl();
  const originTx = useOriginHistoryTxOfCancelTx(historyTx);
  const network = useNetwork(decodedTx.networkId);
  const items = useMemo(() => {
    const finalDecodedTx = { ...decodedTx };
    if (originTx) {
      finalDecodedTx.actions = originTx.decodedTx.actions;
      finalDecodedTx.outputActions = originTx.decodedTx.outputActions;
    }
    let { actions = [], outputActions } = finalDecodedTx;
    if (platformEnv.isDev && platformEnv.isMultipleHistoryTxActionsSim) {
      if (Math.round(Math.random() * 1000) % 2 === 0) {
        actions = actions.concat(finalDecodedTx.actions).filter(Boolean);
      }
    }
    const displayedActions =
      outputActions && outputActions.length ? outputActions : actions;
    const listItems: JSX.Element[] = [];
    displayedActions.forEach((action, index) => {
      // TODO async function
      const metaInfo = getTxActionMeta({
        action,
        decodedTx: finalDecodedTx,
        intl,
        historyTx,
      });
      metaInfo.meta.transferAmount = transferAmount;

      const { meta, components } = metaInfo;
      const TxActionComponent = components[transformType];

      listItems.push(
        <TxActionErrorBoundary key={`error-boundary-${index}`}>
          <TxActionComponent
            key={index}
            {...metaInfo.props}
            meta={meta}
            network={network}
          />
        </TxActionErrorBoundary>,
      );
      if (showDivider && index !== displayedActions.length - 1) {
        // actions in same tx do not need divider anymore
        // listItems.push(<Divider key={`${index}-divider`} />);
      }
    });
    return listItems;
  }, [
    decodedTx,
    historyTx,
    intl,
    network,
    originTx,
    showDivider,
    transferAmount,
    transformType,
  ]);

  const connectionLine =
    items.length > 1 ? (
      <Divider
        orientation="vertical"
        position="absolute"
        left={4}
        top={6}
        bottom={7}
        height="auto"
        thickness={2}
      />
    ) : null;

  return (
    <Box>
      {connectionLine}
      <VStack space={space}>{items}</VStack>
    </Box>
  );
}
