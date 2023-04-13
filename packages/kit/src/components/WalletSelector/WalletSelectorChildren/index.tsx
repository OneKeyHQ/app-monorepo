import { memo } from 'react';

import { useIntl } from 'react-intl';

import { Box } from '@onekeyhq/components';

import Header from './Header';
import List from './List';

function WalletSelectorChildren() {
  const intl = useIntl();

  return (
    <Box
      bgColor="background-default"
      alignSelf="stretch"
      borderRadius="xl"
      flex={1}
    >
      <Header title={intl.formatMessage({ id: 'title__wallets' })} />
      <List />
    </Box>
  );
}

export default memo(WalletSelectorChildren);
