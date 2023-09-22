export interface MoneroCoreInstance
  extends Record<string, WebAssembly.ExportValue | ArrayBuffer> {
  generate_key_image: (
    txPublicKey: string,
    privateViewKey: string,
    privateSpendKey: string,
    publicSpendKey: string,
    outputIndex: string,
  ) => string;

  decode_address: (address: string, netType: string) => string;

  estimated_tx_network_fee: (
    priority: string,
    feePerByte: string,
    forkVersion?: string,
  ) => string;

  send_funds: (...args: any[]) => void;

  seed_and_keys_from_mnemonic: (mnemonic: string, netType: string) => string;
}
