export const StMaticABI = [
  {
    'inputs': [
      {
        'internalType': 'uint256',
        'name': '_amount',
        'type': 'uint256',
      },
      {
        'internalType': 'address',
        'name': '_referral',
        'type': 'address',
      },
    ],
    'name': 'submit',
    'outputs': [
      {
        'internalType': 'uint256',
        'name': '',
        'type': 'uint256',
      },
    ],
    'stateMutability': 'nonpayable',
    'type': 'function',
  },
  {
    'inputs': [
      {
        'internalType': 'uint256',
        'name': '_amount',
        'type': 'uint256',
      },
      {
        'internalType': 'address',
        'name': '_referral',
        'type': 'address',
      },
    ],
    'name': 'requestWithdraw',
    'outputs': [
      {
        'internalType': 'uint256',
        'name': '',
        'type': 'uint256',
      },
    ],
    'stateMutability': 'nonpayable',
    'type': 'function',
  },
  {
    'constant': true,
    'inputs': [],
    'name': 'stakeManager',
    'outputs': [
      {
        'internalType': 'contract IStakeManager',
        'name': '',
        'type': 'address',
      },
    ],
    'payable': false,
    'stateMutability': 'view',
    'type': 'function',
  },
  {
    'inputs': [],
    'name': 'poLidoNFT',
    'outputs': [
      {
        'internalType': 'contract IPoLidoNFT',
        'name': '',
        'type': 'address',
      },
    ],
    'stateMutability': 'view',
    'type': 'function',
  },
  {
    'inputs': [
      {
        'internalType': 'uint256',
        'name': '_tokenId',
        'type': 'uint256',
      },
    ],
    'name': 'getMaticFromTokenId',
    'outputs': [
      {
        'internalType': 'uint256',
        'name': '',
        'type': 'uint256',
      },
    ],
    'stateMutability': 'view',
    'type': 'function',
  },
  {
    'inputs': [
      {
        'internalType': 'uint256',
        'name': '_tokenId',
        'type': 'uint256',
      },
    ],
    'name': 'getToken2WithdrawRequests',
    'outputs': [
      {
        'components': [
          {
            'internalType': 'uint256',
            'name': 'amount2WithdrawFromStMATIC',
            'type': 'uint256',
          },
          {
            'internalType': 'uint256',
            'name': 'validatorNonce',
            'type': 'uint256',
          },
          {
            'internalType': 'uint256',
            'name': 'requestTime',
            'type': 'uint256',
          },
          {
            'internalType': 'address',
            'name': 'validatorAddress',
            'type': 'address',
          },
        ],
        'internalType': 'struct IStMATIC.RequestWithdraw[]',
        'name': '',
        'type': 'tuple[]',
      },
    ],
    'stateMutability': 'view',
    'type': 'function',
  },
  {
    'inputs': [
      {
        'internalType': 'uint256',
        'name': '_amountInMatic',
        'type': 'uint256',
      },
    ],
    'name': 'convertMaticToStMatic',
    'outputs': [
      {
        'internalType': 'uint256',
        'name': 'amountInStMatic',
        'type': 'uint256',
      },
      {
        'internalType': 'uint256',
        'name': 'totalStMaticSupply',
        'type': 'uint256',
      },
      {
        'internalType': 'uint256',
        'name': 'totalPooledMatic',
        'type': 'uint256',
      },
    ],
    'stateMutability': 'view',
    'type': 'function',
  },
  {
    'inputs': [
      {
        'internalType': 'uint256',
        'name': '_amountInStMatic',
        'type': 'uint256',
      },
    ],
    'name': 'convertStMaticToMatic',
    'outputs': [
      {
        'internalType': 'uint256',
        'name': 'amountInMatic',
        'type': 'uint256',
      },
      {
        'internalType': 'uint256',
        'name': 'totalStMaticAmount',
        'type': 'uint256',
      },
      {
        'internalType': 'uint256',
        'name': 'totalPooledMatic',
        'type': 'uint256',
      },
    ],
    'stateMutability': 'view',
    'type': 'function',
  },
  {
    'inputs': [
      {
        'internalType': 'uint256',
        'name': '_tokenId',
        'type': 'uint256',
      },
    ],
    'name': 'claimTokens',
    'outputs': [],
    'stateMutability': 'nonpayable',
    'type': 'function',
  },
];

export const poLidoNFTABI = [
  {
    'inputs': [
      {
        'internalType': 'address',
        'name': '_address',
        'type': 'address',
      },
    ],
    'name': 'getOwnedTokens',
    'outputs': [
      {
        'internalType': 'uint256[]',
        'name': '',
        'type': 'uint256[]',
      },
    ],
    'stateMutability': 'view',
    'type': 'function',
  },
];

export const stakeManagerABI = [
  {
    'constant': true,
    'inputs': [],
    'name': 'epoch',
    'outputs': [
      {
        'internalType': 'uint256',
        'name': '',
        'type': 'uint256',
      },
    ],
    'payable': false,
    'stateMutability': 'view',
    'type': 'function',
  },
];
