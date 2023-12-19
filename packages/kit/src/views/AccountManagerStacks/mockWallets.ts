import type { IWalletProps } from './types';

function generateRandomId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateEthereumAddress() {
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
        data: [
          {
            id: generateRandomId(),
            name: 'Account 1',
            evmAddress: generateEthereumAddress(),
          },
          {
            id: generateRandomId(),
            name: 'Account 2',
            evmAddress: generateEthereumAddress(),
          },
          {
            id: generateRandomId(),
            name: 'Account 3',
            evmAddress: generateEthereumAddress(),
          },
        ],
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
        data: [
          {
            id: generateRandomId(),
            name: 'Account 1',
            evmAddress: generateEthereumAddress(),
          },
          {
            id: generateRandomId(),
            name: 'Account 2',
            evmAddress: generateEthereumAddress(),
          },
          {
            id: generateRandomId(),
            name: 'Account 3',
            evmAddress: generateEthereumAddress(),
          },
        ],
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
        data: [
          {
            id: generateRandomId(),
            name: 'Account 1',
            evmAddress: generateEthereumAddress(),
          },
          {
            id: generateRandomId(),
            name: 'Account 2',
            evmAddress: generateEthereumAddress(),
          },
          {
            id: generateRandomId(),
            name: 'Account 3',
            evmAddress: generateEthereumAddress(),
          },
        ],
      },
      {
        title: 'Hidden wallet 1',
        isHiddenWalletData: true,
        data: [
          {
            id: generateRandomId(),
            name: 'Account 1',
            evmAddress: generateEthereumAddress(),
          },
          {
            id: generateRandomId(),
            name: 'Account 2',
            evmAddress: generateEthereumAddress(),
          },
          {
            id: generateRandomId(),
            name: 'Account 3',
            evmAddress: generateEthereumAddress(),
          },
        ],
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
        data: [
          {
            id: generateRandomId(),
            name: 'Account 1',
            evmAddress: generateEthereumAddress(),
          },
        ],
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
        data: [
          {
            id: generateRandomId(),
            name: 'Account 1',
            evmAddress: generateEthereumAddress(),
          },
        ],
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
      title: 'Private key',
      data: [
        {
          id: generateRandomId(),
          name: 'Account 1',
          address: generateEthereumAddress(),
          networkImageSrc:
            'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/btc.png',
        },
        {
          id: generateRandomId(),
          name: 'Account 2',
          address: generateEthereumAddress(),
          networkImageSrc:
            'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/eth.png',
        },
      ],
      emptyText:
        'No private key accounts. Add a new account to manage your assets.',
    },
    {
      title: 'Watchlist',
      data: [
        {
          id: generateRandomId(),
          name: 'Account 1',
          address: generateEthereumAddress(),
          networkImageSrc:
            'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/btc.png',
        },
        {
          id: generateRandomId(),
          name: 'Account 2',
          address: generateEthereumAddress(),
          networkImageSrc:
            'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/eth.png',
        },
      ],
      emptyText:
        'Your watchlist is empty. Import a address to start monitoring.',
    },
    {
      title: 'External',
      data: [],
      emptyText:
        'No external wallets connected. Link a third-party wallet to view here.',
    },
  ],
};
