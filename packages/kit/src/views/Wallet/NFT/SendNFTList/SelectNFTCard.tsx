import { memo, useCallback, useMemo } from 'react';
import type { FC } from 'react';

import BigNumber from 'bignumber.js';
import { MotiView } from 'moti';

import { Badge, Box, Pressable, Text } from '@onekeyhq/components';
import type { NFTAsset } from '@onekeyhq/engine/src/types/nft';

import { SelectedIndicator } from '../../../../components/SelectedIndicator';
import { showAmountInputDialog } from '../AmountInputDialog';
import NFTListImage from '../NFTList/NFTListImage';

import {
  atomSelectedSendNFTList,
  useAtomSendNFTList,
} from './sendNFTListContext';

type Props = {
  cardWidth: number;
  accountId: string;
  networkId: string;
  multiSelect: boolean;
  asset: NFTAsset;
};

export function getKeyExtrator(params: {
  contractAddress?: string;
  tokenId?: string;
  networkId?: string;
  accountAddress?: string;
  tokenAddress?: string;
}) {
  return `${params.contractAddress ?? ''}-${params.tokenId ?? ''}-${
    params.networkId ?? ''
  }-${params.accountAddress ?? ''}-${params.tokenAddress ?? ''}`;
}

const CardItem: FC<{
  asset: NFTAsset;
  selected: boolean;
  selectAmount: string;
  onSelectAsset: () => void;
  multiSelect: boolean;
  cardWidth: number;
}> = ({
  onSelectAsset,
  multiSelect,
  cardWidth,
  asset,
  selectAmount,
  selected,
}) => {
  const AmountTag = useMemo(() => {
    if (
      asset?.amount &&
      Number(asset?.amount) > 1 &&
      asset.ercType === 'erc1155'
    ) {
      const total = new BigNumber(asset.amount).gt(9999)
        ? '9999+'
        : asset.amount;
      const sam = new BigNumber(selectAmount).gt(9999) ? '9999+' : selectAmount;
      const title = `${sam}/${total}`;
      return (
        <Badge
          position="absolute"
          left="6px"
          bottom="6px"
          title={title}
          size="sm"
          type="default"
        />
      );
    }
    return null;
  }, [asset.amount, asset.ercType, selectAmount]);

  return (
    <Box mb="16px" mr="2">
      <Pressable
        flexDirection="column"
        width={cardWidth}
        onPress={onSelectAsset}
      >
        {({ isHovered, isPressed }) => (
          <>
            <MotiView
              animate={{ opacity: isHovered || isPressed ? 0.8 : 1 }}
              transition={{ type: 'timing', duration: 150 }}
            >
              <Box>
                <NFTListImage
                  asset={asset}
                  borderRadius="12px"
                  size={cardWidth}
                />
                {AmountTag}
              </Box>
            </MotiView>
            <Text typography="Body2Strong" numberOfLines={2} mt="8px">
              {asset.name ?? asset.collection.contractName ?? ''}
            </Text>
            <Box position="absolute" right="6px" top="6px">
              <SelectedIndicator
                multiSelect={multiSelect}
                selected={selected}
                width={20}
              />
            </Box>
          </>
        )}
      </Pressable>
    </Box>
  );
};

const CardItemMemo = memo(CardItem);

const SelectNFTCard: FC<Props> = ({ cardWidth, multiSelect, asset }) => {
  const [selectedList, setSelectedList] = useAtomSendNFTList(
    atomSelectedSendNFTList,
  );

  const selectedAsset = useMemo(
    () => selectedList.find((n) => getKeyExtrator(n) === getKeyExtrator(asset)),
    [selectedList, asset],
  );

  const isSelected = useMemo(() => !!selectedAsset, [selectedAsset]);

  const selectedAmount = useMemo(
    () => selectedAsset?.selectAmount ?? '0',
    [selectedAsset?.selectAmount],
  );

  const onSelectAmount = useCallback(
    (selected: boolean, amount: string) => {
      const data = {
        ...asset,
        selected,
        selectAmount: amount,
      };

      setSelectedList((list) => {
        if (data.selected) {
          return [...list, data];
        }
        return list.filter((i) => getKeyExtrator(i) !== getKeyExtrator(data));
      });
    },
    [asset, setSelectedList],
  );

  const onSelectAsset = useCallback(() => {
    if (isSelected) {
      onSelectAmount(false, '0');
      return;
    }
    if (asset.amount && new BigNumber(asset.amount).gt(1)) {
      showAmountInputDialog({
        total: asset.amount,
        onConfirm: (amount) => {
          onSelectAmount(true, amount);
        },
      });
      return;
    }
    onSelectAmount(true, '1');
  }, [asset, onSelectAmount, isSelected]);

  return (
    <CardItemMemo
      asset={asset}
      selected={isSelected}
      selectAmount={selectedAmount}
      cardWidth={cardWidth}
      onSelectAsset={onSelectAsset}
      multiSelect={multiSelect}
    />
  );
};

export default memo(SelectNFTCard);
