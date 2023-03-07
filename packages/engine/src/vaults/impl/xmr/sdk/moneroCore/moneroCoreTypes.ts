export interface MoneroCoreInstance
  extends Record<string, WebAssembly.ExportValue | ArrayBuffer> {
  generate_key_image: (
    txPublicKey: string,
    privateViewKey: string,
    privateSpendKey: string,
    publicSpendKey: string,
    outputIndex: number,
  ) => { retVal: string };
}
