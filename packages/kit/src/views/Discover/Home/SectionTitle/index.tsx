import type { FC } from 'react';

import { Box, Typography, useIsVerticalLayout } from '@onekeyhq/components';

type SectionTitleProps = {
  title: string;
};

export const SectionTitle: FC<SectionTitleProps> = ({ title, children }) => {
  const isSmallScreen = useIsVerticalLayout();

  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      pl={isSmallScreen ? '16px' : '32px'}
      pr={isSmallScreen ? '8px' : '32px'}
      mb="14px"
      mt="2"
    >
      <Box flex={1}>
        <Typography.Heading numberOfLines={1}>{title}</Typography.Heading>
      </Box>
      <Box>{children}</Box>
    </Box>
  );
};
