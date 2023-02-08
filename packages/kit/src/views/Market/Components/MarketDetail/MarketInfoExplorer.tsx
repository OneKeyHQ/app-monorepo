import type { FC } from 'react';
import { useMemo, useRef } from 'react';

import { Box, Icon, Image, Pressable, Typography } from '@onekeyhq/components';
import { SCREEN_SIZE } from '@onekeyhq/components/src/Provider/device';
import { shortenAddress } from '@onekeyhq/components/src/utils';

import { useNetwork } from '../../../../hooks';
import { useGridBoxStyle } from '../../hooks/useMarketLayout';

import type { MarketEXplorer } from '../../../../store/reducers/market';

type MarketInfoExplorerProps = {
  onPress?: (isNativeToken: boolean, eleRef: any) => void;
  width?: string;
  height?: string;
  index: number;
  explorer?: MarketEXplorer;
  triggerProps?: any;
};

export const MarketInfoExplorer: FC<MarketInfoExplorerProps> = ({
  height = '48px',
  onPress,
  explorer,
  index,
  triggerProps,
}) => {
  const boxStyle = useGridBoxStyle({
    index,
    maxW: SCREEN_SIZE.LARGE,
    outPadding: 32,
  });
  const { network } = useNetwork({ networkId: explorer?.networkId });
  const isNativeToken = Boolean(explorer?.url);
  const eleRef = useRef();
  const networkIcon = useMemo(() => {
    if (!network?.logoURI) return null;
    return (
      <Image
        borderRadius="12px"
        src={network.logoURI}
        alt={network.logoURI}
        size="25px"
        ml={2}
      />
    );
  }, [network]);
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
      onPress={() => {
        onPress?.(isNativeToken, eleRef);
      }}
      {...triggerProps}
    >
      <Box flex={1} ref={eleRef} flexDirection="row" alignItems="center">
        {!isNativeToken ? networkIcon : null}
        <Box ml="2" flex={1}>
          <Typography.Body2Strong numberOfLines={1}>
            {explorer?.name}
          </Typography.Body2Strong>
          {explorer?.contractAddress ? (
            <Typography.Caption color="text-subdued">
              {shortenAddress(explorer?.contractAddress ?? '')}
            </Typography.Caption>
          ) : null}
        </Box>
        <Box mr="2">
          <Icon
            name={
              isNativeToken
                ? 'ArrowTopRightOnSquareMini'
                : 'EllipsisHorizontalMini'
            }
            color="icon-subdued"
            size={20}
          />
        </Box>
      </Box>
    </Pressable>
  );
};
