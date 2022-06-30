import React from 'react';

import { useIntl } from 'react-intl';

import { shortenAddress } from '@onekeyhq/components/src/utils';
import { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';

import { TxDetailActionBox } from '../components/TxDetailActionBox';
import { TxListActionBox } from '../components/TxListActionBox';
import { TxActionElementDetailCellContentText } from '../elements/TxActionElementDetailCell';
import { TxActionElementAddressNormal } from '../elements/TxActionElementHashText';
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

export function TxActionTransactionEvm(props: ITxActionCardProps) {
  const { decodedTx, meta } = props;
  const icon = <TxActionElementIconNormal {...meta} />;
  const title = <TxActionElementTitleHeading {...meta} mb={4} />;
  const encodedTx = decodedTx.encodedTx as IEncodedTxEvm | undefined;
  const intl = useIntl();

  const details: ITxActionElementDetail[] = [
    {
      title: intl.formatMessage({ id: 'content__from' }),
      content: <TxActionElementAddressNormal address={encodedTx?.from || ''} />,
    },
    {
      title: intl.formatMessage({ id: 'content__to' }),
      content: <TxActionElementAddressNormal address={encodedTx?.to || ''} />,
    },
    {
      title: intl.formatMessage({ id: 'form__data' }),
      content: (
        <TxActionElementPressable onPress={() => console.log(decodedTx)}>
          <TxActionElementDetailCellContentText numberOfLines={3}>
            {encodedTx?.data || ''}
          </TxActionElementDetailCellContentText>
        </TxActionElementPressable>
      ),
    },
  ];
  return (
    <TxDetailActionBox
      icon={meta?.iconInfo ? icon : undefined}
      title={title}
      details={details}
    />
  );
}

export function TxActionTransactionEvmT0(props: ITxActionCardProps) {
  const { decodedTx, meta } = props;
  const icon = <TxActionElementIconLarge {...meta} />;
  const title = <TxActionElementTitleNormal {...meta} />;

  return (
    <TxListActionBox
      icon={icon}
      title={title}
      content=""
      subTitle={shortenAddress(decodedTx?.txid ?? '')}
      extra=""
    />
  );
}
