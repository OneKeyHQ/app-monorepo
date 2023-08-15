import { useIntl } from 'react-intl';

import { shortenAddress } from '@onekeyhq/components/src/utils';
import {
  IDecodedTxActionType,
  IDecodedTxDirection,
} from '@onekeyhq/engine/src/vaults/types';

import { FormatCurrencyTokenOfAccount } from '../../../components/Format';
import { TxDetailActionBoxAutoTransform } from '../components/TxDetailActionBoxAutoTransform';
import {
  TxListActionBox,
  TxListActionBoxExtraText,
} from '../components/TxListActionBox';
import { TxStatusBarInList } from '../components/TxStatusBar';
import { getTxActionElementAddressWithSecurityInfo } from '../elements/TxActionElementAddress';
import { TxActionElementAmountNormal } from '../elements/TxActionElementAmount';

import type {
  ITxActionCardProps,
  ITxActionElementDetail,
  ITxActionMetaIcon,
  ITxActionMetaTitle,
} from '../types';

function getTitleInfo({
  isOut,
  type,
}: {
  isOut: boolean;
  type: IDecodedTxActionType;
}): ITxActionMetaTitle {
  if (type === IDecodedTxActionType.TOKEN_BRC20_DEPLOY) {
    return {
      titleKey: 'content__mint',
    };
  }

  if (type === IDecodedTxActionType.TOKEN_BRC20_MINT) {
    return {
      titleKey: 'content__mint',
    };
  }

  if (type === IDecodedTxActionType.TOKEN_BRC20_TRANSFER) {
    return {
      titleKey: isOut ? 'action__send' : 'action__receive',
    };
  }

  return {
    titleKey: isOut ? 'form_send_nft' : 'form_receive_nft',
  };
}

export function getTxActionsBRC20Info(props: ITxActionCardProps) {
  const { action, decodedTx } = props;
  const { brc20Info, direction, type } = action;

  const sender = brc20Info?.sender ?? '';
  const receiver = brc20Info?.receiver ?? '';
  const displayDecimals: number | undefined = 100;

  action.direction = direction;

  const isOut =
    direction === IDecodedTxDirection.OUT ||
    direction === IDecodedTxDirection.SELF ||
    direction === IDecodedTxDirection.OTHER;
  const titleInfo = getTitleInfo({
    type,
    isOut,
  });

  const iconUrl = action.brc20Info?.token.logoURI;
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
    displayDecimals,
    symbol: brc20Info?.token.symbol,
    sender,
    receiver,
    isOut,
    action,
    amount: brc20Info?.amount ?? '0',
    asset: brc20Info?.asset,
  };
}

export function TxActionBRC20T0(props: ITxActionCardProps) {
  const intl = useIntl();
  const { action, meta, decodedTx, historyTx, network } = props;
  const { accountId, networkId } = decodedTx;
  const { amount, symbol, isOut, sender, receiver } =
    getTxActionsBRC20Info(props);
  const statusBar = (
    <TxStatusBarInList decodedTx={decodedTx} historyTx={historyTx} />
  );

  const subTitle = isOut ? receiver : sender;
  const subTitleFormated =
    subTitle === 'unknown'
      ? intl.formatMessage({ id: 'form__unknown' })
      : shortenAddress(subTitle);

  return (
    <TxListActionBox
      network={network}
      footer={statusBar}
      symbol={symbol}
      iconInfo={meta?.iconInfo}
      titleInfo={meta?.titleInfo}
      content={
        <TxActionElementAmountNormal
          textAlign="right"
          justifyContent="flex-end"
          amount={amount}
          symbol={symbol}
          direction={action.direction}
        />
      }
      subTitle={subTitleFormated}
      extra={
        <FormatCurrencyTokenOfAccount
          accountId={accountId}
          networkId={networkId}
          token={action.brc20Info?.token}
          value={amount}
          render={(ele) => (
            <TxListActionBoxExtraText>{ele}</TxListActionBoxExtraText>
          )}
        />
      }
    />
  );
}

export function TxActionBRC20(props: ITxActionCardProps) {
  const intl = useIntl();
  const { action, meta, decodedTx, network, isShortenAddress = false } = props;

  const { amount, sender, receiver, isOut, symbol } =
    getTxActionsBRC20Info(props);

  const details: (ITxActionElementDetail | null)[] = [
    action.type === IDecodedTxActionType.TOKEN_BRC20_TRANSFER
      ? {
          title: intl.formatMessage({ id: 'content__from' }),
          content: getTxActionElementAddressWithSecurityInfo({
            address: sender,
            networkId: network?.id,
            withSecurityInfo: !isOut,
            amount,
            isCopy: true,
            isShorten: isShortenAddress,
          }),
        }
      : null,
    {
      title: intl.formatMessage({ id: 'content__to' }),
      content: getTxActionElementAddressWithSecurityInfo({
        address: receiver,
        networkId: network?.id,
        withSecurityInfo: isOut,
        amount,
        isCopy: true,
        isShorten: isShortenAddress,
      }),
    },
  ];

  return (
    <TxDetailActionBoxAutoTransform
      decodedTx={decodedTx}
      iconInfo={meta?.iconInfo}
      titleInfo={meta?.titleInfo}
      amountInfo={{
        direction: action.direction,
        amount,
        symbol: symbol ?? '',
      }}
      details={details}
    />
  );
}
