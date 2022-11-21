import { FC, useContext } from 'react';

import { Box } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { DiscoverContext } from '../context';

import { Beta } from './Beta';
import { Mine } from './Mine';
import { Others } from './Others';

export const MobileAndroid = () => {
  const { categoryId } = useContext(DiscoverContext);
  return (
    <Box flex="1" bg="background-default">
      {categoryId ? <Others /> : <Mine />}
    </Box>
  );
};

export const MobileiOS = () => (
  <Box flex="1" bg="background-default">
    <Beta />
  </Box>
);

export const Mobile: FC = () =>
  platformEnv.isNativeIOS ? <MobileiOS /> : <MobileAndroid />;
