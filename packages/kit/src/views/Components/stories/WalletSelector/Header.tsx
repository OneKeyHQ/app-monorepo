import type { FC } from 'react';

import {
  Box,
  IconButton,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';

type HeaderProps = {
  title?: string;
};

const Header: FC<HeaderProps> = ({ title }) => {
  const isVerticalLayout = useIsVerticalLayout();

  return (
    <Box
      flexDirection="row"
      alignItems="center"
      pt={{ base: 4, sm: 3 }}
      pr="15px"
      pb={{ base: 4, sm: 2 }}
      pl={4}
    >
      <Text
        flex={1}
        typography={isVerticalLayout ? 'PageHeading' : 'Heading'}
        mr={3}
        isTruncated
      >
        {title}
      </Text>
      <IconButton circle name="PlusMini" />
    </Box>
  );
};

export default Header;
