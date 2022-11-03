import { FC } from 'react';

import { Box, useIsVerticalLayout } from '@onekeyhq/components';

import ExplorerDesktop from './Desktop/ExplorerDesktop';
import ExplorerMobile from './Mobile/ExplorerMobile';

// const showExplorerBar = webHandler !== 'browser';

const Explorer: FC = () => {
  const isVerticalLayout = useIsVerticalLayout();

  return (
    <Box flex={1} bg="background-default">
      {isVerticalLayout ? <ExplorerMobile /> : <ExplorerDesktop />}
    </Box>
  );
};

export default Explorer;
