import type { FC } from 'react';

import { Box, Icon, Pressable, Typography } from '@onekeyhq/components';
import { SCREEN_SIZE } from '@onekeyhq/components/src/Provider/device';
import { shortenAddress } from '@onekeyhq/components/src/utils';

import { useGridBoxStyle } from '../../hooks/useMarketLayout';

type MarketInfoExplorerProps = {
  name?: string;
  contractAddress?: string;
  onPress?: () => void;
  width?: string;
  height?: string;
  index: number;
};

export const MarketInfoExplorer: FC<MarketInfoExplorerProps> = ({
  name,
  contractAddress,
  height = '48px',
  onPress,
  index,
}) => {
  const boxStyle = useGridBoxStyle({
    index,
    maxW: SCREEN_SIZE.LARGE,
    outPadding: 32,
  });
  return (
    <Pressable
      height={height}
      borderWidth={1}
      borderRadius="12px"
      borderColor="border-default"
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
      {...boxStyle}
      onPress={onPress}
    >
      <Box ml="2" flex={1}>
        <Typography.Body2Strong numberOfLines={1}>
          {name}
        </Typography.Body2Strong>
        {contractAddress ? (
          <Typography.Caption color="text-subdued">
            {shortenAddress(contractAddress)}
          </Typography.Caption>
        ) : null}
      </Box>
      <Box mr="2">
        <Icon name="ArrowTopRightOnSquareMini" color="icon-subdued" size={20} />
      </Box>
    </Pressable>
  );
};
