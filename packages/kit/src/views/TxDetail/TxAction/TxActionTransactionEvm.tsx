import React from 'react';

import { useIntl } from 'react-intl';

import { Icon } from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';

import { useClipboard } from '../../../hooks/useClipboard';
import {
  TxDetailActionBox,
  TxDetailActionBoxAutoTransform,
} from '../components/TxDetailActionBox';
import { TxListActionBox } from '../components/TxListActionBox';
import { TxActionElementAddressNormal } from '../elements/TxActionElementAddress';
import { TxActionElementDetailCellContentText } from '../elements/TxActionElementDetailCell';
import {
  TxActionElementIconLarge,
  TxActionElementIconNormal,
} from '../elements/TxActionElementIcon';
import { TxActionElementPressable } from '../elements/TxActionElementPressable';
import {
  TxActionElementTitleHeading,
  TxActionElementTitleNormal,
} from '../elements/TxActionElementTitle';
import { ITxActionCardProps, ITxActionElementDetail } from '../types';
import { TxStatusBarInList } from '../components/TxStatusBar';

export function TxActionTransactionEvm(props: ITxActionCardProps) {
  const { decodedTx, action, meta } = props;
  const encodedTx =
    (decodedTx.encodedTx as IEncodedTxEvm | undefined) || action.evmInfo;
  const intl = useIntl();
  const { copyText } = useClipboard();

  const details: Array<ITxActionElementDetail | null> = [
    {
      title: intl.formatMessage({ id: 'content__from' }),
      content: <TxActionElementAddressNormal address={encodedTx?.from || ''} />,
    },
    encodedTx?.to
      ? {
          title: intl.formatMessage({ id: 'content__to' }),
          content: (
            <TxActionElementAddressNormal address={encodedTx?.to || ''} />
          ),
        }
      : null,
    encodedTx?.data
      ? {
          title: intl.formatMessage({ id: 'form__data' }),
          content: (
            <TxActionElementAddressNormal
              address={encodedTx.data ?? ''}
              numberOfLines={3}
              isShorten={false}
              flex={1}
            />
          ),
        }
      : null,
  ];
  return (
    <TxDetailActionBoxAutoTransform
      decodedTx={decodedTx}
      iconInfo={meta?.iconInfo}
      titleInfo={meta?.titleInfo}
      details={details}
    />
  );
}

export function TxActionTransactionEvmT0(props: ITxActionCardProps) {
  const { decodedTx, meta, historyTx } = props;
  const statusBar = (
    <TxStatusBarInList decodedTx={decodedTx} historyTx={historyTx} />
  );
  return (
    <TxListActionBox
      footer={statusBar}
      iconInfo={meta?.iconInfo}
      titleInfo={meta?.titleInfo}
      subTitle={shortenAddress(decodedTx?.txid ?? '')}
      content=""
      extra=""
    />
  );
}
