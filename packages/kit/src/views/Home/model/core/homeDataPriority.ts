export const HOME_DATA_PRIORITY_CACHE = 0;
export const HOME_DATA_PRIORITY_NETWORK = 1;

export type IHomeDataPriority =
  | typeof HOME_DATA_PRIORITY_CACHE
  | typeof HOME_DATA_PRIORITY_NETWORK;

export function isHomeDataPriority(value: unknown): value is IHomeDataPriority {
  return (
    value === HOME_DATA_PRIORITY_CACHE || value === HOME_DATA_PRIORITY_NETWORK
  );
}
