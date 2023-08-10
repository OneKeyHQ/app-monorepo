export const stETHABI = [
  {
    constant: false,
    inputs: [{ name: '_referral', type: 'address' }],
    name: 'submit',
    outputs: [{ name: '', type: 'uint256' }],
    payable: true,
    stateMutability: 'payable',
    type: 'function',
  },
];

export const LIDO_NFT_ABI = [
  {
    inputs: [
      {
        internalType: 'address',
        name: '_owner',
        type: 'address',
      },
    ],
    name: 'getWithdrawalRequests',
    outputs: [
      {
        internalType: 'uint256[]',
        name: 'requestsIds',
        type: 'uint256[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256[]',
        name: '_requestIds',
        type: 'uint256[]',
      },
    ],
    name: 'getWithdrawalStatus',
    outputs: [
      {
        components: [
          {
            internalType: 'uint256',
            name: 'amountOfStETH',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'amountOfShares',
            type: 'uint256',
          },
          {
            internalType: 'address',
            name: 'owner',
            type: 'address',
          },
          {
            internalType: 'uint256',
            name: 'timestamp',
            type: 'uint256',
          },
          {
            internalType: 'bool',
            name: 'isFinalized',
            type: 'bool',
          },
          {
            internalType: 'bool',
            name: 'isClaimed',
            type: 'bool',
          },
        ],
        internalType: 'struct WithdrawalQueueBase.WithdrawalRequestStatus[]',
        name: 'statuses',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    'inputs': [
      {
        'internalType': 'uint256[]',
        'name': '_amounts',
        'type': 'uint256[]',
      },
      {
        'internalType': 'address',
        'name': '_owner',
        'type': 'address',
      },
      {
        'components': [
          {
            'internalType': 'uint256',
            'name': 'value',
            'type': 'uint256',
          },
          {
            'internalType': 'uint256',
            'name': 'deadline',
            'type': 'uint256',
          },
          {
            'internalType': 'uint8',
            'name': 'v',
            'type': 'uint8',
          },
          {
            'internalType': 'bytes32',
            'name': 'r',
            'type': 'bytes32',
          },
          {
            'internalType': 'bytes32',
            'name': 's',
            'type': 'bytes32',
          },
        ],
        'internalType': 'struct WithdrawalQueue.PermitInput',
        'name': '_permit',
        'type': 'tuple',
      },
    ],
    'name': 'requestWithdrawalsWithPermit',
    'outputs': [
      {
        'internalType': 'uint256[]',
        'name': 'requestIds',
        'type': 'uint256[]',
      },
    ],
    'stateMutability': 'nonpayable',
    'type': 'function',
  },
  {
    'inputs': [],
    'name': 'getLastCheckpointIndex',
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
        'internalType': 'uint256[]',
        'name': '_requestIds',
        'type': 'uint256[]',
      },
      {
        'internalType': 'uint256',
        'name': '_firstIndex',
        'type': 'uint256',
      },
      {
        'internalType': 'uint256',
        'name': '_lastIndex',
        'type': 'uint256',
      },
    ],
    'name': 'findCheckpointHints',
    'outputs': [
      {
        'internalType': 'uint256[]',
        'name': 'hintIds',
        'type': 'uint256[]',
      },
    ],
    'stateMutability': 'view',
    'type': 'function',
  },
  {
    'inputs': [
      {
        'internalType': 'uint256[]',
        'name': '_requestIds',
        'type': 'uint256[]',
      },
      {
        'internalType': 'uint256[]',
        'name': '_hints',
        'type': 'uint256[]',
      },
    ],
    'name': 'claimWithdrawals',
    'outputs': [],
    'stateMutability': 'nonpayable',
    'type': 'function',
  },
];
