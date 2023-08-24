import { trim } from 'lodash';

import { openUrlExternal } from '../../utils/openUrl';

import { TraderExampleType } from './types';

import type { TokenTrader } from './types';

const RECEIVER_EXAMPLE_URL_EXCEL =
  'https://onekey-devops.s3.ap-southeast-1.amazonaws.com/send_ERC20.xlsx';
const RECEIVER_EXAMPLE_URL_CSV =
  'https://onekey-devops.s3.ap-southeast-1.amazonaws.com/send_ERC20.csv';
const RECEIVER_EXAMPLE_URL_TXT =
  'https://onekey-devops.s3.ap-southeast-1.amazonaws.com/send_ERC20.txt';

export function encodeTrader({
  trader,
  withAmount,
}: {
  trader: TokenTrader[];
  withAmount: boolean;
}): string {
  const count = trader.length;
  if (withAmount) {
    return trader.reduce(
      (acc, cur, index) =>
        `${acc}${[cur.address, cur.amount].join(',')}${
          index === count - 1 ? '' : '\n'
        }`,
      '',
    );
  }

  return trader.reduce(
    (acc, cur, index) =>
      `${acc}${cur.address}${index === count - 1 ? '' : '\n'}`,
    '',
  );
}

export function encodeTraderWithLineNumber(traderString: string): string {
  const lines = traderString.split('\n');
  const linesWithNumber = lines.map(
    (line, index) => `${index + 1}${new Array(line.length + 3).join(' ')}`,
  );
  return linesWithNumber.join('\n');
}

export function decodeTrader<T>({
  traderString,
  withAmount,
}: {
  traderString: string;
  withAmount: boolean;
}): T[] {
  const trader: T[] = [];

  if (traderString === '') return [];

  const lines = traderString.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (withAmount) {
      const traderData = line.split(',');
      trader.push({
        address: trim(traderData[0]),
        amount: trim(traderData[1]),
      } as T);
    } else {
      trader.push({
        address: trim(line),
      } as T);
    }
  }

  return trader;
}

export function downloadTraderExample(type: TraderExampleType) {
  let url = '';
  switch (type) {
    case TraderExampleType.CSV:
      url = RECEIVER_EXAMPLE_URL_CSV;
      break;
    case TraderExampleType.TXT:
      url = RECEIVER_EXAMPLE_URL_TXT;
      break;
    case TraderExampleType.Excel:
      url = RECEIVER_EXAMPLE_URL_EXCEL;
      break;
    default:
      url = RECEIVER_EXAMPLE_URL_TXT;
  }
  openUrlExternal(url);
}
