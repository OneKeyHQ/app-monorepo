import { memo, useCallback } from 'react';
import type { ComponentProps, FC } from 'react';

import { MotiView } from 'moti';

import { Box, Icon, Pressable, Text } from '@onekeyhq/components';
import { IMPL_EVM, IMPL_SOL } from '@onekeyhq/shared/src/engine/engineConsts';

import { useActiveSideAccount } from '../../../../hooks';
import NFTListImage from '../NFTList/NFTListImage';

import { useSendNFTContent } from './SendNFTContent';

import type { SelectAsset } from './SendNFTContent';

type Props = ComponentProps<typeof Box> & {
  cardWidth: number;
  asset: SelectAsset;
  accountId: string;
  networkId: string;
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
        <MotiView
          from={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'timing', duration: 150 }}
        >
          <Icon
            name="CheckCircleMini"
            color="interactive-default"
            size={width}
          />
        </MotiView>
      )}
    </Box>
  );
}

const SelectNFTCard: FC<Props> = ({
  accountId,
  networkId,
  cardWidth,
  asset,
  ...rest
}) => {
  const content = useSendNFTContent();
  const { networkImpl } = useActiveSideAccount({
    accountId,
    networkId,
  });
  const multiSelect = content?.context.multiSelect;
  const onSelectAsset = useCallback(() => {
    content?.setContext((value) => {
      const { listData } = value;
      const { selected } = asset;
      const newList = listData.map((item) => {
        if (
          networkImpl === IMPL_EVM &&
          item.contractAddress === asset.contractAddress &&
          item.tokenId === asset.tokenId
        ) {
          return { ...item, selected: !item.selected };
        }
        if (
          networkImpl === IMPL_SOL &&
          item.tokenAddress &&
          item.tokenAddress === asset.tokenAddress
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
  }, [asset, content, multiSelect, networkImpl]);

  return (
    <Box mb="16px" {...rest}>
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
              <NFTListImage
                asset={asset}
                borderRadius="12px"
                size={cardWidth}
              />
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

export default memo(SelectNFTCard);
