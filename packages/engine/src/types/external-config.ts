export type StorageLike = {
  readonly set: (key: string, value: any) => Promise<boolean>;
  readonly get: (keys: string[]) => Promise<any[]>;
  readonly delete: (keys: string[]) => Promise<number>;
};

export type ExternalConfig = {
  readonly storage: StorageLike;
};
