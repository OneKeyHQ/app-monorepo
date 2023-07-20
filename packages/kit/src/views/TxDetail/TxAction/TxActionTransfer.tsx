import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { shortenAddress } from '@onekeyhq/components/src/utils';
import {
  IDecodedTxActionType,
  IDecodedTxDirection,
} from '@onekeyhq/engine/src/vaults/types';
import { isLightningNetworkByImpl } from '@onekeyhq/shared/src/engine/engineConsts';

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
    action.direction === IDecodedTxDirection.SELF ||
    action.direction === IDecodedTxDirection.OTHER;
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
  const intl = useIntl();
  const { action, meta, decodedTx, network, isShortenAddress = false } = props;

  const { amount, symbol, from, to, isOut } = getTxActionTransferInfo(props);

  const displayFromLabel = useMemo(() => {
    if (
      network?.settings.hideFromToFieldIfValueEmpty &&
      (!from || !from.length)
    ) {
      return false;
    }
    return true;
  }, [from, network?.settings.hideFromToFieldIfValueEmpty]);
  const displayToLabel = useMemo(() => {
    if (network?.settings.hideFromToFieldIfValueEmpty && (!to || !to.length)) {
      return false;
    }
    return true;
  }, [to, network?.settings.hideFromToFieldIfValueEmpty]);

  const enableCopyAddress = useMemo(
    () => !isLightningNetworkByImpl(network?.impl ?? ''),
    [network],
  );

  const details: (ITxActionElementDetail | null)[] = [
    displayFromLabel
      ? {
          title: intl.formatMessage({ id: 'content__from' }),
          content: getTxActionElementAddressWithSecurityInfo({
            address:
              from === 'unknown'
                ? intl.formatMessage({ id: 'form__unknown' })
                : from,
            networkId: network?.id,
            withSecurityInfo: !isOut,
            amount,
            isCopy: from !== 'unknown' && enableCopyAddress,
            isShorten: isShortenAddress,
          }),
        }
      : null,
    displayToLabel
      ? {
          title: intl.formatMessage({ id: 'content__to' }),
          content: getTxActionElementAddressWithSecurityInfo({
            address:
              to === 'unknown'
                ? intl.formatMessage({ id: 'form__unknown' })
                : to,
            networkId: network?.id,
            withSecurityInfo: isOut,
            amount,
            isCopy: to !== 'unknown' && enableCopyAddress,
            isShorten: isShortenAddress,
          }),
        }
      : null,
  ];

  return (
    <TxDetailActionBoxAutoTransform
      decodedTx={decodedTx}
      iconInfo={meta?.iconInfo}
      titleInfo={meta?.titleInfo}
      amountInfo={{
        direction: action.direction,
        amount,
        symbol,
      }}
      details={details}
    />
  );
}

export function TxActionTransferT0(props: ITxActionCardProps) {
  const intl = useIntl();
  const { action, meta, decodedTx, historyTx, network } = props;
  const { accountId, networkId } = decodedTx;
  const { amount, symbol, from, to, isOut, displayDecimals } =
    getTxActionTransferInfo(props);
  const statusBar = (
    <TxStatusBarInList decodedTx={decodedTx} historyTx={historyTx} />
  );

  const subTitle = isOut ? to : from;
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
          decimals={displayDecimals}
          direction={action.direction}
        />
      }
      subTitle={subTitleFormated}
      extra={
        <FormatCurrencyTokenOfAccount
          accountId={accountId}
          networkId={networkId}
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
