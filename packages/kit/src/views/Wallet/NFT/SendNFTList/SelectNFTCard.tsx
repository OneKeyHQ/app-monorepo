import { memo, useCallback, useMemo } from 'react';
import type { ComponentProps, FC } from 'react';

import BigNumber from 'bignumber.js';
import { MotiView } from 'moti';

import { Badge, Box, Icon, Pressable, Text } from '@onekeyhq/components';
import { IMPL_EVM, IMPL_SOL } from '@onekeyhq/shared/src/engine/engineConsts';

import { useActiveSideAccount } from '../../../../hooks';
import { showAmountInputDialog } from '../AmountInputDialog';
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

  const onSelectAmount = useCallback(
    (selected: boolean, selectAmount: string) => {
      content?.setContext((value) => {
        const { listData } = value;
        const newList = listData.map((item) => {
          if (
            networkImpl === IMPL_EVM &&
            item.contractAddress === asset.contractAddress &&
            item.tokenId === asset.tokenId
          ) {
            return { ...item, selected, selectAmount };
          }
          if (
            networkImpl === IMPL_SOL &&
            item.tokenAddress &&
            item.tokenAddress === asset.tokenAddress
          ) {
            return { ...item, selected, selectAmount };
          }
          return item;
        });
        return {
          ...value,
          listData: newList,
        };
      });
    },
    [asset, content, networkImpl],
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

export default memo(SelectNFTCard);
