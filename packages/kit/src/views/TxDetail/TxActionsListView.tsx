import React, { useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Divider, VStack } from '@onekeyhq/components';
import { IHistoryTx } from '@onekeyhq/engine/src/vaults/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

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
  const items = useMemo(() => {
    const finalDecodedTx = { ...decodedTx };
    if (originTx) {
      finalDecodedTx.actions = originTx.decodedTx.actions;
      finalDecodedTx.outputActions = originTx.decodedTx.outputActions;
    }
    let { actions = [] } = finalDecodedTx;
    if (platformEnv.isMultipleHistoryTxActionsSim) {
      if (Math.round(Math.random() * 1000) % 2 === 0) {
        actions = actions.concat(finalDecodedTx.actions).filter(Boolean);
      }
    }
    const listItems: JSX.Element[] = [];
    actions.forEach((action, index) => {
      // TODO async function
      const metaInfo = getTxActionMeta({
        action,
        decodedTx: finalDecodedTx,
        intl,
      });
      metaInfo.meta.transferAmount = transferAmount;

      const { meta, components } = metaInfo;
      const TxActionComponent = components[transformType];

      listItems.push(
        <TxActionErrorBoundary key={`error-boundary-${index}`}>
          <TxActionComponent key={index} {...metaInfo.props} meta={meta} />
        </TxActionErrorBoundary>,
      );
      if (showDivider && index !== actions.length - 1) {
        listItems.push(<Divider key={`${index}-divider`} />);
      }
    });
    return listItems;
  }, [decodedTx, intl, originTx, showDivider, transferAmount, transformType]);

  return <VStack space={space}>{items}</VStack>;
}
