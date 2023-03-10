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
}
