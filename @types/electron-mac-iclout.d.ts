/* eslint-disable @typescript-eslint/naming-convention */
// TODO move to npm
declare module '@onekeyfe/electron-mac-icloud' {
  type TypeMap = {
    string: string;
    double: number;
    boolean: boolean;
    array: unknown[];
    dictionary: Record<string, unknown>;
  };

  export function getAllValues(): Record<string, TypeMap[keyof TypeMap]>;

  export function getValue<T extends keyof TypeMap>(
    type: T,
    key: string,
  ): TypeMap[T];

  export function setValue<T extends keyof TypeMap>(
    type: T,
    key: string,
    value: TypeMap[T],
  );

  export function removeValue(key: string): void;

  export function getDocumentDirectoryPath(): string;

  export function getiCloudDirectoryPath(): string;

  // Keychain APIs
  export function keychainSetItem(params: {
    key: string;
    value: string;
    enableSync?: boolean;
    label?: string;
    description?: string;
  }): Promise<void>;

  export function keychainGetItem(params: {
    key: string;
  }): Promise<{ key: string; value: string } | null>;

  export function keychainRemoveItem(params: { key: string }): Promise<void>;

  export function keychainHasItem(params: { key: string }): Promise<boolean>;

  export function keychainIsICloudSyncEnabled(): Promise<boolean>;

  // CloudKit types
  export type CloudKitSaveRecordParams = {
    recordType: string;
    recordID: string;
    data: string;
  };
  export type CloudKitFetchRecordParams = {
    recordType: string;
    recordID: string;
  };
  export type CloudKitDeleteRecordParams = {
    recordType: string;
    recordID: string;
  };
  export type CloudKitRecordExistsParams = {
    recordType: string;
    recordID: string;
  };
  export type CloudKitQueryRecordsParams = { recordType: string };

  export type CloudKitSaveRecordResult = {
    recordID: string;
    createdAt: number;
  };
  export type CloudKitRecordResult = {
    recordID: string;
    recordType: string;
    data: string;
    createdAt: number;
    modifiedAt: number;
  };
  export type CloudKitQueryRecordsResult = { records: CloudKitRecordResult[] };

  // CloudKit APIs
  export function cloudkitIsAvailable(): Promise<boolean>;
  export function cloudkitSaveRecord(
    params: CloudKitSaveRecordParams,
  ): Promise<CloudKitSaveRecordResult>;
  export function cloudkitFetchRecord(
    params: CloudKitFetchRecordParams,
  ): Promise<CloudKitRecordResult | null>;
  export function cloudkitDeleteRecord(
    params: CloudKitDeleteRecordParams,
  ): Promise<void>;
  export function cloudkitRecordExists(
    params: CloudKitRecordExistsParams,
  ): Promise<boolean>;
  export function cloudkitQueryRecords(
    params: CloudKitQueryRecordsParams,
  ): Promise<CloudKitQueryRecordsResult>;
}
