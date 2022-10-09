import React, { ComponentProps, memo, useCallback } from 'react';
import type { FC } from 'react';

import { Box, Icon, Pressable, Text } from '@onekeyhq/components';

import CollectibleListImage from '../NFTList/CollectibleListImage';

import { SelectAsset, useSendNFTContent } from './SendNFTContent';

type Props = ComponentProps<typeof Box> & {
  cardWidth: number;
  asset: SelectAsset;
};

function SelectedIndicator({
  multiSelect,
  selected,
  width,
}: {
  multiSelect?: boolean;
  selected: boolean;
  width: number;
}) {
  if (multiSelect === false && selected === false) {
    return null;
  }
  return (
    <Box
      borderRadius="full"
      justifyContent="center"
      alignItems="center"
      bgColor="icon-on-primary"
      size={`${width}px`}
    >
      {selected && (
        <Icon
          name="CheckCircleSolid"
          color="interactive-default"
          size={width}
        />
      )}
    </Box>
  );
}

const SelectNFTCard: FC<Props> = ({ cardWidth, asset, ...rest }) => {
  const content = useSendNFTContent();
  const multiSelect = content?.context.multiSelect;
  const onSelectAsset = useCallback(() => {
    content?.setContext((value) => {
      const { listData } = value;
      const { selected } = asset;
      const newList = listData.map((item) => {
        if (
          (item.contractAddress === asset.contractAddress &&
            item.tokenId === asset.tokenId) ||
          (item.tokenAddress && item.tokenAddress === asset.tokenAddress)
        ) {
          return { ...item, selected: !item.selected };
        }
        if (multiSelect === false && !selected) {
          return { ...item, selected: false };
        }
        return item;
      });
      return {
        ...value,
        listData: newList,
      };
    });
  }, [asset, content, multiSelect]);

  return (
    <Box mb="16px" {...rest}>
      <Pressable
        flexDirection="column"
        width={cardWidth}
        onPress={onSelectAsset}
      >
        <CollectibleListImage
          asset={asset}
          borderRadius="12px"
          size={cardWidth}
        />
        <Text typography="Body2Strong" height="40px" numberOfLines={2} mt="8px">
          {asset.name ?? asset.collection.contractName ?? ''}
        </Text>
        <Box position="absolute" right="6px" top="6px">
          <SelectedIndicator
            multiSelect={multiSelect}
            selected={asset.selected}
            width={20}
          />
        </Box>
      </Pressable>
    </Box>
  );
};

export default memo(SelectNFTCard);
