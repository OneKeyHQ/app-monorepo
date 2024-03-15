import { YStack } from '@onekeyhq/components';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';

import { Layout } from './utils/Layout';

const img = require('@onekeyhq/shared/src/assets/wallet/avatar/Pig.png');

const wallet: IDBWallet = {
  'id': 'hd-2',
  'name': 'wallet 124',
  'avatar': img,
  'type': 'hd',
  'backuped': false,
  'nextAccountIds': {},
  'accounts': [],
  'nextIndex': 54,
  'walletNo': 0,
  'avatarInfo': {
    'img': 'pig',
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
          <YStack space="$2">
            <WalletAvatar size="$20" wallet={wallet} />
            <WalletAvatar img="panda" wallet={undefined} />
            <WalletAvatar img="panda" wallet={undefined} />
            <WalletAvatar wallet={wallet} />
            <WalletAvatar wallet={wallet} status="connected" />
            <WalletAvatar size="small" wallet={wallet} />
          </YStack>
        ),
      },
    ]}
  />
);

export default ToastGallery;
