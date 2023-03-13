import type { FC } from 'react';

import type { ICON_NAMES } from '@onekeyhq/components';
import { Box, Center, Icon, Token } from '@onekeyhq/components';

export const NetworkIcon: FC<{
  size: number | string;
  name?: string;
  logoURI?: string;
  iconName?: ICON_NAMES;
}> = ({ name, logoURI, size, iconName }) => (
  <Center>
    <Box size={size} position="relative">
      <Token token={{ logoURI, name }} size={size} />
      {iconName ? (
        <Box
          position="absolute"
          size="6"
          right="-4px"
          bottom="-4px"
          alignItems="center"
          justifyItems="center"
        >
          <Icon name={iconName} size={24} color="icon-success" />
        </Box>
      ) : null}
    </Box>
  </Center>
);
