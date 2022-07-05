import React from 'react';

import { useIntl } from 'react-intl';

import { shortenAddress } from '@onekeyhq/components/src/utils';
import {
  IDecodedTxActionType,
  IDecodedTxDirection,
} from '@onekeyhq/engine/src/vaults/types';

import { FormatCurrencyToken } from '../../../components/Format';
import { TxDetailActionBox } from '../components/TxDetailActionBox';
import {
  TxListActionBox,
  TxListActionBoxExtraText,
} from '../components/TxListActionBox';
import { TxActionElementAddressNormal } from '../elements/TxActionElementAddress';
import {
  TxActionElementAmountLarge,
  TxActionElementAmountNormal,
} from '../elements/TxActionElementAmount';
import {
  TxActionElementIconLarge,
  TxActionElementIconNormal,
} from '../elements/TxActionElementIcon';
import {
  TxActionElementTitleHeading,
  TxActionElementTitleNormal,
} from '../elements/TxActionElementTitle';
import {
  ITxActionCardProps,
  ITxActionElementDetail,
  ITxActionMetaIcon,
  ITxActionMetaTitle,
} from '../types';

export function getTxActionTransferInfo(props: ITxActionCardProps) {
  const { action, meta, network } = props;

  let amount = '0';
  let symbol = '';
  let from = '';
  let to = '';
  let displayDecimals: number | undefined;
  if (action.type === IDecodedTxActionType.NATIVE_TRANSFER) {
    amount = meta?.transferAmount ?? action.nativeTransfer?.amount ?? '0';
    symbol = action.nativeTransfer?.tokenInfo.symbol ?? '';
    from = action.nativeTransfer?.from ?? '';
    to = action.nativeTransfer?.to ?? '';
    displayDecimals = network?.nativeDisplayDecimals;
  }
  if (action.type === IDecodedTxActionType.TOKEN_TRANSFER) {
    amount = action.tokenTransfer?.amount ?? '0';
    symbol = action.tokenTransfer?.tokenInfo.symbol ?? '';
    from = action.tokenTransfer?.from ?? '';
    to = action.tokenTransfer?.to ?? '';
    displayDecimals = network?.tokenDisplayDecimals;
  }

  const isOut =
    action.direction === IDecodedTxDirection.OUT ||
    action.direction === IDecodedTxDirection.SELF;
  const titleInfo: ITxActionMetaTitle = {
    // TODO i18n
    titleKey: isOut ? 'action__send' : 'action__receive',
  };
  const iconUrl =
    action.nativeTransfer?.tokenInfo.logoURI ??
    action.tokenTransfer?.tokenInfo.logoURI;
  let iconInfo: ITxActionMetaIcon | undefined;
  if (iconUrl) {
    iconInfo = {
      icon: {
        url: iconUrl,
      },
    };
  }

  return {
    titleInfo,
    iconInfo,
    amount,
    symbol,
    displayDecimals,
    from,
    to,
    isOut,
  };
}

export function TxActionTransfer(props: ITxActionCardProps) {
  const { action, meta } = props;
  const icon = <TxActionElementIconNormal {...meta} />;
  const title = <TxActionElementTitleHeading {...meta} />;
  const { amount, symbol, from, to } = getTxActionTransferInfo(props);
  const intl = useIntl();
  const details: ITxActionElementDetail[] = [
    {
      title: intl.formatMessage({ id: 'content__from' }),
      content: <TxActionElementAddressNormal address={from} />,
    },
    {
      title: intl.formatMessage({ id: 'content__to' }),
      content: <TxActionElementAddressNormal address={to} />,
    },
  ];
  const amountView = (
    <TxActionElementAmountLarge
      direction={action.direction}
      amount={amount}
      symbol={symbol}
      mb={4}
    />
  );
  return (
    <TxDetailActionBox
      icon={icon}
      title={title}
      content={amountView}
      details={details}
    />
  );
}

export function TxActionTransferT0(props: ITxActionCardProps) {
  const { action, meta, decodedTx, historyTx } = props;
  const icon = <TxActionElementIconLarge {...meta} />;
  const title = <TxActionElementTitleNormal {...meta} />;
  const { amount, symbol, from, to, isOut, displayDecimals } =
    getTxActionTransferInfo(props);

  return (
    <TxListActionBox
      decodedTx={decodedTx}
      historyTx={historyTx}
      icon={icon}
      title={title}
      content={
        <TxActionElementAmountNormal
          textAlign="right"
          justifyContent="flex-end"
          amount={amount}
          symbol={symbol}
          decimals={displayDecimals}
          direction={action.direction}
        />
      }
      subTitle={isOut ? shortenAddress(to) : shortenAddress(from)}
      extra={
        <FormatCurrencyToken
          token={
            action.nativeTransfer?.tokenInfo ?? action.tokenTransfer?.tokenInfo
          }
          value={amount}
          render={(ele) => (
            <TxListActionBoxExtraText>{ele}</TxListActionBoxExtraText>
          )}
        />
      }
    />
  );
}
