import { useMemo } from 'react';

import { XStack, YStack } from 'tamagui';

import { Badge, Image, ListItem, Text } from '@onekeyhq/components';

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
          type={
            item.status === ESwapTxHistoryStatus.FAILED ? 'critical' : 'default'
          }
          size="lg"
        />
      );
    }
    return (
      <Text>
        {item.baseInfo.fromNetwork?.networkId ===
        item.baseInfo.toNetwork?.networkId
          ? item.baseInfo.fromNetwork?.name ?? ''
          : `${item.baseInfo.fromNetwork?.name ?? ''} | ${
              item.baseInfo.toNetwork?.name ?? ''
            }`}
      </Text>
    );
  }, [item.baseInfo, item.status]);

  const title = useMemo(
    () => (
      <Text>{`${item.baseInfo.fromToken.symbol.toUpperCase()} -> ${item.baseInfo.toToken.symbol.toUpperCase()}`}</Text>
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
          <Text>{title}</Text>
          <Text>{subContent}</Text>
        </YStack>
      </XStack>
      <YStack>
        <Text>{`+${
          item.baseInfo.toAmount
        } ${item.baseInfo.toToken.symbol.toUpperCase()}`}</Text>
        <Text>{`-${
          item.baseInfo.fromAmount
        } ${item.baseInfo.fromToken.symbol.toUpperCase()}`}</Text>
      </YStack>
    </ListItem>
  );
};

export default SwapTxHistoryListCell;
