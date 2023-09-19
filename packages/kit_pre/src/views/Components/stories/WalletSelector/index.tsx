/* eslint-disable react/no-unstable-nested-components */
import { useIntl } from 'react-intl';

import { Box, Center } from '@onekeyhq/components';

import Header from './Header';
import List from './List';

const WalletSelectorGallery = () => {
  const intl = useIntl();

  const WalletSelectorChild = () => (
    <Box bgColor="background-default" alignSelf="stretch" flex={1}>
      <Header title={intl.formatMessage({ id: 'title__wallets' })} />
      <List />
    </Box>
  );

  return (
    <Center flex="1" bg="backdrop">
      <Box w="306px" h="600px">
        <WalletSelectorChild />
      </Box>
    </Center>
  );
};

export default WalletSelectorGallery;
