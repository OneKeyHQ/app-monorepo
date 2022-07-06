import React from 'react';

import { useIntl } from 'react-intl';

import { shortenAddress } from '@onekeyhq/components/src/utils';
import { IDecodedTxDirection } from '@onekeyhq/engine/src/vaults/types';

import { useNetwork } from '../../../hooks/useNetwork';
import { TxDetailActionBox } from '../components/TxDetailActionBox';
import { TxListActionBox } from '../components/TxListActionBox';
import { TxActionElementAddressNormal } from '../elements/TxActionElementAddress';
import {
  TxActionElementAmountLarge,
  TxActionElementAmountNormal,
  TxActionElementAmountSmall,
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

export function getTxActionSwapInfo(props: ITxActionCardProps) {
  const { action } = props;

  const titleInfo: ITxActionMetaTitle = {
    titleKey: 'title__swap',
  };
  if (!action.internalSwap) {
    throw new Error('internalSwap is missing in txAction');
  }

  // const iconUrl = action.internalSwap?.send?.tokenInfo?.logoURI;
  // let iconInfo: ITxActionMetaIcon | undefined;
  // if (iconUrl) {
  //   iconInfo = {
  //     icon: {
  //       url: iconUrl,
  //     },
  //   };
  // }

  const iconInfo: ITxActionMetaIcon = {
    icon: {
      name: 'SwitchHorizontalSolid',
    },
  };

  return {
    titleInfo,
    iconInfo,
    swapInfo: action.internalSwap,
  };
}

export function TxActionSwap(props: ITxActionCardProps) {
  const { meta } = props;
  const icon = <TxActionElementIconNormal {...meta} />;
  const title = <TxActionElementTitleHeading {...meta} />;
  const { swapInfo } = getTxActionSwapInfo(props);
  const { send, receive, accountAddress } = swapInfo;
  const intl = useIntl();
  const details: ITxActionElementDetail[] = [
    {
      title: intl.formatMessage({ id: 'action__send' }),
      content: (
        <TxActionElementAmountLarge
          direction={IDecodedTxDirection.OUT}
          amount={send.amount}
          symbol={send.tokenInfo.symbol}
          mb={4}
        />
      ),
    },
    {
      title: intl.formatMessage({ id: 'action__receive' }),
      content: (
        <TxActionElementAmountLarge
          direction={IDecodedTxDirection.IN}
          amount={receive.amount}
          symbol={receive.tokenInfo.symbol}
          mb={4}
        />
      ),
    },
    {
      title: intl.formatMessage({ id: 'form__account' }),
      content: <TxActionElementAddressNormal address={accountAddress} />,
    },
  ];

  return (
    <TxDetailActionBox
      icon={icon}
      title={title}
      // content={amountView}
      details={details}
    />
  );
}

export function TxActionSwapT0(props: ITxActionCardProps) {
  const { meta, decodedTx, historyTx } = props;
  const icon = <TxActionElementIconLarge {...meta} />;
  const title = <TxActionElementTitleNormal {...meta} />;
  const { swapInfo } = getTxActionSwapInfo(props);
  const { accountAddress } = swapInfo;
  const { network } = useNetwork({ networkId: decodedTx.networkId });
  return (
    <TxListActionBox
      historyTx={historyTx}
      decodedTx={decodedTx}
      icon={icon}
      title={title}
      content={
        <TxActionElementAmountNormal
          textAlign="right"
          amount={swapInfo.send.amount}
          symbol={swapInfo.send.tokenInfo.symbol}
          direction={IDecodedTxDirection.OUT}
        />
      }
      subTitle={shortenAddress(accountAddress)}
      extra={
        <TxActionElementAmountSmall
          textAlign="right"
          amount={swapInfo.receive.amount}
          symbol={swapInfo.receive.tokenInfo.symbol}
          direction={IDecodedTxDirection.IN}
          decimals={network?.tokenDisplayDecimals}
        />
      }
    />
  );
}
