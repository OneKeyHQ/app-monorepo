export type ChainInfo = {
  code: string;
  feeCode: string;
  impl: string;
  curve: 'secp256k1' | 'ed25519';
  implOptions: { [key: string]: any };
  clients: Array<{ name: string; args: Array<any> }>;
};

export type CoinInfo = {
  code: string;
  chainCode: string;
  decimals: number;
  tokenAddress?: string;
  options?: { [key: string]: any };
};
