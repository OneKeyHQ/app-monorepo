import React from 'react';

import { useIntl } from 'react-intl';

import { shortenAddress } from '@onekeyhq/components/src/utils';
import { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';

import { TxDetailActionBoxAutoTransform } from '../components/TxDetailActionBoxAutoTransform';
import { TxListActionBox } from '../components/TxListActionBox';
import { TxStatusBarInList } from '../components/TxStatusBar';
import { TxActionElementAddressNormal } from '../elements/TxActionElementAddress';
import { ITxActionCardProps, ITxActionElementDetail } from '../types';

export function TxActionTransactionEvm(props: ITxActionCardProps) {
  const { decodedTx, action, meta } = props;
  const encodedTx =
    (decodedTx.encodedTx as IEncodedTxEvm | undefined) || action.evmInfo;
  const intl = useIntl();

  const details: Array<ITxActionElementDetail | null> = [
    encodedTx?.from
      ? {
          title: intl.formatMessage({ id: 'content__from' }),
          content: (
            <TxActionElementAddressNormal address={encodedTx?.from || ''} />
          ),
        }
      : null,
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
              numberOfLines={1}
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
