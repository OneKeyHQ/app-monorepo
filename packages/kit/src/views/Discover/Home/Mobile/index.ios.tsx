import { useContext } from 'react';

import { Box } from '@onekeyhq/components';

import { useShowBookmark } from '../../hooks';
import { DiscoverContext } from '../context';

import { Beta } from './Beta';
import { Mine } from './Mine';
import { Others } from './Others';

export const MobileFull = () => {
  const { categoryId } = useContext(DiscoverContext);
  return (
    <Box flex="1" bg="background-default">
      {categoryId ? <Others /> : <Mine />}
    </Box>
  );
};

export const Mobile = () => {
  const showBookmark = useShowBookmark();
  return !showBookmark ? <Beta /> : <MobileFull />;
};
