import React from 'react';

import { HStack } from '@onekeyhq/components';
import {
  IDecodedTx,
  IDecodedTxStatus,
  IHistoryTx,
} from '@onekeyhq/engine/src/vaults/types';

import { TxActionElementIconXLarge } from '../elements/TxActionElementIcon';
import { TxActionElementStatusText } from '../elements/TxActionElementStatusText';
import { TxActionElementTime } from '../elements/TxActionElementTime';
import { TxActionElementTitleHeading } from '../elements/TxActionElementTitle';

import { TxListActionBox } from './TxListActionBox';
import { TxStatusBarInDetail } from './TxStatusBar';

export function TxDetailTopHeader(props: {
  decodedTx: IDecodedTx;
  showSubTitle: boolean;
}) {
  const { decodedTx, showSubTitle } = props;
  const title = (
    <TxActionElementTitleHeading
      titleInfo={{
        titleKey: 'transaction__contract_interaction',
      }}
    />
  );
  const icon = (
    <TxActionElementIconXLarge
      iconInfo={{
        icon: {
          name: 'ClipboardListSolid',
        },
      }}
    />
  );

  return (
    <TxListActionBox
      icon={icon}
      title={title}
      subTitle={
        showSubTitle ? <TxStatusBarInDetail decodedTx={decodedTx} /> : undefined
      }
    />
  );
}
