import React, { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Divider, VStack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { TxActionErrorBoundary } from './components/TxActionErrorBoundary';
import { ITxActionListViewProps } from './types';
import { getTxActionMeta } from './utils/getTxActionMeta';

export function TxActionsListView(props: ITxActionListViewProps) {
  const {
    decodedTx,
    transformType = 'T0',
    space = 0,
    showDivider = false,
    transferAmount,
  } = props;
  const intl = useIntl();
  const items = useMemo(() => {
    let { actions } = decodedTx;
    if (platformEnv.isMultipleHistoryTxActionsSim) {
      if (Math.round(Math.random() * 1000) % 2 === 0) {
        actions = actions.concat(decodedTx.actions);
      }
    }
    const listItems: JSX.Element[] = [];
    actions.forEach((action, index) => {
      // TODO async function
      const metaInfo = getTxActionMeta({ action, decodedTx, intl });
      metaInfo.meta.transferAmount = transferAmount;

      const { meta, components } = metaInfo;
      const TxActionComponent = components[transformType];

      listItems.push(
        <TxActionErrorBoundary>
          <TxActionComponent key={index} {...metaInfo.props} meta={meta} />
        </TxActionErrorBoundary>,
      );
      if (showDivider && index !== actions.length - 1) {
        listItems.push(<Divider key={`${index}-divider`} />);
      }
    });
    return listItems;
  }, [decodedTx, intl, showDivider, transferAmount, transformType]);

  return <VStack space={space}>{items}</VStack>;
}
