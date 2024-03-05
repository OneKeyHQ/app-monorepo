import { useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { forOwn, groupBy, isEmpty, isNil, map, uniq } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Image,
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  EDecodedTxDirection,
  type IDecodedTxActionAssetTransfer,
  type IDecodedTxTransferInfo,
} from '@onekeyhq/shared/types/tx';

import { useAccountData } from '../../hooks/useAccountData';
import { useFeeInfoInDecodedTx } from '../../hooks/useTxFeeInfo';
import { Container } from '../Container';
import { Token } from '../Token';

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
  changePrefix,
  transfers,
  intl,
}: {
  changePrefix: string;
  transfers: IDecodedTxTransferInfo[];
  intl: IntlShape;
}) {
  let change = '';
  let changeSymbol = '';
  let changeDescription = '';

  if (transfers.length === 1) {
    const amountBN = new BigNumber(transfers[0].amount).abs();
    change = amountBN.toFixed();
    changeSymbol = transfers[0].symbol;
    changeDescription = amountBN
      .multipliedBy(transfers[0].price ?? 0)
      .toFixed();
  } else {
    const tokens = uniq(map(transfers, 'token'));
    if (tokens.length === 1) {
      const totalAmountBN = transfers.reduce(
        (acc, transfer) => acc.plus(new BigNumber(transfer.amount).abs()),
        new BigNumber(0),
      );
      change = totalAmountBN.toFixed();
      changeSymbol = transfers[0].symbol;

      changeDescription = totalAmountBN
        .multipliedBy(transfers[0].price ?? 0)
        .toFixed();
    } else {
      const transfersWithNFT = transfers.filter((send) => send.isNFT);
      const transfersWithToken = transfers.filter((send) => !send.isNFT);
      if (transfersWithNFT.length === 0) {
        change = `${tokens.length} ${intl.formatMessage({
          id: 'title__assets',
        })}`;
        changeDescription = `${transfersWithToken[0].symbol} and more`;
      } else if (transfersWithNFT.length === 1) {
        change = new BigNumber(transfersWithNFT[0].amount).abs().toFixed();
        changeSymbol = transfersWithNFT[0].symbol;
      } else {
        const totalNFTs = transfersWithNFT
          .reduce(
            (acc, transfer) => acc.plus(new BigNumber(transfer.amount).abs()),
            new BigNumber(0),
          )
          .toFixed();
        change = totalNFTs;
        changeSymbol = 'NFTs';
        changeDescription = `${transfersWithNFT[0].symbol} and more`;
      }
    }
  }

  return {
    change: `${changePrefix}${change}`,
    changeSymbol,
    changeDescription,
  };
}

