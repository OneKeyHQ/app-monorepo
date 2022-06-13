import React, { FC } from 'react';

import { Box, IconButton, SegmentedControl, Text } from '@onekeyhq/components';

export type ViewTypes = 'L' | 'R';

type HeaderProps = {
  title: string;
  type?: ViewTypes;
  onViewChange: (type: ViewTypes) => void;
  filter?: () => void;
};

const SectionHeader: FC<HeaderProps> = ({
  title,
  type = 'L',
  onViewChange,
  filter,
}) => (
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

      <SegmentedControl
        containerProps={{
          width: 70,
          height: 35,
        }}
        options={[
          {
            iconName: 'WalletSolid',
            value: 'L',
          },
          {
            iconName: 'ViewListSolid',
            value: 'R',
          },
        ]}
        onChange={(value) => onViewChange(value as ViewTypes)}
        defaultValue={type}
      />
    </Box>
  </Box>
);

export default SectionHeader;
