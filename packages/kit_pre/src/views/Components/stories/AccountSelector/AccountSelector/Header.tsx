import type { FC } from 'react';

import { Box, IconButton, Text } from '@onekeyhq/components';

type HeaderProps = {
  title?: string;
};

const defaultProps = {} as const;

const Header: FC<HeaderProps> = ({ title }) => (
  <Box flexDirection="row" alignItems="center" pt={3.5} pr={3.5} pb={2} pl={4}>
    <Text typography="Heading" flex={1} mr={3} isTruncated>
      {title}
    </Text>
    <IconButton name="XMarkMini" type="plain" circle />
  </Box>
);

Header.defaultProps = defaultProps;

export default Header;
