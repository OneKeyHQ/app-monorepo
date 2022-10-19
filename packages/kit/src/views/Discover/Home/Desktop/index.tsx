import { FC, useContext } from 'react';

import { Box } from '@onekeyhq/components';

import { DiscoverContext } from '../context';

import { Mine } from './Mine';
import { Others } from './Others';

export const Desktop: FC = () => {
  const { categoryId } = useContext(DiscoverContext);
  return (
    <Box flex="1" bg="background-default">
      {categoryId ? <Others /> : <Mine />}
    </Box>
  );
};
