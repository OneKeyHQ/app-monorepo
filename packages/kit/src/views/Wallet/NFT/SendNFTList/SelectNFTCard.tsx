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

import type { SelectAsset } from './sendNFTListContext';

type Props = NFTAsset & {
  cardWidth: number;
  accountId: string;
  networkId: string;
  multiSelect: boolean;
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

const CardItem: FC<
  SelectAsset & {
    onSelectAsset: () => void;
    multiSelect: boolean;
    cardWidth: number;
  }
> = ({ onSelectAsset, multiSelect, cardWidth, ...asset }) => {
  const AmountTag = useMemo(() => {
    if (
      asset?.amount &&
      Number(asset?.amount) > 1 &&
      asset.ercType === 'erc1155'
    ) {
      const total = new BigNumber(asset.amount).gt(9999)
        ? '9999+'
        : asset.amount;
      const selectAmount = new BigNumber(asset.selectAmount).gt(9999)
        ? '9999+'
        : asset.selectAmount;
      const title = `${selectAmount}/${total}`;
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
  }, [asset.amount, asset.ercType, asset.selectAmount]);

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
                selected={asset.selected}
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

const SelectNFTCard: FC<Props> = ({
  accountId,
  networkId,
  cardWidth,
  multiSelect,
  ...item
}) => {
  const [selectedList, setSelectedList] = useAtomSendNFTList(
    atomSelectedSendNFTList,
  );
  const asset = useMemo(
    () =>
      selectedList.find((n) => getKeyExtrator(n) === getKeyExtrator(item)) ?? {
        ...item,
        selected: false,
        selectAmount: '0',
      },
    [selectedList, item],
  );

  const onSelectAmount = useCallback(
    (selected: boolean, selectAmount: string) => {
      const data = {
        ...asset,
        selected,
        selectAmount,
      };
      let newList = [];

      if (data.selected) {
        newList = [...selectedList, data];
      } else {
        newList = selectedList.filter(
          (i) => getKeyExtrator(i) !== getKeyExtrator(data),
        );
      }

      setSelectedList(newList);
    },
    [asset, setSelectedList, selectedList],
  );

  const onSelectAsset = useCallback(() => {
    const { selected } = asset;
    if (selected) {
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
  }, [asset, onSelectAmount]);

  return (
    <CardItemMemo
      {...asset}
      cardWidth={cardWidth}
      onSelectAsset={onSelectAsset}
      multiSelect={multiSelect}
    />
  );
};

export default memo(SelectNFTCard);
