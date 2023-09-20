import type { ComponentProps, FC } from 'react';

import { Box, Center, Image, Text } from '@onekeyhq/components';

import type { Provider } from '../../typings';

type SwappingViaProps = {
  providers?: Provider[];
  typography?: ComponentProps<typeof Text>['typography'];
  color?: ComponentProps<typeof Text>['color'];
  fontWeight?: ComponentProps<typeof Text>['fontWeight'];
};

function proxyimg(base: string) {
  return `https://node.onekey.so/proxyimg?base=${base}`;
}

type SwappingViaLogosProps = { sources?: string[]; size?: number };

export const OneKeyLogo: FC<SwappingViaLogosProps> = ({ size }) => {
  const imageSize = size || 4;
  return (
    <Box
      borderRadius="full"
      w={imageSize}
      h={imageSize}
      overflow="hidden"
      bgColor="surface-neutral-default"
    >
      <Image
        size={imageSize}
        source={require('@onekeyhq/kit/assets/logo.png')}
      />
    </Box>
  );
};

export const SwappingViaLogos: FC<SwappingViaLogosProps> = ({
  sources,
  size,
}) => {
  const imageSize = size || 4;
  if (!sources || sources.length === 0) {
    return <OneKeyLogo />;
  }
  if (sources.length === 1) {
    return (
      <Box
        borderRadius="full"
        w={imageSize}
        h={imageSize}
        overflow="hidden"
        key={sources[0]}
        bgColor="surface-neutral-default"
      >
        <Image
          size={imageSize}
          src={proxyimg(sources[0])}
          testID={sources[0]}
        />
      </Box>
    );
  }
  const calcMargin = (index: number, base: number): number => {
    if (index <= 0) {
      return 0;
    }
    return -base / 2;
  };
  return (
    <Box flexDirection="row" alignItems="center">
      {sources.map((source, index) => (
        <Center
          ml={calcMargin(index, imageSize)}
          borderRadius="full"
          h={imageSize}
          w={imageSize}
          overflow="hidden"
          key={source}
          bgColor="surface-neutral-default"
        >
          <Image size={imageSize} src={proxyimg(source)} />
        </Center>
      ))}
    </Box>
  );
};

const SwappingVia: FC<SwappingViaProps> = ({
  providers,
  typography = 'Caption',
  color = 'text-subdued',
  fontWeight = 400,
}) => {
  if (!providers) {
    return (
      <Box flexDirection="row" flexGrow={1}>
        <Text typography={typography} color={color} isTruncated>
          OneKey Swap
        </Text>
      </Box>
    );
  }
  if (providers.length === 1) {
    return (
      <Box flexDirection="row" alignItems="center" flexGrow={1}>
        {providers[0].logoUrl ? (
          <SwappingViaLogos sources={[providers[0].logoUrl]} />
        ) : null}
        <Text
          ml={2}
          typography={typography}
          color={color}
          fontWeight={fontWeight}
          isTruncated
        >
          {providers[0].name}
        </Text>
      </Box>
    );
  }
  if (providers.length > 1) {
    const sources = providers.map((i) => i.logoUrl).filter(Boolean);
    return (
      <Box alignItems="center" flexDirection="row" flexGrow={1}>
        {sources.length > 0 ? <SwappingViaLogos sources={sources} /> : null}
        <Text
          ml="2"
          typography={typography}
          color={color}
          fontWeight={fontWeight}
          isTruncated
        >
          {providers.length} Exchanges
        </Text>
      </Box>
    );
  }
  return (
    <Box alignItems="center" flexDirection="row" flexGrow={1}>
      <Text typography={typography} color={color}>
        OneKey Swap
      </Text>
    </Box>
  );
};

export default SwappingVia;
