import type { FC } from 'react';

import { Box, Image, Pressable, Typography } from '@onekeyhq/components';

import type { ImageSourcePropType } from 'react-native';

type OptionsProps = {
  title: string;
  subtitle: string;
  source?: string;
  logo: ImageSourcePropType;
  num: string;
  onPress?: () => void;
};

export const Options: FC<OptionsProps> = ({
  title,
  subtitle,
  source = require('@onekeyhq/kit/assets/staking/eth_logo.png'),
  logo,
  num,
  onPress,
}) => (
  <Pressable
    onPress={onPress}
    bg="surface-default"
    px="4"
    py="3"
    flexDirection="row"
    justifyContent="space-between"
    borderRadius={12}
  >
    <Box flexDirection="row" alignItems="center">
      <Box mr="3" position="relative">
        <Box w="10" h="10" borderRadius="full" overflow="hidden">
          <Image w="10" h="10" source={source} />
        </Box>
        <Box
          w="5"
          h="5"
          background="surface-subdued"
          flexDirection="row"
          justifyContent="center"
          alignItems="center"
          borderRadius="full"
          position="absolute"
          bottom="-1"
          right="-1"
        >
          <Image w="4" h="4" source={logo} />
        </Box>
      </Box>
      <Box>
        <Typography.Body1Strong>{title}</Typography.Body1Strong>
        <Typography.Body2 color="text-subdued">{subtitle}</Typography.Body2>
      </Box>
    </Box>
    <Box flexDirection="row" justifyContent="center" alignItems="center">
      <Typography.Body1Strong color="text-success">
        {num}
      </Typography.Body1Strong>
    </Box>
  </Pressable>
);
