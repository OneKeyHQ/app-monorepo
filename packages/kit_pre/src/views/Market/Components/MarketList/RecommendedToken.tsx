import type { FC } from 'react';
import { useMemo } from 'react';

import {
  Box,
  CheckBox,
  Image,
  Pressable,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import { useGridBoxStyle } from '../../hooks/useMarketLayout';

type RecomendedTokenProps = {
  name?: string;
  symbol?: string;
  onPress: (isSelected: boolean, coingckoId: string) => void;
  icon: string;
  isSelected?: boolean;
  coingeckoId: string;
  index: number;
};

const RecommendedTokenBox: FC<RecomendedTokenProps> = ({
  name,
  symbol,
  onPress,
  icon,
  coingeckoId,
  isSelected,
  index,
}) => {
  const isVertical = useIsVerticalLayout();
  const boxStyle = useGridBoxStyle({ index, outPadding: isVertical ? 32 : 48 });
  const value = useMemo(
    () => (isSelected ? coingeckoId : undefined),
    [coingeckoId, isSelected],
  );
  return (
    <Pressable
      height="64px"
      borderWidth={1}
      borderRadius="12px"
      borderColor="border-default"
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
      onPress={() => {
        onPress(!isSelected, coingeckoId);
      }}
      {...boxStyle}
    >
      <Box ml="3" alignItems="center" flexDirection="row" flex={1}>
        <Image borderRadius={16} src={icon} size={8} />
        <Box flexDirection="column" ml="2" flex={1}>
          <Typography.Body2Strong>{symbol}</Typography.Body2Strong>
          <Typography.Caption numberOfLines={1} color="text-subdued">
            {name}
          </Typography.Caption>
        </Box>
      </Box>
      <Box
        size={5}
        flexDirection="row"
        alignItems="center"
        justifyContent="center"
        mr={1}
      >
        <CheckBox
          isChecked={isSelected}
          value={value}
          onChange={() => {
            onPress(!isSelected, coingeckoId);
          }}
          pointerEvents="box-only"
        />
      </Box>
    </Pressable>
  );
};

export default RecommendedTokenBox;
