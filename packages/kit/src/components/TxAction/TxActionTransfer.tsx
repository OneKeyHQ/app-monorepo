import { useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { forOwn, groupBy, isEmpty, map, uniq } from 'lodash';
import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  EDecodedTxDirection,
  type IDecodedTxActionAssetTransfer,
  type IDecodedTxTransferInfo,
} from '@onekeyhq/shared/types/tx';

import { getFormattedNumber } from '../../utils/format';
import { Container } from '../Container';

import { TxActionCommonListView } from './TxActionCommon';

import type { ITxActionCommonListViewProps, ITxActionProps } from './types';
import type { IntlShape } from 'react-intl';

type ITransferBlock = {
  target: string;
  transfersInfo: IDecodedTxTransferInfo[];
};

function getTxActionTransferInfo(props: ITxActionProps) {
  const { action } = props;

  const { from, to, sends, receives, label } =
    action.assetTransfer as IDecodedTxActionAssetTransfer;

  let transferTarget = '';

  const sendsWithNFT = sends.filter((send) => send.isNFT);
  const sendsWithToken = sends.filter((send) => !send.isNFT);
  const receivesWithToken = receives.filter((receive) => !receive.isNFT);
  const receivesWithNFT = receives.filter((receive) => receive.isNFT);

  if (!isEmpty(sends) && isEmpty(receives)) {
    const targets = uniq(map(sends, 'to'));
    if (targets.length === 1) {
      [transferTarget] = targets;
    } else {
      transferTarget = to;
    }
  } else if (isEmpty(sends) && !isEmpty(receives)) {
    const targets = uniq(map(receives, 'from'));
    if (targets.length === 1) {
      [transferTarget] = targets;
    } else {
      transferTarget = from;
    }
  } else {
    transferTarget = to;
  }

  return {
    sends,
    receives,
    from,
    to,
    label: label ?? '',
    transferTarget,
    sendNFTIcon: sendsWithNFT[0]?.icon,
    receiveNFTIcon: receivesWithNFT[0]?.icon,
    sendTokenIcon: sendsWithToken[0]?.icon,
    receiveTokenIcon: receivesWithToken[0]?.icon,
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
    change = `${
      getFormattedNumber(new BigNumber(transfers[0].amount).abs().toFixed()) ??
      '0'
    } ${transfers[0].symbol}`;
  } else {
    const tokens = uniq(map(transfers, 'token'));
    if (tokens.length === 1) {
      const totalAmount =
        getFormattedNumber(
          transfers
            .reduce(
              (acc, transfer) => acc.plus(new BigNumber(transfer.amount).abs()),
              new BigNumber(0),
            )
            .toFixed(),
        ) || '0';
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
        change = `${new BigNumber(transfersWithNFT[0].amount)
          .abs()
          .toFixed()} ${transfersWithNFT[0].symbol}`;
      } else {
        const totalNFTs =
          getFormattedNumber(
            transfersWithNFT
              .reduce(
                (acc, transfer) =>
                  acc.plus(new BigNumber(transfer.amount).abs()),
                new BigNumber(0),
              )
              .toFixed(),
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

function TxActionTransferListView(props: ITxActionProps) {
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
    children: accountUtils.shortenAddress({
      address: transferTarget,
    }),
  };
  const avatar: ITxActionCommonListViewProps['avatar'] = {
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
      transfers: sends,
      intl,
    });
    const receiveChangeInfo = buildTransferChangeInfo({
      changeSymbol: '+',
      transfers: receives,
      intl,
    });
    change = receiveChangeInfo.change;
    changeDescription = sendChangeInfo.change;
    description.prefix = intl.formatMessage({ id: 'content__to' });
    avatar.src = [
      sendNFTIcon || sendTokenIcon,
      receiveNFTIcon || receiveTokenIcon,
    ].filter(Boolean);
  }

  return (
    <TxActionCommonListView
      title={title}
      avatar={avatar}
      description={description}
      change={change}
      changeDescription={changeDescription}
      tableLayout={tableLayout}
    />
  );
}

function buildTransfersBlock(
  transferGroup: Record<string, IDecodedTxTransferInfo[]>,
) {
  const transfersBlock: ITransferBlock[] = [];

  forOwn(transferGroup, (transfers, target) => {
    const transfersInfo: IDecodedTxTransferInfo[] = [];
    const tokenGroup = groupBy(transfers, 'token');
    forOwn(tokenGroup, (tokens) => {
      const token = tokens[0];
      const tokensAmount = tokens.reduce(
        (acc, item) => acc.plus(item.amount),
        new BigNumber(0),
      );
      transfersInfo.push({
        ...token,
        amount: tokensAmount.toFixed(),
      });
    });
    transfersBlock.push({
      target,
      transfersInfo,
    });
  });

  return transfersBlock;
}

function TxActionTransferDetailView(props: ITxActionProps) {
  const intl = useIntl();
  const { sends, receives, from } = getTxActionTransferInfo(props);

  const sendsBlock = buildTransfersBlock(groupBy(sends, 'to'));
  const receivesBlock = buildTransfersBlock(groupBy(receives, 'from'));

  const renderTransferBlock = useCallback(
    (transfersBlock: ITransferBlock[], direction: EDecodedTxDirection) => {
      if (isEmpty(transfersBlock)) return null;

      const transferElements: React.ReactElement[] = [];

      transfersBlock.forEach((block, index) => {
        const { target, transfersInfo } = block;
        const transfersContent = (
          <YStack space="$1">
            {transfersInfo.map((transfer) => (
              <XStack
                alignItems="center"
                space="$1"
                key={transfer.tokenIdOnNetwork}
              >
                <ListItem.Avatar
                  src={transfer.icon}
                  size="$7"
                  circular={!transfer.isNFT}
                  fallbackProps={{
                    bg: '$bgStrong',
                    justifyContent: 'center',
                    alignItems: 'center',
                    children: (
                      <Icon
                        name={
                          transfer.isNFT
                            ? 'QuestionmarkOutline'
                            : 'ImageMountainSolid'
                        }
                        color="$iconSubdued"
                      />
                    ),
                  }}
                />
                <SizableText size="$headingLg">{`${
                  direction === EDecodedTxDirection.OUT ? '-' : '+'
                } ${transfer.amount} ${transfer.symbol}`}</SizableText>
              </XStack>
            ))}
          </YStack>
        );
        transferElements.push(
          <Container.Item
            key={`${index}-amount`}
            title={intl.formatMessage({ id: 'content__amount' })}
            content={transfersContent}
          />,
        );
        transferElements.push(
          <Container.Item
            key={`${index}-target`}
            title={intl.formatMessage({
              id:
                direction === EDecodedTxDirection.OUT
                  ? 'content__to'
                  : 'content__from',
            })}
            content={target}
          />,
        );
      });

      if (direction === EDecodedTxDirection.OUT) {
        transferElements.push(
          <Container.Item
            key="from"
            title={intl.formatMessage({ id: 'content__from' })}
            content={from}
          />,
        );
      }

      return <Container.Box>{transferElements}</Container.Box>;
    },
    [from, intl],
  );

  return (
    <>
      {renderTransferBlock(sendsBlock, EDecodedTxDirection.OUT)}
      {renderTransferBlock(receivesBlock, EDecodedTxDirection.IN)}
    </>
  );
}

export { TxActionTransferListView, TxActionTransferDetailView };
