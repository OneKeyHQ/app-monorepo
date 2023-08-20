/**
 * @type Transaction
 *
 * Transaction representation
 * @property chainId - Network ID as per EIP-155
 * @property data - Data to pass with this transaction
 * @property from - Address to send this transaction from
 * @property gas - Gas to send with this transaction
 * @property gasPrice - Price of gas with this transaction
 * @property gasUsed -  Gas used in the transaction
 * @property nonce - Unique number to prevent replay attacks
 * @property to - Address to send this transaction to
 * @property value - Value associated with this transaction
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface Transaction {
  chainId?: number;
  data?: string;
  from: string;
  gas?: string;
  gasPrice?: string;
  gasUsed?: string;
  nonce?: string;
  to?: string;
  value?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  estimatedBaseFee?: string;
}

export type WatchAssetParameters = {
  type: string; // The asset's interface, e.g. 'ERC20'
  options: {
    address: string; // The hexadecimal Ethereum address of the token contract
    symbol?: string; // A ticker symbol or shorthand, up to 5 alphanumerical characters
    decimals?: number; // The number of asset decimals
    image?: string; // A string url of the token logo
    sendAddress?: string;
  };
};

export type AddEthereumChainParameter = {
  chainId: string;
  blockExplorerUrls?: string[];
  chainName?: string;
  iconUrls?: string[];
  nativeCurrency?: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls?: string[];
};

export type SwitchEthereumChainParameter = {
  chainId: string;
  networkId?: string;
};
