const ERC20 = [
  'function name() public view returns (string)',
  'function symbol() public view returns (string)',
  'function decimals() public view returns (uint8)',
  'function totalSupply() public view returns (uint256)',
  'function balanceOf(address _owner) public view returns (uint256 balance)',
  'function transfer(address _to, uint256 _value) public returns (bool success)',
  'function transferFrom(address _from, address _to, uint256 _value) public returns (bool success)',
  'function approve(address _spender, uint256 _value) public returns (bool success)',
  'function allowance(address _owner, address _spender) public view returns (uint256 remaining)',
  'event Transfer(address indexed _from, address indexed _to, uint256 _value)',
  'event Approval(address indexed _owner, address indexed _spender, uint256 _value)',
] as const;

export enum Erc20MethodSelectors {
  tokenTransfer = '0xa9059cbb',
  tokenApprove = '0x095ea7b3',
}

export enum WrapperTokenMethodSelectors {
  withdraw = '0x2e1a7d4d',
  doposit = '0xd0e30db0',
}

const ERC721 = [
  'function supportsInterface(bytes4) public view returns(bool)',
  'function safeTransferFrom(address from, address to, uint256 tokenId)',
];

const ERC1155 = [
  'function supportsInterface(bytes4) public view returns(bool)',
  'function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)',
];

const BATCH_TRANSFER = [
  'function disperseEther(address[] recipients, uint256[] values)',
  'function disperseToken(address token, address[] recipients, uint256[] values)',
  'function disperseTokenSimple(address token, address[] recipients, uint256[] values)',
  'function disperseNFT(address recipient, address[] tokens, uint256[] tokenIds, uint256[] amounts)',
];

export enum Erc721MethodSelectors {
  safeTransferFrom = '0x42842e0e', // keccak256(Buffer.from('safeTransferFrom(address,address,uint256)')) => 0x42842e0eb38857a7775b4e7364b2775df7325074d088e7fb39590cd6281184ed
  setApprovalForAll = '0xa22cb465', // keccak256(Buffer.from('setApprovalForAll(address,bool)')).toString('hex') => 0xa22cb4651ab9570f89bb516380c40ce76762284fb1f21337ceaf6adab99e7d4a
  Approval = '0x8c5be1e5', // keccak256(Buffer.from('Approval(address,address,uint256)')).toString('hex') => 0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925
}

export enum Erc1155MethodSelectors {
  safeTransferFrom = '0xf242432a', // keccak256(Buffer.from('safeTransferFrom(address,address,uint256,uint256,bytes)')) => 0xf242432a01954b0e0efb67e72c9b3b8ed77690657780385b256ac9aba0e35f0b
  setApprovalForAll = '0xa22cb465', // keccak256(Buffer.from('setApprovalForAll(address,bool)')).toString('hex') => 0xa22cb4651ab9570f89bb516380c40ce76762284fb1f21337ceaf6adab99e7d4a
}

const ABI = {
  ERC20,
  ERC721,
  ERC1155,
  BATCH_TRANSFER,
};

export const OPENSEA_REGISTRY_ABI = [
  {
    constant: true,
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'initialAddressSet',
    outputs: [{ name: '', type: 'bool' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: false,
    inputs: [{ name: 'addr', type: 'address' }],
    name: 'endGrantAuthentication',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: false,
    inputs: [{ name: 'addr', type: 'address' }],
    name: 'revokeAuthentication',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: true,
    inputs: [{ name: '', type: 'address' }],
    name: 'pending',
    outputs: [{ name: '', type: 'uint256' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: true,
    inputs: [{ name: '', type: 'address' }],
    name: 'contracts',
    outputs: [{ name: '', type: 'bool' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: false,
    inputs: [],
    name: 'renounceOwnership',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', type: 'address' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'delegateProxyImplementation',
    outputs: [{ name: '', type: 'address' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: true,
    inputs: [{ name: '', type: 'address' }],
    name: 'proxies',
    outputs: [{ name: '', type: 'address' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: false,
    inputs: [{ name: 'addr', type: 'address' }],
    name: 'startGrantAuthentication',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: false,
    inputs: [],
    name: 'registerProxy',
    outputs: [{ name: 'proxy', type: 'address' }],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'DELAY_PERIOD',
    outputs: [{ name: '', type: 'uint256' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: false,
    inputs: [{ name: 'authAddress', type: 'address' }],
    name: 'grantInitialAuthentication',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: false,
    inputs: [{ name: 'newOwner', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    anonymous: false,
    inputs: [{ indexed: true, name: 'previousOwner', type: 'address' }],
    name: 'OwnershipRenounced',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'previousOwner', type: 'address' },
      { indexed: true, name: 'newOwner', type: 'address' },
    ],
    name: 'OwnershipTransferred',
    type: 'event',
  },
];

export { ABI };
