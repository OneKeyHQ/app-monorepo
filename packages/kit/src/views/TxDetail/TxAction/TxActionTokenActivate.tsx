import { useIntl } from 'react-intl';

import { Typography } from '@onekeyhq/components';

import { TxDetailActionBoxAutoTransform } from '../components/TxDetailActionBoxAutoTransform';
import { TxListActionBox } from '../components/TxListActionBox';
import { TxStatusBarInList } from '../components/TxStatusBar';

import type {
  ITxActionCardProps,
  ITxActionElementDetail,
  ITxActionMetaIcon,
  ITxActionMetaTitle,
} from '../types';

export function getTxActionTokenActivateInfo(props: ITxActionCardProps) {
  const { action } = props;
  const { tokenActivate } = action;

  const tokenAddress = tokenActivate?.tokenAddress ?? '';
  const symbol = tokenActivate?.symbol ?? '';
  const name = tokenActivate?.name ?? '';
  const displayDecimals = tokenActivate?.decimals ?? 0;

  const titleInfo: ITxActionMetaTitle = {
    titleKey: 'title__add_token',
  };
  const iconUrl = tokenActivate?.logoURI ?? '';
  let iconInfo: ITxActionMetaIcon | undefined;
  if (iconUrl) {
    iconInfo = {
      icon: {
        url: iconUrl,
      },
    };
  }

  return {
    displayDecimals,
    tokenAddress,
    symbol,
    name,
    titleInfo,
    iconInfo,
  };
}

export function TxActionTokenActivate(props: ITxActionCardProps) {
  const { meta, decodedTx } = props;
  const { name, tokenAddress } = getTxActionTokenActivateInfo(props);
  const intl = useIntl();
  const details: ITxActionElementDetail[] = [
    {
      title: intl.formatMessage({ id: 'form__token_symbol' }),
      content: <Typography.Body1Strong>{name}</Typography.Body1Strong>,
    },
    {
      title: intl.formatMessage({ id: 'transaction__contract_address' }),
      content: <Typography.Body1Strong>{tokenAddress}</Typography.Body1Strong>,
    },
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

export function TxActionTokenActivateT0(props: ITxActionCardProps) {
  const { meta, decodedTx, historyTx } = props;

  const intl = useIntl();
  const { name } = getTxActionTokenActivateInfo({
    ...props,
    intl,
  });
  const statusBar = (
    <TxStatusBarInList decodedTx={decodedTx} historyTx={historyTx} />
  );
  return (
    <TxListActionBox
      footer={statusBar}
      iconInfo={meta?.iconInfo}
      titleInfo={meta?.titleInfo}
      subTitle={name}
    />
  );
}
