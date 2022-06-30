import React, { useMemo } from 'react';

import { Divider, VStack } from '@onekeyhq/components';

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
  const items = useMemo(() => {
    // let { actions } = decodedTx;
    // if (Math.round(Math.random() * 1000) % 2 === 0) {
    //   actions = actions.concat(decodedTx.actions);
    // }
    const { actions } = decodedTx;
    const listItems: JSX.Element[] = [];
    actions.forEach((action, index) => {
      // TODO async function
      const metaInfo = getTxActionMeta({ action, decodedTx });
      metaInfo.meta.transferAmount = transferAmount;

      const { meta, components } = metaInfo;
      const TxActionComponent = components[transformType];

      listItems.push(
        <TxActionComponent key={index} {...metaInfo.props} meta={meta} />,
      );
      if (showDivider && index !== actions.length - 1) {
        listItems.push(<Divider key={`${index}-divider`} />);
      }
    });
    return listItems;
  }, [decodedTx, showDivider, transferAmount, transformType]);

  return <VStack space={space}>{items}</VStack>;
}
