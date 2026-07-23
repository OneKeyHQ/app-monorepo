export type IDisplaySnapshotStorageConfig = {
  namespace: string;
  maxRecordBytes: number;
  maxReadBatchSize: number;
};

export type IDisplaySnapshotWriteEntry = {
  key: string;
  value: string;
};

export type IDisplaySnapshotCommitMarkerExpectation = {
  key: string;
  value: string | undefined;
};

export type IDisplaySnapshotCommit = {
  entries: readonly IDisplaySnapshotWriteEntry[];
  commitMarker: IDisplaySnapshotWriteEntry;
  expectedCommitMarker?: IDisplaySnapshotCommitMarkerExpectation;
  removeKeys?: readonly string[];
};

export interface IDisplaySnapshotStorage {
  read(key: string): Promise<string | undefined>;
  readMany(keys: readonly string[]): Promise<ReadonlyMap<string, string>>;
  commit(input: IDisplaySnapshotCommit): Promise<void>;
  remove(keys: readonly string[]): Promise<void>;
  clearNamespace(): Promise<void>;
  compact(): Promise<void>;
}

export interface IDisplaySnapshotStorageBackend {
  read(key: string): Promise<string | undefined>;
  readMany(keys: readonly string[]): Promise<ReadonlyMap<string, string>>;
  commit(input: IDisplaySnapshotCommit): Promise<void>;
  remove(keys: readonly string[]): Promise<void>;
  clearNamespace(): Promise<void>;
  compact(): Promise<void>;
}
