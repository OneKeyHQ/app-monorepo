/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable react/no-unstable-nested-components */
import { useState } from 'react';

import { Button, Select, YStack } from '@onekeyhq/components';
import type { IAccountAvatarProps } from '@onekeyhq/kit/src/components/AccountAvatar';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
import type { IDBExternalAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import { Layout } from './utils/Layout';

const networkAccount: INetworkAccount = {
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

const externalAccount: IDBExternalAccount = {
  id: "external--hw-da2fb056-f3c8-4b55-922e-a04a6fea29cf--m/44'/0'/0",
  name: '2222',
  address: '0x222222',
  connectionInfo: {
    evmInjected: {
      global: 'ethereum',
      name: 'string',
      icon: 'https://uni.onekey-asset.com/static/chain/btc.png',
    },
  },
} as IDBExternalAccount;

const invalidExternalAccount: IDBExternalAccount = {
  id: "external--hw-da2fb05u-f3c8-4b55-922e-a04a6fea29cf--m/44'/0'/0",
  name: '3333',
  address: '0x222222',
  connectionInfo: {
    evmInjected: {
      global: 'ethereum',
      name: 'string',
      icon: 'https://onekey-asset.com/assets/btc/btc.pn',
    },
  },
} as IDBExternalAccount;

const ToastGallery = () => (
  <Layout
    description=""
    suggestions={['']}
    boundaryConditions={['']}
    elements={[
      {
        title: 'Default',
        element: (
          <YStack gap="$4" justifyContent="center">
            <AccountAvatar />
            <AccountAvatar src="https://cdn.bitkeep.vip/web/v10037/img/down/logo.png" />
            <AccountAvatar src="https://avatars2.githubusercontent.com/u/48327834?s=200&v=4" />
            <AccountAvatar address="0x1111111" />
            <AccountAvatar account={networkAccount} />
            <AccountAvatar size="small" />
            <AccountAvatar size="small" account={networkAccount} />
            <AccountAvatar networkId="tbtc--0" />
            <AccountAvatar account={networkAccount} networkId="tbtc--0" />
            <AccountAvatar size="small" networkId="tbtc--0" />
            <AccountAvatar
              size="small"
              account={networkAccount}
              networkId="tbtc--0"
            />
            {/* always loading */}
            <AccountAvatar
              size="small"
              src="https://onekey-asset.com/assets/btc/btc.pn"
            />
            <AccountAvatar
              size="small"
              src="https://uni.onekey-asset.com/static/chain/btc.png"
            />
            <AccountAvatar src="https://uni.onekey-asset.com/static/chain/btc.png" />
          </YStack>
        ),
      },
      {
        title: 'Switch Image URI',
        element: () => {
          const [uri, setUri] = useState('');
          return (
            <YStack gap="$4">
              <AccountAvatar src={uri} />
              <YStack gap="$4">
                <Button
                  onPress={() => {
                    setUri('https://onekey-asset.com/assets/btc/btc.pn');
                  }}
                >
                  Change to invalid URI
                </Button>
                <Button
                  onPress={() => {
                    setUri('https://uni.onekey-asset.com/static/chain/btc.png');
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
      {
        title: 'Switch Account',
        element: () => {
          const [size, setSize] =
            useState<IAccountAvatarProps['size']>('default');
          const [account, setAccount] = useState<
            INetworkAccount | IDBExternalAccount | undefined
          >(undefined);
          return (
            <YStack gap="$4">
              <AccountAvatar dbAccount={account} size={size} />
              <YStack gap="$4">
                <Select
                  items={[
                    {
                      value: 'default',
                      label: 'default',
                    },
                    {
                      value: 'small',
                      label: 'small',
                    },
                  ]}
                  value={size as unknown as any}
                  onChange={setSize as any}
                  title="Demo Title"
                  onOpenChange={console.log}
                />
                <Button
                  onPress={() => {
                    setAccount(networkAccount);
                  }}
                >
                  Change to db Network Account
                </Button>
                <Button
                  onPress={() => {
                    setAccount(externalAccount);
                  }}
                >
                  Change to External account
                </Button>
                <Button
                  onPress={() => {
                    setAccount(invalidExternalAccount);
                  }}
                >
                  Change to invalid External account
                </Button>
                <Button
                  onPress={() => {
                    setAccount(undefined);
                  }}
                >
                  Change to empty account
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
