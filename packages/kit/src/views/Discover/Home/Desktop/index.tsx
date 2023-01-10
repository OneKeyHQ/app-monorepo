import type { FC } from 'react';
import { useContext } from 'react';

import { Box } from '@onekeyhq/components';

import { useShowBookmark } from '../../hooks';
import { DiscoverContext } from '../context';

import { Beta } from './Beta';
import { Mine } from './Mine';
import { Others } from './Others';

export const DesktopFull = () => {
  const { categoryId } = useContext(DiscoverContext);
  return (
    <Box flex="1" bg="background-default">
      {categoryId ? <Others /> : <Mine />}
    </Box>
  );
};

export const DesktopMini = () => (
  <Box flex="1" bg="background-default">
    <Beta />
  </Box>
);

export const Desktop: FC = () => {
  const showBookmark = useShowBookmark();
  return !showBookmark ? <DesktopMini /> : <DesktopFull />;
};
