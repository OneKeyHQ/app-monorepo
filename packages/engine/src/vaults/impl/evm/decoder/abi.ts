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

const ERC721 = [
  'function supportsInterface(bytes4) public view returns(bool)',
  'function safeTransferFrom(address from, address to, uint256 tokenId)',
];

const ERC1155 = [
  'function supportsInterface(bytes4) public view returns(bool)',
  'function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)',
];

export enum Erc721MethodSelectors {
  safeTransferFrom = '0x42842e0e', // keccak256(Buffer.from('safeTransferFrom(address,address,uint256)')) => 0x42842e0eb38857a7775b4e7364b2775df7325074d088e7fb39590cd6281184ed
}

export enum Erc1155MethodSelectors {
  safeTransferFrom = '0xf242432a', // keccak256(Buffer.from('safeTransferFrom(address,address,uint256,uint256,bytes)')) => 0xf242432a01954b0e0efb67e72c9b3b8ed77690657780385b256ac9aba0e35f0b
}

const ABI = {
  ERC20,
  ERC721,
  ERC1155,
};

export { ABI };
