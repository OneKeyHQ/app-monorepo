import { FC } from 'react';

import {
  Box,
  Icon,
  Pressable,
  Token,
  Typography,
} from '@onekeyhq/components/src';
import { shortenAddress } from '@onekeyhq/components/src/utils';

type MarketInfoExplorerProps = {
  name?: string;
  iconUrl?: string;
  address?: string;
  width?: string;
  height?: string;
};

export const MarketInfoExplorer: FC<MarketInfoExplorerProps> = ({
  name,
  iconUrl,
  address,
  width = '173px',
  height = '48px',
}) => {
  console.log('MarketInfoExplorer');
  return (
    <Pressable width={width} height={height}>
      <Box
        borderWidth={1}
        borderRadius="12px"
        borderColor="border-default"
        flexDirection="row"
        alignItems="center"
      >
        <Box ml="3" flexDirection="row" width="100px">
          <Token size={8} src={iconUrl} />
          <Box flexDirection="column" ml="2">
            <Typography.Body2Strong>{name}</Typography.Body2Strong>
            <Typography.Caption color="text-subdued">
              {shortenAddress(address ?? '')}
            </Typography.Caption>
          </Box>
        </Box>
        <Icon name="ExternalLinkSolid" size={20} />
      </Box>
    </Pressable>
  );
};
