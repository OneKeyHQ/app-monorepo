import { useMemo } from 'react';

import { XStack, YStack } from 'tamagui';

import { Badge, Image, ListItem, SizableText } from '@onekeyhq/components';

import { ESwapTxHistoryStatus } from '../types';

import type { ISwapTxHistory } from '../types';

interface ISwapTxHistoryListCellProps {
  item: ISwapTxHistory;
  onClickCell: () => void;
}

const SwapTxHistoryListCell = ({
  item,
  onClickCell,
}: ISwapTxHistoryListCellProps) => {
  const subContent = useMemo(() => {
    if (item.status !== ESwapTxHistoryStatus.SUCCESS) {
      return (
        <Badge
          badgeType={
            item.status === ESwapTxHistoryStatus.FAILED ? 'critical' : 'default'
          }
          badgeSize="lg"
        />
      );
    }
    return (
      <SizableText>
        {item.baseInfo.fromNetwork?.networkId ===
        item.baseInfo.toNetwork?.networkId
          ? item.baseInfo.fromNetwork?.name ?? ''
          : `${item.baseInfo.fromNetwork?.name ?? ''} | ${
              item.baseInfo.toNetwork?.name ?? ''
            }`}
      </SizableText>
    );
  }, [item.baseInfo, item.status]);

  const title = useMemo(
    () => (
      <SizableText>{`${item.baseInfo.fromToken.symbol.toUpperCase()} -> ${item.baseInfo.toToken.symbol.toUpperCase()}`}</SizableText>
    ),
    [item.baseInfo.fromToken.symbol, item.baseInfo.toToken.symbol],
  );

  const imageSource = useMemo(() => {
    if (item.baseInfo.fromToken.networkId === item.baseInfo.toToken.networkId) {
      return item.baseInfo.fromToken.logoURI;
    }
    return ''; // TODO 跨链 icon logo
  }, [
    item.baseInfo.fromToken.logoURI,
    item.baseInfo.fromToken.networkId,
    item.baseInfo.toToken.networkId,
  ]);
  return (
    <ListItem justifyContent="space-between" onPress={onClickCell}>
      <XStack>
        <Image source={{ uri: imageSource }} w="$10" h="$10" />
        <YStack>
          <SizableText>{title}</SizableText>
          <SizableText>{subContent}</SizableText>
        </YStack>
      </XStack>
      <YStack>
        <SizableText>{`+${
          item.baseInfo.toAmount
        } ${item.baseInfo.toToken.symbol.toUpperCase()}`}</SizableText>
        <SizableText>{`-${
          item.baseInfo.fromAmount
        } ${item.baseInfo.fromToken.symbol.toUpperCase()}`}</SizableText>
      </YStack>
    </ListItem>
  );
};

export default SwapTxHistoryListCell;
