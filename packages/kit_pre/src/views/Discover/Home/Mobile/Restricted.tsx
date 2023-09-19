import { useLayoutEffect } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ListHeader } from './ListHeader';

export const Restricted = () => {
  const intl = useIntl();
  const navigation = useNavigation();

  useLayoutEffect(() => {
    if (platformEnv.isNative) {
      navigation.setOptions({
        title: intl.formatMessage({
          id: 'title__explore',
        }),
      });
    }
  }, [navigation, intl]);

  return (
    <Box flex="1" background="background-default">
      <ListHeader />
    </Box>
  );
};
