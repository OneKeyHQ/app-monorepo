import BigNumber from 'bignumber.js';
import { isEmpty, map, uniq } from 'lodash';
import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import { Icon, ListItem } from '@onekeyhq/components';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type {
  IDecodedTxActionTransfer,
  IDecodedTxTransferInfo,
} from '@onekeyhq/shared/types/tx';
import { EDecodedTxDirection } from '@onekeyhq/shared/types/tx';

import { getFormattedNumber } from '../../utils/format';

import { TxActionCommonT0, TxActionCommonT1 } from './TxActionCommon';

import type { ITxActionCommonProps, ITxActionProps } from './types';
import type { IntlShape } from 'react-intl';

function getTxActionTransferInfo(props: ITxActionProps) {
  const { action } = props;

  const { from, to, sends, receives, label } =
    action.transfer as IDecodedTxActionTransfer;

  let transferTarget = '';

  const sendsWithNFT = sends.filter((send) => send.isNFT);
  const sendsWithToken = sends.filter((send) => !send.isNFT);
  const receivesWithToken = receives.filter((receive) => !receive.isNFT);
  const receivesWithNFT = receives.filter((receive) => receive.isNFT);

  if (!isEmpty(sends) && isEmpty(receives)) {
    const targets = uniq(map(receives, 'to'));
    if (targets.length === 1) {
      [transferTarget] = targets;
    } else {
      transferTarget = to;
    }
  } else if (isEmpty(sends) && !isEmpty(receives)) {
    const targets = uniq(map(sends, 'from'));
    if (targets.length === 1) {
      [transferTarget] = targets;
      transferTarget = from;
    }
  } else {
    transferTarget = to;
  }

  return {
    sends,
    receives,
    label,
    transferTarget,
    sendNFTIcon: sendsWithNFT[0]?.image,
    receiveNFTIcon: receivesWithNFT[0]?.image,
    sendTokenIcon: sendsWithToken[0]?.image,
    receiveTokenIcon: receivesWithToken[0]?.image,
  };
}

function buildTransferChangeInfo({
  changeSymbol,
  transfers,
  intl,
}: {
  changeSymbol: string;
  transfers: IDecodedTxTransferInfo[];
  intl: IntlShape;
}) {
  let change = '';
  let changeDescription = '';

  if (transfers.length === 1) {
    change = `${transfers[0].amount} ${transfers[0].symbol}`;
  } else {
    const tokens = uniq(map(transfers, 'token'));
    const totalAmount =
      getFormattedNumber(
        transfers.reduce(
          (acc, transfer) => acc.plus(transfer.amount),
          new BigNumber(0),
        ),
      ) || '0';
    if (tokens.length === 1) {
      change = `${totalAmount} ${transfers[0].symbol}`;
    } else {
      const transfersWithNFT = transfers.filter((send) => send.isNFT);
      const transfersWithToken = transfers.filter((send) => !send.isNFT);
      if (transfersWithNFT.length === 0) {
        change = `${tokens.length} ${intl.formatMessage({
          id: 'title__assets',
        })}`;
        changeDescription = `${transfersWithToken[0].symbol} and more`;
      } else if (transfersWithNFT.length === 1) {
        change = `${transfersWithNFT[0].amount} ${transfersWithNFT[0].symbol}`;
      } else {
        const totalNFTs =
          getFormattedNumber(
            transfersWithNFT.reduce(
              (acc, transfer) => acc.plus(transfer.amount),
              new BigNumber(0),
            ),
          ) || '0';
        change = `${totalNFTs} NFTs`;
        changeDescription = `${transfersWithNFT[0].symbol} and more`;
      }
    }
  }

  return {
    change: `${changeSymbol} ${change}`,
    changeDescription,
  };
}

function TxActionTransferT0(props: ITxActionProps) {
  const { tableLayout } = props;
  const intl = useIntl();
  const {
    sends,
    receives,
    label,
    transferTarget,
    sendNFTIcon,
    sendTokenIcon,
    receiveNFTIcon,
    receiveTokenIcon,
  } = getTxActionTransferInfo(props);
  const description = {
    prefix: '',
    children: transferTarget,
  };
  const avatar: ITxActionCommonProps['avatar'] = {
    circular: !(sendNFTIcon || receiveNFTIcon),
    fallbackIcon: !(sendNFTIcon || receiveNFTIcon)
      ? 'QuestionmarkSolid'
      : 'ImageMountainSolid',
  };
  let title = '';
  let change = '';
  let changeDescription = '';

  title = label;

  if (!isEmpty(sends) && isEmpty(receives)) {
    const changeInfo = buildTransferChangeInfo({
      changeSymbol: '-',
      transfers: sends,
      intl,
    });
    change = changeInfo.change;
    changeDescription = changeInfo.changeDescription;
    description.prefix = intl.formatMessage({ id: 'content__to' });
    avatar.src = sendNFTIcon || sendTokenIcon;
  } else if (isEmpty(sends) && !isEmpty(receives)) {
    const changeInfo = buildTransferChangeInfo({
      changeSymbol: '+',
      transfers: receives,
      intl,
    });
    change = changeInfo.change;
    changeDescription = changeInfo.changeDescription;
    description.prefix = intl.formatMessage({ id: 'content__from' });
    avatar.src = receiveNFTIcon || receiveTokenIcon;
  } else {
    const sendChangeInfo = buildTransferChangeInfo({
      changeSymbol: '-',
      transfers: receives,
      intl,
    });
    const receiveChangeInfo = buildTransferChangeInfo({
      changeSymbol: '+',
      transfers: receives,
      intl,
    });
    change = sendChangeInfo.change;
    changeDescription = receiveChangeInfo.changeDescription;
    description.prefix = intl.formatMessage({ id: 'content__to' });
    avatar.src = [
      receiveNFTIcon || receiveTokenIcon,
      sendNFTIcon || sendTokenIcon,
    ].filter(Boolean);
  }

  return (
    <TxActionCommonT0
      title={title}
      avatar={avatar}
      description={description}
      change={change}
      changeDescription={changeDescription}
      tableLayout={tableLayout}
    />
  );
}

function TxActionTransferT1(props: ITxActionProps) {}

export { TxActionTransferT0, TxActionTransferT1 };
