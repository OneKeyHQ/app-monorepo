import { BulkSenderTypeEnum } from './types';

import type { TokenReceiver } from './types';

export function encodeReceiver(receiver: TokenReceiver[]): string {
  const count = receiver.length;
  return receiver.reduce(
    (acc, cur, index) =>
      `${acc}${[cur.Address, cur.Amount].join(',')}${
        index === count - 1 ? '' : '\n'
      }`,
    '',
  );
}

export function decodeReceiver<T>(
  receiverString: string,
  type: BulkSenderTypeEnum,
): T[] {
  const receiver: T[] = [];

  if (receiverString === '') return [];

  const lines = receiverString.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const receiverData = line.split(',');
    if (type === BulkSenderTypeEnum.Token || BulkSenderTypeEnum.NativeToken) {
      receiver.push({
        Address: receiverData[0],
        Amount: receiverData[1],
      } as T);
    }
  }

  return receiver;
}
