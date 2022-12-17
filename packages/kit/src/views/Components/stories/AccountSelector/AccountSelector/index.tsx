/* eslint-disable @typescript-eslint/ban-types */
import type { FC } from 'react';

import { Box, Modal } from '@onekeyhq/components';

import AccountList from './AccountList';
import ChainSelector from './ChainSelector';
import Header from './Header';

type AccountSelectorProps = {};

const defaultProps = {} as const;

const AccountSelector: FC<AccountSelectorProps> = () => (
  <Modal
    headerShown={false}
    footer={null}
    staticChildrenProps={{
      flex: 1,
      padding: 0,
    }}
    height="560px"
  >
    <Box flex={1} flexDirection="row">
      <ChainSelector />
      <Box alignSelf="stretch" flex={1}>
        <Header title="Ethereum" />
        <AccountList />
      </Box>
    </Box>
  </Modal>
);

AccountSelector.defaultProps = defaultProps;

export default AccountSelector;
