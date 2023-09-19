import type { FC } from 'react';

import { Box, Typography, useIsVerticalLayout } from '@onekeyhq/components';

import { SwappingViaLogos } from '../components/SwappingVia';

import type { Provider } from '../typings';

type LiquiditySourcesProps = {
  providers?: Provider[];
  isDisabled?: boolean;
};

export const LiquiditySources: FC<LiquiditySourcesProps> = ({
  providers,
  isDisabled,
}) => {
  const isSmall = useIsVerticalLayout();

  const sources = providers?.map((item) => item.logoUrl).filter(Boolean) ?? [];
  let text = 'OneKey Swap';
  if (providers?.length === 1) {
    text = providers[0].name;
  } else if (providers?.length && providers?.length >= 2) {
    text = `${providers.length} Exchanges`;
  }
  if (isSmall) {
    return <SwappingViaLogos size={6} sources={sources} />;
  }
  return (
    <Box
      flexDirection="row"
      alignItems="center"
      bg="surface-neutral-subdued"
      borderRadius={12}
      py="1"
      px="2"
    >
      <SwappingViaLogos sources={sources} />
      <Typography.Caption
        ml="1"
        color={isDisabled ? 'text-disabled' : 'text-default'}
      >
        {text}
      </Typography.Caption>
    </Box>
  );
};
