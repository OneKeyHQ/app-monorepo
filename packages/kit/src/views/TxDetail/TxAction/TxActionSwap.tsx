import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { shortenAddress } from '@onekeyhq/components/src/utils';
import { IDecodedTxDirection } from '@onekeyhq/engine/src/vaults/types';

import { useNetwork } from '../../../hooks/useNetwork';
import { TxDetailActionBoxAutoTransform } from '../components/TxDetailActionBoxAutoTransform';
import { TxListActionBox } from '../components/TxListActionBox';
import { TxStatusBarInList } from '../components/TxStatusBar';
import {
  TxActionElementAddressNormal,
  getTxActionElementAddressWithSecurityInfo,
} from '../elements/TxActionElementAddress';
import {
  TxActionElementAmountLarge,
  TxActionElementAmountNormal,
  TxActionElementAmountSmall,
} from '../elements/TxActionElementAmount';

import type {
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
      name: 'ArrowsRightLeftMini',
    },
  };

  return {
    titleInfo,
    iconInfo,
    swapInfo: action.internalSwap,
  };
}

export function TxActionSwap(props: ITxActionCardProps) {
  const { meta, decodedTx, network } = props;
  const intl = useIntl();
  const { swapInfo } = getTxActionSwapInfo(props);
  const { send, receive, accountAddress, receivingAddress } = swapInfo;

  const { network: sendingNetwork } = useNetwork({ networkId: send.networkId });
  const { network: receivingNetwork } = useNetwork({
    networkId: receive.networkId,
  });

  const sendTitle = useMemo(() => {
    if (
      sendingNetwork &&
      receivingNetwork &&
      sendingNetwork.id !== receivingNetwork.id
    ) {
      return `${intl.formatMessage({ id: 'action__send' }).toUpperCase()}  (${
        sendingNetwork.shortName
      })`;
    }
    return intl.formatMessage({ id: 'action__send' }).toUpperCase();
  }, [sendingNetwork, receivingNetwork, intl]);

  const receivingTitle = useMemo(() => {
    if (
      sendingNetwork &&
      receivingNetwork &&
      sendingNetwork.id !== receivingNetwork.id
    ) {
      return `${intl
        .formatMessage({ id: 'action__receive' })
        .toUpperCase()}  (${receivingNetwork.shortName})`;
    }
    return intl.formatMessage({ id: 'action__receive' }).toUpperCase();
  }, [sendingNetwork, receivingNetwork, intl]);

  const details: ITxActionElementDetail[] = [
    {
      title: sendTitle,
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
      title: receivingTitle,
      content: (
        <TxActionElementAmountLarge
          direction={IDecodedTxDirection.IN}
          amount={receive.amount}
          symbol={receive.tokenInfo.symbol}
          mb={4}
        />
      ),
    },
  ];
  if (receivingAddress && accountAddress !== receivingAddress) {
    details.push({
      title: intl.formatMessage({ id: 'content__from' }),
      content: <TxActionElementAddressNormal address={accountAddress} />,
    });
    details.push({
      title: intl.formatMessage({ id: 'content__to' }),
      content: getTxActionElementAddressWithSecurityInfo({
        address: receivingAddress || '',
        networkId: network?.id,
        withSecurityInfo: true,
      }),
    });
  } else {
    details.push({
      title: intl.formatMessage({ id: 'form__account' }),
      content: <TxActionElementAddressNormal address={accountAddress} />,
    });
  }

  return (
    <TxDetailActionBoxAutoTransform
      decodedTx={decodedTx}
      iconInfo={meta?.iconInfo}
      titleInfo={meta?.titleInfo}
      // content={amountView}
      details={details}
    />
  );
}

export function TxActionSwapT0(props: ITxActionCardProps) {
  const { meta, decodedTx, historyTx } = props;
  const { swapInfo } = getTxActionSwapInfo(props);
  const { accountAddress } = swapInfo;
  const { network } = useNetwork({ networkId: decodedTx.networkId });
  const statusBar = (
    <TxStatusBarInList decodedTx={decodedTx} historyTx={historyTx} />
  );
  return (
    <TxListActionBox
      footer={statusBar}
      iconInfo={meta?.iconInfo}
      titleInfo={meta?.titleInfo}
      symbol={swapInfo.send.tokenInfo.symbol}
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
