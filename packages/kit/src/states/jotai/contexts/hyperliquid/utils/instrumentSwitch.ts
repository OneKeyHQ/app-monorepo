import { isEqual } from 'lodash';

let orderBookOptionsWriteQueue = Promise.resolve();

export function publishLatestOrderBookOptions<T>(params: {
  read: () => Promise<T | undefined>;
  write: (value: T) => Promise<void>;
  next: T;
  isLatest: () => boolean;
}): Promise<boolean> {
  const publish = orderBookOptionsWriteQueue.then(async () => {
    if (!params.isLatest()) {
      return false;
    }
    const previous = await params.read();
    if (!params.isLatest()) {
      return false;
    }

    if (!isEqual(previous, params.next)) {
      await params.write(params.next);
    }

    return params.isLatest();
  });
  orderBookOptionsWriteQueue = publish.then(
    () => undefined,
    () => undefined,
  );
  return publish;
}
