export interface IZipWriterOptions {
  password: string;
  encryptionStrength: 3;
  zipCrypto: false;
  useWebWorkers: false;
  useCompressionStream: false;
  dataDescriptor: false;
  level: number;
}

export interface IZipWriter {
  add(filename: string, reader: IUint8ArrayReader): Promise<void>;
  close(): Promise<Uint8Array>;
}

export interface IZipReaderEntry {
  directory?: boolean;
  encrypted?: boolean;
  filename: string;
  getData(
    writer: IUint8ArrayWriter,
    options: { password?: string },
  ): Promise<Uint8Array>;
}

export interface IZipReader {
  getEntries(): Promise<IZipReaderEntry[]>;
  close(): Promise<void>;
}

export interface IUint8ArrayReader {
  readonly data: Uint8Array;
}

export interface IUint8ArrayWriter {
  readonly data: Uint8Array;
}

export interface IZipJsNativeModule {
  ZipWriter: new (
    writer: IUint8ArrayWriter,
    options: IZipWriterOptions,
  ) => IZipWriter;
  ZipReader: new (
    reader: IUint8ArrayReader,
    options: { useWebWorkers: false; useCompressionStream: false },
  ) => IZipReader;
  Uint8ArrayReader: new (data: Uint8Array) => IUint8ArrayReader;
  Uint8ArrayWriter: new () => IUint8ArrayWriter;
}