function TxActionTransferListView(props: ITxActionProps) {
  const { tableLayout, decodedTx, componentProps } = props;
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  const { txFee, txFeeFiatValue, txFeeSymbol } = useFeeInfoInDecodedTx({
    decodedTx,
  });
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
    isNFT: !!(sendNFTIcon || receiveNFTIcon),
    fallbackIcon:
      sendNFTIcon || receiveNFTIcon
        ? 'ImageMountainSolid'
        : 'QuestionmarkSolid',
  };
  let title = '';
  let change: React.ReactNode = '';
  let changeSymbol = '';
  let changeDescription: React.ReactNode = '';
  let changeDescriptionSymbol = '';

  title = label;

  if (!isEmpty(sends) && isEmpty(receives)) {
    const changeInfo = buildTransferChangeInfo({
      changePrefix: '-',
      transfers: sends,
      intl,
    });
    change = changeInfo.change;
    changeSymbol = changeInfo.changeSymbol;
    changeDescription = changeInfo.changeDescription;
    avatar.src = sendNFTIcon || sendTokenIcon;
    title = intl.formatMessage({ id: 'action__send' });
  } else if (isEmpty(sends) && !isEmpty(receives)) {
    const changeInfo = buildTransferChangeInfo({
      changePrefix: '+',
      transfers: receives,
      intl,
    });
    change = changeInfo.change;
    changeSymbol = changeInfo.changeSymbol;
    changeDescription = changeInfo.changeDescription;
    avatar.src = receiveNFTIcon || receiveTokenIcon;
    title = intl.formatMessage({ id: 'action__receive' });
  } else {
    const sendChangeInfo = buildTransferChangeInfo({
      changePrefix: '-',
      transfers: sends,
      intl,
    });
    const receiveChangeInfo = buildTransferChangeInfo({
      changePrefix: '+',
      transfers: receives,
      intl,
    });
    change = receiveChangeInfo.change;
    changeSymbol = receiveChangeInfo.changeSymbol;
    changeDescription = sendChangeInfo.change;
    changeDescriptionSymbol = sendChangeInfo.changeSymbol;
    avatar.src = [
      sendNFTIcon || sendTokenIcon,
      receiveNFTIcon || receiveTokenIcon,
    ].filter(Boolean);
  }

  change = (
    <NumberSizeableText
      formatter="balance"
      formatterOptions={{
        tokenSymbol: changeSymbol,
        showPlusMinusSigns: true,
      }}
      numberOfLines={1}
      size="$bodyLgMedium"
      {...((change as string)?.includes('+') && {
        color: '$textSuccess',
      })}
      {...(tableLayout && {
        size: '$bodyMdMedium',
      })}
    >
      {change}
    </NumberSizeableText>
  );
  changeDescription = (
    <NumberSizeableText
      formatter={changeDescriptionSymbol ? 'balance' : 'value'}
      formatterOptions={{
        tokenSymbol: changeDescriptionSymbol,
        currency: changeDescriptionSymbol ? '' : settings.currencyInfo.symbol,
        showPlusMinusSigns: !!changeDescriptionSymbol,
      }}
      size="$bodyMd"
      color="$textSubdued"
      numberOfLines={1}
    >
      {changeDescription}
    </NumberSizeableText>
  );

  return (
    <TxActionCommonListView
      title={title}
      avatar={avatar}
      description={description}
      change={change}
      changeDescription={changeDescription}
      tableLayout={tableLayout}
      fee={txFee}
      feeFiatValue={txFeeFiatValue}
      feeSymbol={txFeeSymbol}
      timestamp={decodedTx.updatedAt ?? decodedTx.createdAt}
      {...componentProps}
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
  const { decodedTx, nativeTokenTransferAmountToUpdate } = props;
  const { sends, receives, from } = getTxActionTransferInfo(props);

  const sendsBlock = buildTransfersBlock(groupBy(sends, 'to'));
  const receivesBlock = buildTransfersBlock(groupBy(receives, 'from'));

  const { network } = useAccountData({
    networkId: decodedTx.networkId,
  });

  const renderTransferBlock = useCallback(
    (transfersBlock: ITransferBlock[], direction: EDecodedTxDirection) => {
      if (isEmpty(transfersBlock)) return null;

      const transferElements: React.ReactElement[] = [];

      transfersBlock.forEach((block, index) => {
        const { target, transfersInfo } = block;
        const transfersContent = (
          <YStack space="$1" flex={1}>
            {transfersInfo.map((transfer) => (
              <XStack
                alignItems="center"
                space="$1"
                key={transfer.tokenIdOnNetwork}
                overflow="hidden"
              >
                <Token
                  size="md"
                  isNFT={transfer.isNFT}
                  tokenImageUri={transfer.icon}
                />
                <SizableText size="$headingLg" numberOfLines={1}>{`${
                  direction === EDecodedTxDirection.OUT ? '-' : '+'
                } ${
                  !isNil(nativeTokenTransferAmountToUpdate) &&
                  transfer.isNative &&
                  direction === EDecodedTxDirection.OUT
                    ? nativeTokenTransferAmountToUpdate
                    : transfer.amount
                } ${transfer.symbol}`}</SizableText>
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

      transferElements.push(
        <Container.Item
          title={intl.formatMessage({ id: 'network__network' })}
          content={
            <XStack alignItems="center" space="$1">
              <Image w="$5" h="$5" source={{ uri: network?.logoURI }} />
              <SizableText size="$bodyMdMedium">{network?.name}</SizableText>
            </XStack>
          }
        />,
      );

      return <Container.Box>{transferElements}</Container.Box>;
    },
    [
      from,
      intl,
      nativeTokenTransferAmountToUpdate,
      network?.logoURI,
      network?.name,
    ],
  );

  return (
    <>
      {renderTransferBlock(sendsBlock, EDecodedTxDirection.OUT)}
      {renderTransferBlock(receivesBlock, EDecodedTxDirection.IN)}
    </>
  );
}

export { TxActionTransferListView, TxActionTransferDetailView };
