import { FC, useContext } from 'react';

import { Box } from '@onekeyhq/components';

import { DiscoverContext } from '../context';

import { Mine } from './Mine';
import { Others } from './Others';

export const Mobile: FC = () => {
  const { categoryId } = useContext(DiscoverContext);
  return (
    <Box flex="1" bg="background-default" pt="4">
      {categoryId ? <Others /> : <Mine />}
    </Box>
  );
};
