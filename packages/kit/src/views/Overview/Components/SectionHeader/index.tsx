import React, { FC } from 'react';

import { Box, IconButton, Text } from '@onekeyhq/components';

export type ViewTypes = 'L' | 'R';

type HeaderProps = {
  title: string;
  filter?: () => void;
};

const SectionHeader: FC<HeaderProps> = ({ title, filter }) => (
  <Box
    width="full"
    height="48px"
    flexDirection="row"
    justifyContent="space-between"
    alignItems="flex-start"
  >
    <Text typography="Heading">{title}</Text>
    <Box flexDirection="row">
      {filter && (
        <IconButton name="FilterSolid" size="sm" type="plain" mr="16px" />
      )}
    </Box>
  </Box>
);

export default SectionHeader;
