export interface IBackgroundThreadSharedStore {
  set(key: string, value: string | number | boolean): void;
  get(key: string): string | number | boolean | undefined;
  has(key: string): boolean;
  delete(key: string): boolean;
  keys(): string[];
  clear(): void;
  readonly size: number;
}

export function getBackgroundThreadSharedStore():
  | IBackgroundThreadSharedStore
  | undefined {
  return undefined;
}
