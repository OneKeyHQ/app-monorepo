import React from 'react';

import { useIntl } from 'react-intl';

import { Icon } from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';

import { useClipboard } from '../../../hooks/useClipboard';
import { TxDetailActionBox } from '../components/TxDetailActionBox';
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

export function TxActionTransactionEvm(props: ITxActionCardProps) {
  const { decodedTx, action, meta } = props;
  const icon = <TxActionElementIconNormal {...meta} />;
  const title = <TxActionElementTitleHeading {...meta} mb={4} />;
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
            <TxActionElementPressable
              icon={<Icon name="DuplicateSolid" size={20} />}
              flex={1}
              onPress={() => copyText(encodedTx.data ?? '')}
            >
              <TxActionElementDetailCellContentText numberOfLines={3}>
                {encodedTx?.data || ''}
              </TxActionElementDetailCellContentText>
            </TxActionElementPressable>
          ),
        }
      : null,
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
  const { decodedTx, meta, historyTx } = props;
  const icon = <TxActionElementIconLarge {...meta} />;
  const title = <TxActionElementTitleNormal {...meta} />;

  return (
    <TxListActionBox
      historyTx={historyTx}
      decodedTx={decodedTx}
      icon={icon}
      title={title}
      content=""
      subTitle={shortenAddress(decodedTx?.txid ?? '')}
      extra=""
    />
  );
}
