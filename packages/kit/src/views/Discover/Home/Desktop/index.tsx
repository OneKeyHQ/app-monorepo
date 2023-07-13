import type { FC } from 'react';
import { useContext } from 'react';

import { Box } from '@onekeyhq/components';

import { useShowBookmark } from '../../hooks';
import { DiscoverContext } from '../context';

import { Mine } from './Mine';
import { Others } from './Others';
import { Restricted } from './Restricted';

export const DesktopUnrestricted = () => {
  const { categoryId } = useContext(DiscoverContext);
  return (
    <Box flex="1" bg="background-default">
      {categoryId ? <Others /> : <Mine />}
    </Box>
  );
};

export const DesktopRestricted = () => (
  <Box flex="1" bg="background-default">
    <Restricted />
  </Box>
);

export const Desktop: FC = () => {
  const showBookmark = useShowBookmark();
  return !showBookmark ? <DesktopRestricted /> : <DesktopUnrestricted />;
};
