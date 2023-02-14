import { trim } from 'lodash';

import { openUrlExternal } from '../../utils/openUrl';

import { BulkSenderTypeEnum, ReceiverExampleType } from './types';

import type { TokenReceiver } from './types';

const RECEIVER_EXAMPLE_URL_EXCEL =
  'https://onekey-devops.s3.ap-southeast-1.amazonaws.com/send_ERC20.xlsx';
const RECEIVER_EXAMPLE_URL_CSV =
  'https://onekey-devops.s3.ap-southeast-1.amazonaws.com/send_ERC20.csv';
const RECEIVER_EXAMPLE_URL_TXT =
  'https://onekey-devops.s3.ap-southeast-1.amazonaws.com/send_ERC20.txt';

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

export function encodeReceiverWithLineNumber(receiverString: string): string {
  const lines = receiverString.split('\n');
  const linesWithNumber = lines.map(
    (line, index) => `${index + 1}${new Array(line.length + 3).join(' ')}`,
  );
  return linesWithNumber.join('\n');
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
        Address: trim(receiverData[0]),
        Amount: trim(receiverData[1]),
      } as T);
    }
  }

  return receiver;
}

export function downloadReceiverExample(type: ReceiverExampleType) {
  let url = '';
  switch (type) {
    case ReceiverExampleType.CSV:
      url = RECEIVER_EXAMPLE_URL_CSV;
      break;
    case ReceiverExampleType.TXT:
      url = RECEIVER_EXAMPLE_URL_TXT;
      break;
    case ReceiverExampleType.Excel:
      url = RECEIVER_EXAMPLE_URL_EXCEL;
      break;
    default:
      url = RECEIVER_EXAMPLE_URL_TXT;
  }
  openUrlExternal(url);
}
