import BigNumber from 'bignumber.js';

import {
  formatBalance,
  formatDisplayNumber,
  formatMarketCap,
  formatPrice,
  formatPriceChange,
  formatValue,
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
    'formattedValue': '1abcd1',
    'meta': { 'value': '1abcd1', invalid: true },
  });

  // decimal
  expect(formatDisplayNumber(formatBalance('0.1'))).toEqual('0.1');
  expect(formatDisplayNumber(formatBalance('0.9999'))).toEqual('0.9999');
  expect(formatDisplayNumber(formatBalance('0.99999'))).toEqual('1');
  expect(formatDisplayNumber(formatBalance('123456789.9999'))).toEqual(
    '123,456,789.9999',
  );
  expect(formatDisplayNumber(formatBalance('123456789.99999'))).toEqual(
    '123,456,790',
  );
  expect(formatDisplayNumber(formatBalance('123456789.999999999'))).toEqual(
    '123,456,790',
  );

  // eq 0
  expect(formatDisplayNumber(formatBalance('-0'))).toEqual('0');
  expect(formatDisplayNumber(formatBalance('+0'))).toEqual('0');
  expect(formatDisplayNumber(formatBalance('0'))).toEqual('0');
  expect(formatDisplayNumber(formatBalance('0.00'))).toEqual('0');
  expect(formatDisplayNumber(formatBalance('0.00000'))).toEqual('0');

  // hundred
  expect(formatBalance('451.124282313')).toEqual({
    'formattedValue': '451.1243',
    'meta': { 'value': '451.124282313' },
  });
  expect(formatDisplayNumber(formatBalance('4512.1242'))).toEqual('4,512.1242');
  expect(formatDisplayNumber(formatBalance('-4512.1242'))).toEqual(
    '-4,512.1242',
  );

  // thousand
  expect(formatBalance('4512.1242')).toEqual({
    'formattedValue': '4,512.1242',
    'meta': { 'value': '4512.1242' },
  });
  expect(formatDisplayNumber(formatBalance('4512.1242'))).toEqual('4,512.1242');
  expect(formatDisplayNumber(formatBalance('-4512.1242'))).toEqual(
    '-4,512.1242',
  );

  // less then 1 billion
  expect(formatBalance('382134512.1242')).toEqual({
    'formattedValue': '382,134,512.1242',
    'meta': { 'value': '382134512.1242' },
  });
  expect(formatDisplayNumber(formatBalance('382134512.1242'))).toEqual(
    '382,134,512.1242',
  );
  expect(formatDisplayNumber(formatBalance('-382134512.1242'))).toEqual(
    '-382,134,512.1242',
  );

  expect(formatBalance('882134512')).toEqual({
    'formattedValue': '882,134,512',
    'meta': { 'value': '882134512' },
  });
  expect(formatDisplayNumber(formatBalance('882134512'))).toEqual(
    '882,134,512',
  );
  expect(formatDisplayNumber(formatBalance('-882134512'))).toEqual(
    '-882,134,512',
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
  expect(formatDisplayNumber(formatBalance('-235382184512.1242'))).toEqual(
    '-235.3822B',
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
  expect(formatDisplayNumber(formatBalance('-564230002184512.1242'))).toEqual(
    '-564.23T',
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
  expect(
    formatDisplayNumber(formatBalance('-39477128561230002184512.1242')),
  ).toEqual('-39,477,128.5612Q');

  // less then 1, but leading zeros is less then 4
  expect(formatBalance('0.1')).toEqual({
    'formattedValue': '0.1',
    'meta': {
      'leadingZeros': 0,
      'value': '0.1',
    },
  });
  expect(formatDisplayNumber(formatBalance('0.1'))).toEqual('0.1');
  expect(formatDisplayNumber(formatBalance('-0.1'))).toEqual('-0.1');

  expect(formatBalance('0.0045000')).toEqual({
    'formattedValue': '0.0045',
    'meta': {
      'leadingZeros': 2,
      'value': '0.0045000',
    },
  });
  expect(formatDisplayNumber(formatBalance('0.0045'))).toEqual('0.0045');
  expect(formatDisplayNumber(formatBalance('-0.0045'))).toEqual('-0.0045');

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
  expect(formatDisplayNumber(formatBalance('-0.0000454283'))).toEqual(
    '-0.00004543',
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
  expect(formatBalance('-0.0000041000')).toEqual({
    'formattedValue': '-0.0000041',
    'meta': {
      'leadingZeros': 5,
      'value': '-0.0000041000',
    },
  });
  expect(formatDisplayNumber(formatBalance('-0.0000041000'))).toEqual([
    '-',
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
  expect(formatDisplayNumber(formatBalance('-0.0000000214562'))).toEqual([
    '-',
    '0.0',
    { 'type': 'sub', 'value': 7 },
    '2146',
  ]);

  // token symbol
  expect(
    formatDisplayNumber(
      formatBalance('0.0000000214562', {
        tokenSymbol: 'ETC',
        showPlusMinusSigns: true,
      }),
    ),
  ).toEqual(['+', '0.0', { 'type': 'sub', 'value': 7 }, '2146', ' ', 'ETC']);

  // token symbol
  expect(
    formatDisplayNumber(
      formatBalance('-0.0000000214562', {
        tokenSymbol: 'ETC',
        showPlusMinusSigns: true,
      }),
    ),
  ).toEqual(['-', '0.0', { 'type': 'sub', 'value': 7 }, '2146', ' ', 'ETC']);

  expect(
    formatDisplayNumber(
      formatBalance('0', {
        tokenSymbol: 'USDC',
      }),
    ),
  ).toEqual('0 USDC');
  expect(
    formatDisplayNumber(
      formatBalance('+0', {
        tokenSymbol: 'USDC',
      }),
    ),
  ).toEqual('0 USDC');
  expect(
    formatDisplayNumber(
      formatBalance('-0', {
        tokenSymbol: 'USDC',
      }),
    ),
  ).toEqual('0 USDC');

  expect(
    formatDisplayNumber(
      formatBalance('0', {
        tokenSymbol: 'USDC',
        showPlusMinusSigns: true,
      }),
    ),
  ).toEqual('+0 USDC');
  expect(
    formatDisplayNumber(
      formatBalance('-0', {
        tokenSymbol: 'USDC',
        showPlusMinusSigns: true,
      }),
    ),
  ).toEqual('-0 USDC');
  expect(
    formatDisplayNumber(
      formatBalance('+0', {
        tokenSymbol: 'USDC',
        showPlusMinusSigns: true,
      }),
    ),
  ).toEqual('+0 USDC');

  expect(
    formatDisplayNumber(
      formatBalance('-100.16798000000214562', {
        tokenSymbol: 'USDC',
        showPlusMinusSigns: true,
      }),
    ),
  ).toEqual('-100.168 USDC');
  expect(
    formatDisplayNumber(
      formatBalance('202.16798000000214562', {
        tokenSymbol: 'USDT',
        showPlusMinusSigns: true,
      }),
    ),
  ).toEqual('+202.168 USDT');
});

test('formatPrice', () => {
  // not a number
  expect(formatDisplayNumber(formatPrice('1abcd1', { currency: '$' }))).toEqual(
    '1abcd1',
  );

  // decimal
  expect(formatDisplayNumber(formatPrice('0.1', { currency: '$' }))).toEqual(
    '$0.1',
  );
  expect(formatDisplayNumber(formatPrice('0.99', { currency: '$' }))).toEqual(
    '$0.99',
  );
  expect(formatDisplayNumber(formatPrice('0.999', { currency: '$' }))).toEqual(
    '$0.999',
  );
  expect(formatDisplayNumber(formatPrice('0.9999', { currency: '$' }))).toEqual(
    '$0.9999',
  );
  expect(
    formatDisplayNumber(formatPrice('0.00000000000000009', { currency: '$' })),
  ).toEqual(['$', '0.0', { 'type': 'sub', 'value': 16 }, '9']);
  expect(
    formatDisplayNumber(formatPrice('0.99999', { currency: '$' })),
  ).toEqual('$1');
  expect(
    formatDisplayNumber(formatPrice('0.999999999', { currency: '$' })),
  ).toEqual('$1');
  expect(
    formatDisplayNumber(formatPrice('123456789.99', { currency: '$' })),
  ).toEqual('$123,456,789.99');
  expect(
    formatDisplayNumber(formatPrice('123456789.999', { currency: '$' })),
  ).toEqual('$123,456,790.00');
  expect(
    formatDisplayNumber(formatPrice('123456789.9999', { currency: '$' })),
  ).toEqual('$123,456,790.00');
  expect(
    formatDisplayNumber(formatPrice('123456789.99999', { currency: '$' })),
  ).toEqual('$123,456,790.00');
  expect(
    formatDisplayNumber(formatPrice('123456789.999999999', { currency: '$' })),
  ).toEqual('$123,456,790.00');

  // eq 0
  expect(formatDisplayNumber(formatPrice('0', { currency: '$' }))).toEqual(
    '$0.00',
  );
  expect(formatDisplayNumber(formatPrice('0.00', { currency: '$' }))).toEqual(
    '$0.00',
  );
  expect(
    formatDisplayNumber(formatPrice('0.000000', { currency: '$' })),
  ).toEqual('$0.00');
  // less than hundred
  expect(formatDisplayNumber(formatPrice('10.103', { currency: '$' }))).toEqual(
    '$10.10',
  );
  // thousand
  expect(
    formatDisplayNumber(formatPrice('12345.21', { currency: '$' })),
  ).toEqual('$12,345.21');
  expect(formatDisplayNumber(formatPrice('12345', { currency: '$' }))).toEqual(
    '$12,345.00',
  );
  expect(
    formatDisplayNumber(
      formatPrice(
        '13557362245700035555161495398047413998367933131241010410691763880119784559016062844916472252762015173133555676356423519969743085158179152633859513576266605508375167501289296167138332859964556394542868213514778276007018586151530368896935403362153851120149886761999054463554127943866078939583808923520112330553910779375966862567701643361707370405490856611696753232661556874041759.125456789',
        { currency: '$' },
      ),
    ),
  ).toEqual('$∞.13');

  // less then 1, but leading zeros is less then 4
  expect(formatDisplayNumber(formatPrice('0.1', { currency: '$' }))).toEqual(
    '$0.1',
  );
  expect(formatDisplayNumber(formatPrice('0.0045', { currency: '$' }))).toEqual(
    '$0.0045',
  );
  expect(
    formatDisplayNumber(formatPrice('0.0000454283', { currency: '$' })),
  ).toEqual('$0.00004543');

  // less then 1, but leading zeros is more then 4
  expect(
    formatDisplayNumber(formatPrice('0.0000041000', { currency: '$' })),
  ).toEqual(['$', '0.0', { 'type': 'sub', 'value': 5 }, '41']);
  expect(
    formatDisplayNumber(formatPrice('0.0000000214562', { currency: '$' })),
  ).toEqual(['$', '0.0', { 'type': 'sub', 'value': 7 }, '2146']);
});

test('formatPriceChange', () => {
  expect(formatDisplayNumber(formatPriceChange('1abc1'))).toEqual('1abc1');

  // decimal
  expect(formatDisplayNumber(formatPriceChange('0.1'))).toEqual('0.10%');
  expect(formatDisplayNumber(formatPriceChange('0.99'))).toEqual('0.99%');
  expect(formatDisplayNumber(formatPriceChange('0.999'))).toEqual('1.00%');
  expect(formatDisplayNumber(formatPriceChange('0.9999'))).toEqual('1.00%');
  expect(formatDisplayNumber(formatPriceChange('0.99999'))).toEqual('1.00%');
  expect(formatDisplayNumber(formatPriceChange('0.999999999'))).toEqual(
    '1.00%',
  );
  expect(formatDisplayNumber(formatPriceChange('123456789.99'))).toEqual(
    '123,456,789.99%',
  );
  expect(formatDisplayNumber(formatPriceChange('123456789.999'))).toEqual(
    '123,456,790.00%',
  );
  expect(formatDisplayNumber(formatPriceChange('123456789.9999'))).toEqual(
    '123,456,790.00%',
  );
  expect(formatDisplayNumber(formatPriceChange('123456789.99999'))).toEqual(
    '123,456,790.00%',
  );
  expect(formatDisplayNumber(formatPriceChange('123456789.999999999'))).toEqual(
    '123,456,790.00%',
  );

  // eq 0
  expect(formatDisplayNumber(formatPriceChange('0'))).toEqual('0.00%');
  expect(formatDisplayNumber(formatPriceChange('0.00'))).toEqual('0.00%');
  expect(formatDisplayNumber(formatPriceChange('0.00000'))).toEqual('0.00%');

  expect(formatDisplayNumber(formatPriceChange('0.1'))).toEqual('0.10%');
  expect(formatDisplayNumber(formatPriceChange('3.74'))).toEqual('3.74%');
  expect(formatDisplayNumber(formatPriceChange('23374.7'))).toEqual(
    '23,374.70%',
  );
  expect(
    formatDisplayNumber(formatPriceChange('12312381912937323374.7')),
  ).toEqual('12,312,381,912,937,323,374.70%');
  expect(formatDisplayNumber(formatPriceChange('427.1'))).toEqual('427.10%');
  expect(formatDisplayNumber(formatPriceChange('-0.14'))).toEqual('-0.14%');
  expect(formatDisplayNumber(formatPriceChange('-16.4'))).toEqual('-16.40%');
  expect(formatDisplayNumber(formatPriceChange('-1.11'))).toEqual('-1.11%');
  expect(
    formatDisplayNumber(formatPriceChange('-12312381912937323374.7')),
  ).toEqual('-12,312,381,912,937,323,374.70%');
  expect(
    formatDisplayNumber(formatPriceChange('-12312381912937323374')),
  ).toEqual('-12,312,381,912,937,323,374.00%');
});

test('formatValue', () => {
  expect(formatDisplayNumber(formatValue('1abc1', { currency: '$' }))).toEqual(
    '1abc1',
  );
  expect(formatDisplayNumber(formatValue('0.009', { currency: '$' }))).toEqual(
    '< $0.01',
  );
  expect(formatDisplayNumber(formatValue('0.009', { currency: '$' }))).toEqual(
    '< $0.01',
  );
  expect(formatDisplayNumber(formatValue('0.01', { currency: '$' }))).toEqual(
    '$0.01',
  );
  expect(
    formatDisplayNumber(formatValue('0.000001', { currency: '$' })),
  ).toEqual('< $0.01');
  expect(
    formatDisplayNumber(formatValue('0.0000000001', { currency: '$' })),
  ).toEqual('< $0.01');

  // decimal
  expect(formatDisplayNumber(formatValue('0.1', { currency: '$' }))).toEqual(
    '$0.10',
  );
  expect(formatDisplayNumber(formatValue('0.99', { currency: '$' }))).toEqual(
    '$0.99',
  );
  expect(formatDisplayNumber(formatValue('0.999', { currency: '$' }))).toEqual(
    '$1.00',
  );
  expect(formatDisplayNumber(formatValue('0.9999', { currency: '$' }))).toEqual(
    '$1.00',
  );
  expect(
    formatDisplayNumber(formatValue('0.99999', { currency: '$' })),
  ).toEqual('$1.00');
  expect(
    formatDisplayNumber(formatValue('0.999999999', { currency: '$' })),
  ).toEqual('$1.00');
  expect(
    formatDisplayNumber(formatValue('123456789.99', { currency: '$' })),
  ).toEqual('$123,456,789.99');
  expect(
    formatDisplayNumber(formatValue('123456789.999', { currency: '$' })),
  ).toEqual('$123,456,790.00');
  expect(
    formatDisplayNumber(formatValue('123456789.9999', { currency: '$' })),
  ).toEqual('$123,456,790.00');
  expect(
    formatDisplayNumber(formatValue('123456789.99999', { currency: '$' })),
  ).toEqual('$123,456,790.00');
  expect(
    formatDisplayNumber(formatValue('123456789.999999999', { currency: '$' })),
  ).toEqual('$123,456,790.00');

  // eq 0
  expect(formatDisplayNumber(formatValue('-0', { currency: '$' }))).toEqual(
    '$0.00',
  );
  expect(formatDisplayNumber(formatValue('+0', { currency: '$' }))).toEqual(
    '$0.00',
  );
  expect(formatDisplayNumber(formatValue('0', { currency: '$' }))).toEqual(
    '$0.00',
  );
  expect(formatDisplayNumber(formatValue('0.00', { currency: '$' }))).toEqual(
    '$0.00',
  );
  expect(formatDisplayNumber(formatValue('0.0000', { currency: '$' }))).toEqual(
    '$0.00',
  );
  expect(formatDisplayNumber(formatValue('0.01', { currency: '$' }))).toEqual(
    '$0.01',
  );

  expect(formatDisplayNumber(formatValue('0.1', { currency: '$' }))).toEqual(
    '$0.10',
  );
  expect(formatDisplayNumber(formatValue('3.74', { currency: '$' }))).toEqual(
    '$3.74',
  );
  expect(
    formatDisplayNumber(formatValue('23374.7', { currency: '$' })),
  ).toEqual('$23,374.70');
  expect(
    formatDisplayNumber(
      formatValue('912312381912937323375', { currency: '$' }),
    ),
  ).toEqual('$912,312,381,912,937,323,375.00');
  expect(
    formatDisplayNumber(
      formatValue('12312381912937323374.7', { currency: '$' }),
    ),
  ).toEqual('$12,312,381,912,937,323,374.70');
});

test('formatMarketCap', () => {
  // not a number
  expect(formatDisplayNumber(formatMarketCap('1abcd1'))).toEqual('1abcd1');

  // decimal
  expect(formatDisplayNumber(formatMarketCap('0.1'))).toEqual('0.1');
  expect(formatDisplayNumber(formatMarketCap('0.99'))).toEqual('0.99');
  expect(formatDisplayNumber(formatMarketCap('0.999'))).toEqual('1');
  expect(formatDisplayNumber(formatMarketCap('0.9999'))).toEqual('1');
  expect(formatDisplayNumber(formatMarketCap('0.99999'))).toEqual('1');
  expect(formatDisplayNumber(formatMarketCap('123456789.9'))).toEqual(
    '123.46M',
  );
  expect(formatDisplayNumber(formatMarketCap('123456789.99'))).toEqual(
    '123.46M',
  );
  expect(formatDisplayNumber(formatMarketCap('123456789.999'))).toEqual(
    '123.46M',
  );
  expect(formatDisplayNumber(formatMarketCap('123456789.9999'))).toEqual(
    '123.46M',
  );
  expect(formatDisplayNumber(formatMarketCap('123456789.99999'))).toEqual(
    '123.46M',
  );
  expect(formatDisplayNumber(formatMarketCap('123456789.999999999'))).toEqual(
    '123.46M',
  );

  // eq 0
  expect(formatDisplayNumber(formatMarketCap('0'))).toEqual('0');
  expect(formatDisplayNumber(formatMarketCap('0.00'))).toEqual('0');
  expect(formatDisplayNumber(formatMarketCap('0.0000'))).toEqual('0');

  // less then 0
  expect(formatDisplayNumber(formatMarketCap('-0.125423'))).toEqual('-0.13');

  // less then 1
  expect(formatDisplayNumber(formatMarketCap('0.125423'))).toEqual('0.13');

  // more then 1，but less then 1 hundred
  expect(formatDisplayNumber(formatMarketCap('1'))).toEqual('1');
  expect(formatDisplayNumber(formatMarketCap('22.125423'))).toEqual('22.13');

  // hundred
  expect(formatDisplayNumber(formatMarketCap('4512.1242'))).toEqual('4.51K');

  // thousand
  expect(formatDisplayNumber(formatMarketCap('451200.1242'))).toEqual('451.2K');

  // less then 1 billion
  expect(formatDisplayNumber(formatMarketCap('382134512.1242'))).toEqual(
    '382.13M',
  );
  expect(formatDisplayNumber(formatMarketCap('882134512'))).toEqual('882.13M');

  // more then 1 billion, but less then 1 trillion
  expect(formatDisplayNumber(formatMarketCap('235002184512.1242'))).toEqual(
    '235B',
  );

  // more then 1 trillion, but less then 1 quadrillion
  expect(formatDisplayNumber(formatMarketCap('564200002184512.1242'))).toEqual(
    '564.2T',
  );
  expect(
    formatDisplayNumber(
      formatMarketCap(
        '32551169648428747600528316797038958441150665382888568684348849999999999999999999999999999999999999999999999123123038958441150665382888568684303895844115066538288856868430389584411506653828885686843038958441150665382888568684303895844115066538288856868430389584411506653828885686843038',
      ),
    ),
  ).toEqual(
    '32,551,169,648,428,747,600,528,316,797,038,958,441,150,665,382,888,568,684,348,849,999,999,999,999,999,999,999,999,999,999,999,999,999,999,999,123,123,038,958,441,150,665,382,888,568,684,303,895,844,115,066,538,288,856,868,430,389,584,411,506,653,828,885,686,843,038,958,441,150,665,382,888,568,684,303,895,844,115,066,538,288,856,868,430,389,584,411,506,653,828.89T',
  );
});
