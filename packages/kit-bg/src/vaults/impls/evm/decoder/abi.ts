export enum EErc20MethodSelectors {
  tokenTransfer = '0xa9059cbb',
  tokenApprove = '0x095ea7b3',
}

export enum EErc721MethodSelectors {
  safeTransferFrom = '0x42842e0e',
  setApprovalForAll = '0xa22cb465',
  Approval = '0x8c5be1e5',
}

export enum EErc1155MethodSelectors {
  safeTransferFrom = '0xf242432a',
  setApprovalForAll = '0xa22cb465',
}

export enum EWrapperTokenMethodSelectors {
  withdraw = '0x2e1a7d4d',
  deposit = '0xd0e30db0',
}

export enum EErc20TxDescriptionName {
  Transfer = 'transfer',
  TransferFrom = 'transferFrom',
  Approve = 'approve',
}

export enum EErc721TxDescriptionName {
  SafeTransferFrom = 'safeTransferFrom',
}

export enum EErc1155TxDescriptionName {
  SafeTransferFrom = 'safeTransferFrom',
}

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

const ABI = {
  ERC20,
  ERC721,
  ERC1155,
  BATCH_TRANSFER,
};

export { ABI };
