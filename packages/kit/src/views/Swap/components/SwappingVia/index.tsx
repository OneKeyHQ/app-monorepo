import React, { ComponentProps, FC } from 'react';

import { Box, Image, Text } from '@onekeyhq/components';

import { Provider } from '../../typings';

type SwappingViaProps = {
  providers?: Provider[];
  typography?: ComponentProps<typeof Text>['typography'];
  color?: ComponentProps<typeof Text>['color'];
};

type SwappingViaLogosProps = { sources?: string[] };
const SwappingViaLogos: FC<SwappingViaLogosProps> = ({ sources }) => {
  if (!sources || sources.length === 0) {
    return null;
  }
  if (sources.length === 1) {
    return (
      <Box borderRadius="full" w="4" h="4" overflow="hidden" mr="2">
        <Image size="4" src={sources[0]} />
      </Box>
    );
  }
  const calcMargin = (index: number, base: number): number => {
    if (index <= 0) {
      return 0;
    }
    return -(index * base) / 2;
  };
  return (
    <Box mr="2" flexDirection="row" alignItems="center">
      {sources.map((source, index) => (
        <Box
          ml={calcMargin(index, 4)}
          borderRadius="full"
          w="4"
          h="4"
          overflow="hidden"
        >
          <Image size="4" src={source} />
        </Box>
      ))}
    </Box>
  );
};

const SwappingVia: FC<SwappingViaProps> = ({
  providers,
  typography = 'Caption',
  color = 'text-subdued',
}) => {
  if (!providers) {
    return (
      <Text typography={typography} color={color}>
        Onekey Swap
      </Text>
    );
  }
  if (providers.length === 1) {
    return (
      <Box flexDirection="row" alignItems="center">
        {providers[0].logoUrl ? (
          <SwappingViaLogos sources={[providers[0].logoUrl]} />
        ) : null}
        <Text typography={typography} color={color}>
          {providers[0].name}
        </Text>
      </Box>
    );
  }
  if (providers.length > 1) {
    const sources = providers.map((i) => i.logoUrl).filter(Boolean);
    return (
      <Box alignItems="center" flexDirection="row" alignContent="center">
        {sources.length > 0 ? <SwappingViaLogos sources={sources} /> : null}
        <Text typography={typography} color={color}>
          {providers.length} Exchanges
        </Text>
      </Box>
    );
  }
  return (
    <Text typography={typography} color={color}>
      Onekey Swap
    </Text>
  );
};

export default SwappingVia;
