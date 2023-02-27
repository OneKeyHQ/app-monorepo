export default interface MoneroCoreInstance
  extends Record<string, WebAssembly.ExportValue | ArrayBuffer> {
  _malloc(size: number): number;
  _free(ptr: number): void;

  HEAP8: Int8Array;
  HEAP16: Int16Array;
  HEAP32: Int32Array;
  HEAPU8: Uint8Array;
  HEAPU16: Uint16Array;
  HEAPU32: Uint32Array;

  _ImageScanner_create(): number;
  _ImageScanner_destory(scanner: number): void;
  _ImageScanner_set_config(
    scanner: number,
    symbology: number,
    config: number,
    value: number,
  ): number;
  _ImageScanner_enable_cache(scanner: number, enable: boolean): void;
  _ImageScanner_recycle_image(scanner: number, image: number): void;
  _ImageScanner_scan(ImageScanner_scannner: number, image: number): number;
  _ImageScanner_get_results(scanner: number): number;
  _Image_create(
    width: number,
    height: number,
    format: number,
    data: number,
    dataLength: number,
    sequenceNum: number,
  ): number;

  _Image_destory(image: number): void;
  _Image_get_symbols(image: number): number;
}
