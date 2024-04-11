/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable react/no-unstable-nested-components */
import { useState } from 'react';

import { Button, YStack } from '@onekeyhq/components';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import { Layout } from './utils/Layout';

const account: INetworkAccount = {
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
  connectedAddresses: {},
  selectedAddress: {},
  addressDetail: {
    networkId: 'tbtc--0',
    address: '0x1111111',
    baseAddress: '0x1111111',
    normalizedAddress: '0x1111111',
    displayAddress: '0x1111111',
    isValid: true,
    allowEmptyAddress: false,
  },
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
            <AccountAvatar src="https://cdn.bitkeep.vip/web/v10037/img/down/logo.png" />
            <AccountAvatar src="https://avatars2.githubusercontent.com/u/48327834?s=200&v=4" />
            <AccountAvatar address="0x1111111" />
            <AccountAvatar account={account} />
            <AccountAvatar size="small" />
            <AccountAvatar size="small" account={account} />
            <AccountAvatar networkId="tbtc--0" />
            <AccountAvatar account={account} networkId="tbtc--0" />
            <AccountAvatar size="small" networkId="tbtc--0" />
            <AccountAvatar size="small" account={account} networkId="tbtc--0" />
            {/* always loading */}
            <AccountAvatar
              size="small"
              src="https://onekey-asset.com/assets/btc/btc.pn"
            />
            <AccountAvatar
              size="small"
              src="https://onekey-asset.com/assets/btc/btc.png"
            />
            <AccountAvatar src="https://onekey-asset.com/assets/btc/btc.png" />
          </YStack>
        ),
      },
      {
        title: 'Switch Image URI',
        element: () => {
          const [uri, setUri] = useState('');
          return (
            <YStack space="$4">
              <AccountAvatar src={uri} />
              <YStack space="$4">
                <Button
                  onPress={() => {
                    setUri('https://onekey-asset.com/assets/btc/btc.pn');
                  }}
                >
                  Change to invalid URI
                </Button>
                <Button
                  onPress={() => {
                    setUri('https://onekey-asset.com/assets/btc/btc.png');
                  }}
                >
                  Change to valid URI
                </Button>
                <Button
                  onPress={() => {
                    setUri('');
                  }}
                >
                  Change to empty URI
                </Button>
              </YStack>
            </YStack>
          );
        },
      },
    ]}
  />
);

export default ToastGallery;
