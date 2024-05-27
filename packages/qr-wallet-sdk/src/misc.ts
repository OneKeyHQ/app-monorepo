enum EURType {
  CryptoPSBT = 'crypto-psbt',
  CryptoMultiAccounts = 'crypto-multi-accounts',
  CryptoHDKey = 'crypto-hdkey',
  CryptoAccount = 'crypto-account',
  BtcSignature = 'btc-signature',
  ArweaveCryptoAccount = 'arweave-crypto-account',
  EthSignature = 'eth-signature',
  SolSignature = 'sol-signature',
  CosmosSignature = 'cosmos-signature',
  EvmSignature = 'evm-signature',
  AptosSignature = 'aptos-signature',
  CardanoSignature = 'cardano-signature',
  TronSignature = 'keystone-sign-result',
  KeystoneSignResult = 'keystone-sign-result',
  NearSignature = 'near-signature',
  ArweaveSignature = 'arweave-signature',
  SuiSignature = 'sui-signature',
  XrpAccount = 'bytes',
  XrpSignRequest = 'bytes',
  XrpSignature = 'bytes',
  TonSignature = 'ton-signature',
}

function parsePath(path: string) {
  const chunks = path.replace(/^m\//i, '').split('/');
  return chunks.map((chunk) => {
    const hardened = chunk.endsWith("'");
    return {
      index: Number(hardened ? chunk.substring(0, chunk.length - 1) : chunk),
      hardened,
    };
  });
}
