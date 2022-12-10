import { FC } from 'react';

import { Box, Typography, useIsVerticalLayout } from '@onekeyhq/components';

import { SwappingViaLogos } from '../components/SwappingVia';
import { Provider } from '../typings';

type LiquiditySourcesProps = {
  providers?: Provider[];
};

export const LiquiditySources: FC<LiquiditySourcesProps> = ({ providers }) => {
  const isSmall = useIsVerticalLayout();

  const sources = providers?.map((item) => item.logoUrl).filter(Boolean) ?? [];
  let text = 'OneKey Swap';
  if (providers?.length === 1) {
    text = providers[0].name;
  } else if (providers?.length === 2) {
    text = `${providers.length} Exchanges`;
  }
  if (isSmall) {
    return <SwappingViaLogos sources={sources} />;
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
      <Typography.Caption ml="1">{text}</Typography.Caption>
    </Box>
  );
};
