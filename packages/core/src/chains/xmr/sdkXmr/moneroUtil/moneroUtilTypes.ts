export interface MoneroUtilInstance
  extends Record<string, WebAssembly.ExportValue | ArrayBuffer> {
  _malloc(size: number): number;
  ccall(
    ident: any,
    returnType: any,
    argTypes: any,
    args: any,
    opts?: any,
  ): Uint8Array;
  _free(ptr: number): void;
  HEAP8: Int8Array;
  HEAP16: Int16Array;
  HEAP32: Int32Array;
  HEAPU8: Uint8Array;
  HEAPU16: Uint16Array;
  HEAPU32: Uint32Array;
}

export enum MoneroNetTypeEnum {
  MainNet = 0,
  TestNet = 1,
  StageNet = 2,
}
