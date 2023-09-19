import { useIntl } from 'react-intl';

// import { Typography } from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { IDecodedTxDirection } from '@onekeyhq/engine/src/vaults/types';

import { TxDetailActionBoxAutoTransform } from '../components/TxDetailActionBoxAutoTransform';
import { TxListActionBox } from '../components/TxListActionBox';
import { TxStatusBarInList } from '../components/TxStatusBar';
import { TxActionElementAddressNormal } from '../elements/TxActionElementAddress';
import {
  TxActionElementAmountLarge,
  TxActionElementAmountNormal,
} from '../elements/TxActionElementAmount';

import type {
  ITxActionCardProps,
  ITxActionElementDetail,
  ITxActionMetaIcon,
  ITxActionMetaTitle,
} from '../types';

export function getTxActionStakeInfo(props: ITxActionCardProps) {
  const { action } = props;

  if (!action.internalStake) {
    throw new Error('internalStake is missing in txAction');
  }

  const titleInfo: ITxActionMetaTitle = {
    titleKey: 'action__stake',
  };

  const iconUrl = action.internalStake?.tokenInfo?.logoURI;
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
    stakeInfo: action.internalStake,
  };
}

export function TxActionStake(props: ITxActionCardProps) {
  const { meta, decodedTx } = props;
  const { stakeInfo } = getTxActionStakeInfo(props);
  const { tokenInfo, amount, accountAddress } = stakeInfo;
  const intl = useIntl();
  const details: ITxActionElementDetail[] = [
    {
      title: intl.formatMessage({ id: 'content__amount' }),
      content: (
        <TxActionElementAmountLarge
          amount={amount}
          symbol={tokenInfo.symbol}
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
    <TxDetailActionBoxAutoTransform
      decodedTx={decodedTx}
      iconInfo={meta?.iconInfo}
      titleInfo={meta?.titleInfo}
      // content={amountView}
      details={details}
    />
  );
}

export function TxActionStakeT0(props: ITxActionCardProps) {
  const { meta, decodedTx, historyTx } = props;
  const { stakeInfo } = getTxActionStakeInfo(props);
  const { accountAddress } = stakeInfo;
  const statusBar = (
    <TxStatusBarInList decodedTx={decodedTx} historyTx={historyTx} />
  );
  return (
    <TxListActionBox
      symbol={stakeInfo.tokenInfo.symbol}
      footer={statusBar}
      iconInfo={meta?.iconInfo}
      titleInfo={meta?.titleInfo}
      content={
        <TxActionElementAmountNormal
          textAlign="right"
          amount={stakeInfo.amount}
          symbol={stakeInfo.tokenInfo.symbol}
          direction={IDecodedTxDirection.OUT}
        />
      }
      subTitle={shortenAddress(accountAddress)}
    />
  );
}
