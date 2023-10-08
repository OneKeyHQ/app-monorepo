import { useIntl } from 'react-intl';

import { Text } from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import {
  IDecodedTxActionType,
  IDecodedTxDirection,
  IDecodedTxStatus,
} from '@onekeyhq/engine/src/vaults/types';

import { FormatCurrencyTokenOfAccount } from '../../../components/Format';
import { useAccount } from '../../../hooks';
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
      titleKey: 'content__deploy',
    };
  }

  if (type === IDecodedTxActionType.TOKEN_BRC20_MINT) {
    return {
      titleKey: 'content__mint',
    };
  }

  if (type === IDecodedTxActionType.TOKEN_BRC20_INSCRIBE) {
    return {
      titleKey: 'title__inscribe',
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
  const { action } = props;
  const { brc20Info, direction, type } = action;

  const sender = brc20Info?.sender ?? '';
  const receiver = brc20Info?.receiver ?? '';
  const isInscribeTransfer = !!brc20Info?.isInscribeTransfer;
  const displayDecimals: number | undefined = 100;

  action.direction = direction;

  const isOut = direction === IDecodedTxDirection.OUT;
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
    isInscribeTransfer,
    amount: brc20Info?.amount ?? '0',
  };
}

export function TxActionBRC20T0(props: ITxActionCardProps) {
  const { action, meta, decodedTx, historyTx, network } = props;
  const { accountId, networkId, status } = decodedTx;
  const { amount, symbol, isOut, sender, receiver } =
    getTxActionsBRC20Info(props);
  const statusBar = (
    <TxStatusBarInList decodedTx={decodedTx} historyTx={historyTx} />
  );

  const intl = useIntl();

  let subTitle = '';

  const isDeploy = action.type === IDecodedTxActionType.TOKEN_BRC20_DEPLOY;
  const isMint = action.type === IDecodedTxActionType.TOKEN_BRC20_MINT;

  if (isDeploy || isMint) {
    subTitle = receiver;
  } else {
    subTitle = isOut ? receiver : sender;
  }

  const subTitleFormated =
    subTitle === 'unknown' ? subTitle : shortenAddress(subTitle);

  return (
    <TxListActionBox
      network={network}
      footer={statusBar}
      symbol={symbol}
      iconInfo={meta?.iconInfo}
      titleInfo={
        status === IDecodedTxStatus.Offline
          ? { titleKey: 'form__partially_sign' }
          : meta?.titleInfo
      }
      content={
        <TxActionElementAmountNormal
          textAlign="right"
          justifyContent="flex-end"
          amount={isDeploy ? undefined : amount}
          symbol={symbol}
          direction={isDeploy ? undefined : action.direction}
        />
      }
      subTitle={
        status === IDecodedTxStatus.Offline ? (
          <Text typography="Body2" color="text-warning">
            {intl.formatMessage({ id: 'form__not_broadcast' })}
          </Text>
        ) : (
          subTitleFormated
        )
      }
      extra={
        status === IDecodedTxStatus.Offline || isDeploy ? (
          ''
        ) : (
          <FormatCurrencyTokenOfAccount
            accountId={accountId}
            networkId={networkId}
            token={action.brc20Info?.token}
            value={amount}
            render={(ele) => (
              <TxListActionBoxExtraText>{ele}</TxListActionBoxExtraText>
            )}
          />
        )
      }
    />
  );
}

export function TxActionBRC20(props: ITxActionCardProps) {
  const intl = useIntl();
  const { action, meta, decodedTx, network, isShortenAddress = false } = props;
  const { accountId, networkId } = decodedTx;

  const { amount, sender, receiver, isOut, symbol, isInscribeTransfer } =
    getTxActionsBRC20Info(props);
  const { account } = useAccount({ accountId, networkId });

  const isDeploy = action.type === IDecodedTxActionType.TOKEN_BRC20_DEPLOY;
  const isTransfer = action.type === IDecodedTxActionType.TOKEN_BRC20_TRANSFER;

  const details: (ITxActionElementDetail | null)[] = [
    isDeploy || isTransfer
      ? {
          title: intl.formatMessage({ id: 'content__from' }),
          content: getTxActionElementAddressWithSecurityInfo({
            address: isDeploy ? receiver : sender,
            networkId: network?.id,
            withSecurityInfo: !isOut,
            amount,
            isCopy: true,
            isShorten: isShortenAddress,
            isInscribeTransfer:
              isInscribeTransfer && account?.address !== sender,
          }),
        }
      : null,
    isDeploy
      ? null
      : {
          title: intl.formatMessage({ id: 'content__to' }),
          content: getTxActionElementAddressWithSecurityInfo({
            address: receiver,
            networkId: network?.id,
            withSecurityInfo: isOut,
            amount,
            isCopy: true,
            isShorten: isShortenAddress,
            isInscribeTransfer:
              isInscribeTransfer && account?.address !== receiver,
          }),
        },
  ];

  return (
    <TxDetailActionBoxAutoTransform
      decodedTx={decodedTx}
      iconInfo={meta?.iconInfo}
      titleInfo={meta?.titleInfo}
      amountInfo={{
        direction: isDeploy ? undefined : action.direction,
        amount: isDeploy ? '' : amount,
        symbol: symbol ?? '',
      }}
      details={details}
    />
  );
}
