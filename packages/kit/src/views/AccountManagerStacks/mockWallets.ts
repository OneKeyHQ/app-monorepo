import type { IWalletProps } from './router/types';

function generateRandomId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function generateRandomEthereumAddress() {
  return `0x${Math.random().toString(16).substr(2, 40)}`;
}

export const MockPrimaryWallets: IWalletProps[] = [
  {
    id: generateRandomId(),
    name: 'Wallet 1',
    type: 'hd',
    img: 'monkey',
    accounts: [
      {
        data: [],
      },
    ],
  },
  {
    id: generateRandomId(),
    name: 'Wallet 2',
    type: 'hd',
    img: 'panda',
    accounts: [
      {
        data: [],
      },
    ],
  },
  {
    id: generateRandomId(),
    name: 'OneKey Classic',
    type: 'hw',
    status: 'connected',
    img: 'classic',
    accounts: [
      {
        data: [],
      },
      {
        title: 'Hidden wallet 1',
        isHiddenWalletData: true,
        data: [],
      },
    ],
  },
  {
    id: generateRandomId(),
    name: 'OneKey Mini',
    type: 'hw',
    img: 'mini',
    accounts: [
      {
        data: [],
      },
    ],
  },
  {
    id: generateRandomId(),
    name: 'OneKey Touch',
    type: 'hw',
    img: 'touch',
    accounts: [
      {
        data: [],
      },
    ],
  },
];

export const MockOthersWallet: IWalletProps = {
  id: generateRandomId(),
  name: 'Others',
  type: 'others',
  img: 'cardDividers',
  accounts: [
    {
      data: [],
      emptyText:
        'No external wallets connected. Link a third-party wallet to view here.',
    },
  ],
};
