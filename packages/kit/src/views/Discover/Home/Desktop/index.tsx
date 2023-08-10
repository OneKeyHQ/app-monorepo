import type { FC } from 'react';

import { Box } from '@onekeyhq/components';

import { useShowBookmark } from '../../hooks/useControl';

import { Main } from './Main';
import { Restricted } from './Restricted';

export const DesktopUnrestricted = () => (
  <Box flex="1" bg="background-default">
    <Main />
  </Box>
);

export const DesktopRestricted = () => (
  <Box flex="1" bg="background-default">
    <Restricted />
  </Box>
);

export const Desktop: FC = () => {
  const showBookmark = useShowBookmark();
  return !showBookmark ? <DesktopRestricted /> : <DesktopUnrestricted />;
};
