import BigNumber from 'bignumber.js';

import {
  formatBalance,
  formatDisplayNumber,
  formatPrice,
  fromBigIntHex,
  toBigIntHex,
} from './numberUtils';

test('toBigIntHex', () => {
  expect(toBigIntHex(new BigNumber(0))).toBe('0x0');
  expect(toBigIntHex(new BigNumber(10))).toBe('0xa');
  expect(toBigIntHex(new BigNumber(0xff))).toBe('0xff');
  expect(toBigIntHex(new BigNumber('0xa.1c28f5c28f5c28f5c28f'))).toBe('0xa'); // ignore decimal point
});

test('fromBigIntHex', () => {
  expect(fromBigIntHex('0x00')).toStrictEqual(new BigNumber(0));
  expect(fromBigIntHex('0x0')).toStrictEqual(new BigNumber(0));
  expect(fromBigIntHex('0xa')).toStrictEqual(new BigNumber(10));
  expect(fromBigIntHex('0x0a')).toStrictEqual(new BigNumber(10));
  expect(fromBigIntHex('0xa.1c28f5c28f5c28f5c28f')).toStrictEqual(
    new BigNumber(10),
  );
});

test('formatBalance', () => {
  // not a number
  expect(formatBalance('1abcd1')).toEqual({
    'formattedValue': '0',
    'meta': { 'value': '1abcd1' },
  });
  expect(formatDisplayNumber(formatBalance('1abcd1'))).toEqual('0');

  // hundred
  expect(formatBalance('451.124282313')).toEqual({
    'formattedValue': '451.1243',
    'meta': { 'value': '451.124282313' },
  });
  expect(formatDisplayNumber(formatBalance('4512.1242'))).toEqual('4,512.1242');

  // thousand
  expect(formatBalance('4512.1242')).toEqual({
    'formattedValue': '4,512.1242',
    'meta': { 'value': '4512.1242' },
  });
  expect(formatDisplayNumber(formatBalance('4512.1242'))).toEqual('4,512.1242');

  // less then 1 billion
  expect(formatBalance('382134512.1242')).toEqual({
    'formattedValue': '382,134,512.1242',
    'meta': { 'value': '382134512.1242' },
  });
  expect(formatDisplayNumber(formatBalance('382134512.1242'))).toEqual(
    '382,134,512.1242',
  );

  expect(formatBalance('882134512')).toEqual({
    'formattedValue': '882,134,512',
    'meta': { 'value': '882134512' },
  });
  expect(formatDisplayNumber(formatBalance('882134512'))).toEqual(
    '882,134,512',
  );

  // more then 1 billion, but less then 1 trillion
  expect(formatBalance('235382184512.1242')).toEqual({
    'formattedValue': '235.3822',
    'meta': {
      'value': '235382184512.1242',
      'unit': 'B',
    },
  });
  expect(formatDisplayNumber(formatBalance('235382184512.1242'))).toEqual(
    '235.3822B',
  );

  // more then 1 trillion, but less then 1 quadrillion
  expect(formatBalance('564230002184512.1242')).toEqual({
    'formattedValue': '564.23',
    'meta': {
      'value': '564230002184512.1242',
      'unit': 'T',
    },
  });
  expect(formatDisplayNumber(formatBalance('564230002184512.1242'))).toEqual(
    '564.23T',
  );

  // more then 1 quadrillion
  expect(formatBalance('39477128561230002184512.1242')).toEqual({
    'formattedValue': '39,477,128.5612',
    'meta': {
      'value': '39477128561230002184512.1242',
      'unit': 'Q',
    },
  });
  expect(
    formatDisplayNumber(formatBalance('39477128561230002184512.1242')),
  ).toEqual('39,477,128.5612Q');

  // less then 1, but leading zeros is less then 4
  expect(formatBalance('0.1')).toEqual({
    'formattedValue': '0.1',
    'meta': {
      'leadingZeros': 0,
      'value': '0.1',
    },
  });
  expect(formatDisplayNumber(formatBalance('0.1'))).toEqual('0.1');
  expect(formatBalance('0.0045000')).toEqual({
    'formattedValue': '0.0045',
    'meta': {
      'leadingZeros': 2,
      'value': '0.0045000',
    },
  });
  expect(formatDisplayNumber(formatBalance('0.0045'))).toEqual('0.0045');
  expect(formatBalance('0.0000454283')).toEqual({
    'formattedValue': '0.00004543',
    'meta': {
      'leadingZeros': 4,
      'value': '0.0000454283',
    },
  });
  expect(formatDisplayNumber(formatBalance('0.0000454283'))).toEqual(
    '0.00004543',
  );

  // less then 1, but leading zeros is more then 4
  expect(formatBalance('0.0000041000')).toEqual({
    'formattedValue': '0.0000041',
    'meta': {
      'leadingZeros': 5,
      'value': '0.0000041000',
    },
  });
  expect(formatDisplayNumber(formatBalance('0.0000041000'))).toEqual([
    '0.0',
    { 'type': 'sub', 'value': 5 },
    '41',
  ]);

  expect(formatBalance('0.0000000214562')).toEqual({
    'formattedValue': '0.00000002146',
    'meta': {
      'leadingZeros': 7,
      'value': '0.0000000214562',
    },
  });
  expect(formatDisplayNumber(formatBalance('0.0000000214562'))).toEqual([
    '0.0',
    { 'type': 'sub', 'value': 7 },
    '2146',
  ]);
});

test('formatPrice', () => {
  // not a number
  expect(formatDisplayNumber(formatPrice('1abcd1', '$'))).toEqual('$0.00');
  // less than hundred
  expect(formatDisplayNumber(formatPrice('10.103', '$'))).toEqual('$10.10');
  // thousand
  expect(formatDisplayNumber(formatPrice('12345.21', '$'))).toEqual(
    '$12,345.21',
  );
  expect(formatDisplayNumber(formatPrice('12345', '$'))).toEqual('$12,345.00');
});
