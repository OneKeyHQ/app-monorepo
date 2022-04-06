import React, { FC } from 'react';

import {
  Box,
  Button,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';

export const SectionTitle: FC<{ title: string }> = ({ title }) => {
  const isSmallScreen = useIsVerticalLayout();

  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      pl={isSmallScreen ? '16px' : '32px'}
      pr={isSmallScreen ? '8px' : '32px'}
      mb="14px"
    >
      <Typography.Heading>{title}</Typography.Heading>
      <Button
        height="32px"
        type="plain"
        size="sm"
        rightIconName="ChevronRightSolid"
        textProps={{ color: 'text-subdued' }}
      >
        See All
      </Button>
    </Box>
  );
};
