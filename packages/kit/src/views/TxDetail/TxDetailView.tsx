import React from 'react';

import { Box } from '@onekeyhq/components';

import { TxDetailFeeInfoBox } from './components/TxDetailFeeInfoBox';
import { TxActionsListView } from './TxActionsListView';
import { ITxActionListViewProps } from './types';

export function TxDetailView(props: ITxActionListViewProps) {
  return (
    <>
      <TxActionsListView {...props} transformType="T1" space={6} />
      <Box h={6} />
      <TxDetailFeeInfoBox {...props} />
    </>
  );
}
