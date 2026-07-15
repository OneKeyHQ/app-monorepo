import { isEqual } from 'lodash';

export async function publishLatestOrderBookOptions<T>(params: {
  read: () => Promise<T | undefined>;
  write: (value: T) => Promise<void>;
  next: T;
  isLatest: () => boolean;
}): Promise<boolean> {
  const previous = await params.read();
  if (!params.isLatest()) {
    return false;
  }

  if (!isEqual(previous, params.next)) {
    await params.write(params.next);
  }

  return params.isLatest();
}
