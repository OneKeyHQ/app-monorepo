import { Box } from '@onekeyhq/components';

import { useShowBookmark } from '../../hooks';

import { Main } from './Main';
import { Restricted } from './Restricted';

export const Unrestricted = () => (
  <Box flex="1" bg="background-default">
    <Main />
  </Box>
);

export const Mobile = () => {
  const showBookmark = useShowBookmark();
  return !showBookmark ? <Restricted /> : <Unrestricted />;
};
