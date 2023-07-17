import { useContext } from 'react';

import { Box } from '@onekeyhq/components';

import { useShowBookmark } from '../../hooks';
import { DiscoverContext } from '../context';

import { Mine } from './Mine';
import { Others } from './Others';
import { Restricted } from './Restricted';

export const Unrestricted = () => {
  const { categoryId } = useContext(DiscoverContext);
  return (
    <Box flex="1" bg="background-default">
      {categoryId ? <Others /> : <Mine />}
    </Box>
  );
};

export const Mobile = () => {
  const showBookmark = useShowBookmark();
  return !showBookmark ? <Restricted /> : <Unrestricted />;
};
