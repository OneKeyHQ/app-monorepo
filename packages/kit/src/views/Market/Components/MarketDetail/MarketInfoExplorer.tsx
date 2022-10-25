import { FC } from 'react';

import { Box, Icon, Pressable, Typography } from '@onekeyhq/components/src';
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
      <Box ml="2">
        <Typography.Body2Strong>{name}</Typography.Body2Strong>
        <Typography.Caption color="text-subdued">
          {shortenAddress(contractAddress ?? '')}
        </Typography.Caption>
      </Box>
      <Box mr="2">
        <Icon name="ExternalLinkSolid" size={20} />
      </Box>
    </Pressable>
  );
};
