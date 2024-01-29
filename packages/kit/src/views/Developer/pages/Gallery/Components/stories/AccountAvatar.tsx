import { YStack } from '@onekeyhq/components';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
import type { IDBAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';

import { Layout } from './utils/Layout';

const account: IDBAccount = {
  type: undefined,
  path: '',
  coinType: '',
  impl: '',
  networks: [],
  template: '',
  id: '111111111',
  address: '2222222',
  name: '1',
  pub: '',
  addresses: { 'aaaa': '1' },
};

const ToastGallery = () => (
  <Layout
    description=""
    suggestions={['']}
    boundaryConditions={['']}
    elements={[
      {
        title: 'Default',
        element: (
          <YStack space="$4" justifyContent="center">
            <AccountAvatar />
            <AccountAvatar address="0x1111111" />
            <AccountAvatar account={account} />
            <AccountAvatar size="small" />
            <AccountAvatar size="small" account={account} />
            <AccountAvatar networkId="tbtc--0" />
            <AccountAvatar account={account} networkId="tbtc--0" />
            <AccountAvatar size="small" networkId="tbtc--0" />
            <AccountAvatar size="small" account={account} networkId="tbtc--0" />
          </YStack>
        ),
      },
    ]}
  />
);

export default ToastGallery;
