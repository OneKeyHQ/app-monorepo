import { RESOURCE_BOUNDS_MULTIPLIER } from './sdkStarknet/consts';
import {
  buildErc20TransferCall,
  decimalStringToU256,
  decodeCairoString,
  hexToDecimalString,
  isValidStarknetAddress,
  normalizeStarknetAddress,
  parseRpcErrorCode,
  resourceBoundsToFee,
  sumResourceBounds,
  toHexFelt,
  toResourceBounds,
  u256ToDecimalString,
  zeroResourceBounds,
} from './utils';

const STRK =
  '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';

// captured from a live Sepolia starknet_estimateFee (spec 0.9.0)
const LIVE_ESTIMATE = {
  l1_gas_consumed: '0x0',
  l1_gas_price: '0xa0a84ea20386',
  l2_gas_consumed: '0x122b53',
  l2_gas_price: '0x73c72e3b3',
  l1_data_gas_consumed: '0x80',
  l1_data_gas_price: '0xa6f6ce2211',
};

describe('starknet utils: u256', () => {
  it('joins low and high felts', () => {
    expect(u256ToDecimalString('0x0', '0x0')).toBe('0');
    expect(u256ToDecimalString('0x1e021439f60f535ee869', '0x0')).toBe(
      '141709345440736890251369',
    );
    // 2^128 lives entirely in the high leg
    expect(u256ToDecimalString('0x0', '0x1')).toBe(
      '340282366920938463463374607431768211456',
    );
    expect(
      u256ToDecimalString('0xffffffffffffffffffffffffffffffff', '0x2'),
    ).toBe('1020847100762815390390123822295304634367');
  });

  it('splits a base-unit amount back into low and high', () => {
    expect(decimalStringToU256('0')).toEqual(['0x0', '0x0']);
    expect(decimalStringToU256('141709345440736890251369')).toEqual([
      '0x1e021439f60f535ee869',
      '0x0',
    ]);
    expect(
      decimalStringToU256('340282366920938463463374607431768211456'),
    ).toEqual(['0x0', '0x1']);
  });

  it('round-trips every split back through the join', () => {
    for (const amount of [
      '1',
      '1000000000000000000',
      '340282366920938463463374607431768211455',
      '1020847100762815390390123822295304634367',
    ]) {
      const [low, high] = decimalStringToU256(amount);
      expect(u256ToDecimalString(low, high)).toBe(amount);
    }
  });

  it('rejects amounts that are not whole base units', () => {
    expect(() => decimalStringToU256('1.5')).toThrow();
    expect(() => decimalStringToU256('-1')).toThrow();
    expect(() => decimalStringToU256('abc')).toThrow();
  });
});

describe('starknet utils: addresses', () => {
  it('pads to 0x + 64 lowercase hex', () => {
    expect(normalizeStarknetAddress('0x1')).toBe(
      '0x0000000000000000000000000000000000000000000000000000000000000001',
    );
    // the unpadded form an RPC returns and the padded form we store are equal
    expect(
      normalizeStarknetAddress(
        '0x77dfdc45ba4695eac4c961f3d9bf820ed7e925a44d9963de7b7a0daf8768af0',
      ),
    ).toBe(
      '0x077dfdc45ba4695eac4c961f3d9bf820ed7e925a44d9963de7b7a0daf8768af0',
    );
  });

  it('lowercases and is idempotent', () => {
    const mixed =
      '0x04718F5A0FC34CC1AF16A1CDEE98FFB20C31F5CD61D6AB07201858F4287C938D';
    const once = normalizeStarknetAddress(mixed);
    expect(once).toBe(STRK);
    expect(normalizeStarknetAddress(once)).toBe(once);
  });

  it('accepts any valid felt, deployed or not', () => {
    expect(isValidStarknetAddress('0x1')).toBe(true);
    expect(
      isValidStarknetAddress(
        '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      ),
    ).toBe(true);
  });

  it('rejects non-felts', () => {
    expect(isValidStarknetAddress('')).toBe(false);
    expect(isValidStarknetAddress('not-an-address')).toBe(false);
    expect(
      isValidStarknetAddress('0x742d35Cc6634C0532925a3b844Bc454e4438f44e'),
    ).toBe(true); // a 20-byte hex is still a valid felt
    // beyond the felt field size
    expect(
      isValidStarknetAddress(
        '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      ),
    ).toBe(false);
  });
});

describe('starknet utils: resource bounds', () => {
  it('pads every value by the shared multiplier, flooring like starknet.js', () => {
    const bounds = toResourceBounds(LIVE_ESTIMATE);
    expect(RESOURCE_BOUNDS_MULTIPLIER).toBe(1.5);
    // 0x122b53 = 1190739 -> *1.5 = 1786108.5 -> floor 1786108 = 0x1b40fc
    expect(bounds.l2_gas.max_amount).toBe('0x1b40fc');
    // 0x80 = 128 -> 192 = 0xc0
    expect(bounds.l1_data_gas.max_amount).toBe('0xc0');
    expect(bounds.l1_gas.max_amount).toBe('0x0');
    // 0xa0a84ea20386 = 176644734190470 -> floor(*1.5) = 264967101285705
    expect(hexToDecimalString(bounds.l1_gas.max_price_per_unit)).toBe(
      '264967101285705',
    );
  });

  it('accepts an explicit multiplier', () => {
    const bounds = toResourceBounds(LIVE_ESTIMATE, 1);
    expect(bounds.l2_gas.max_amount).toBe('0x122b53');
    expect(bounds.l1_data_gas.max_price_per_unit).toBe('0xa6f6ce2211');
  });

  it('sums amount * price across the three resources', () => {
    const bounds = {
      l1_gas: { max_amount: '0x2', max_price_per_unit: '0x3' },
      l2_gas: { max_amount: '0x4', max_price_per_unit: '0x5' },
      l1_data_gas: { max_amount: '0x6', max_price_per_unit: '0x7' },
    };
    expect(sumResourceBounds(bounds)).toBe(String(2 * 3 + 4 * 5 + 6 * 7));
  });

  it('sums zero bounds to zero', () => {
    expect(sumResourceBounds(zeroResourceBounds())).toBe('0');
  });

  it('keeps full precision on realistic magnitudes', () => {
    const bounds = toResourceBounds(LIVE_ESTIMATE);
    const expected =
      BigInt(bounds.l1_gas.max_amount) *
        BigInt(bounds.l1_gas.max_price_per_unit) +
      BigInt(bounds.l2_gas.max_amount) *
        BigInt(bounds.l2_gas.max_price_per_unit) +
      BigInt(bounds.l1_data_gas.max_amount) *
        BigInt(bounds.l1_data_gas.max_price_per_unit);
    expect(sumResourceBounds(bounds)).toBe(expected.toString(10));
  });

  it('converts bounds to the decimal FRI shape the fee UI reads', () => {
    expect(
      resourceBoundsToFee(
        {
          l1_gas: { max_amount: '0xa', max_price_per_unit: '0xb' },
          l2_gas: { max_amount: '0xc', max_price_per_unit: '0xd' },
          l1_data_gas: { max_amount: '0xe', max_price_per_unit: '0xf' },
        },
        {
          ...LIVE_ESTIMATE,
          l1_gas_price: '0x7',
          l2_gas_price: '0x8',
          l1_data_gas_price: '0x9',
        },
      ),
    ).toEqual({
      l1Gas: {
        maxAmount: '10',
        maxPricePerUnit: '11',
        estimatedPricePerUnit: '7',
      },
      l2Gas: {
        maxAmount: '12',
        maxPricePerUnit: '13',
        estimatedPricePerUnit: '8',
      },
      l1DataGas: {
        maxAmount: '14',
        maxPricePerUnit: '15',
        estimatedPricePerUnit: '9',
      },
    });
  });

  it('writes felts without leading zeros', () => {
    expect(toHexFelt(0)).toBe('0x0');
    expect(toHexFelt('0x0000ff')).toBe('0xff');
  });
});

describe('starknet utils: erc20 transfer call', () => {
  it('builds transfer(recipient, low, high) with normalized addresses', () => {
    expect(
      buildErc20TransferCall({
        tokenAddress: STRK.replace('0x0', '0x'),
        to: '0x1',
        amount: '1000000000000000000',
      }),
    ).toEqual({
      contractAddress: STRK,
      entrypoint: 'transfer',
      calldata: [
        '0x0000000000000000000000000000000000000000000000000000000000000001',
        '0xde0b6b3a7640000',
        '0x0',
      ],
    });
  });
});

describe('starknet utils: rpc error codes', () => {
  it('reads the code out of a JsonRPCResponseError shaped error', () => {
    const error = Object.assign(new Error('Error JSON RPC response'), {
      response: {
        jsonrpc: '2.0',
        id: 1,
        error: { code: 20, message: 'Contract not found' },
      },
    });
    expect(parseRpcErrorCode(error)).toBe(20);
  });

  it('reads a raw json-rpc body', () => {
    expect(
      parseRpcErrorCode({
        jsonrpc: '2.0',
        error: { code: 29, message: 'Transaction hash not found' },
      }),
    ).toBe(29);
  });

  it('reads a bare error object', () => {
    expect(parseRpcErrorCode({ code: 41 })).toBe(41);
  });

  it('returns undefined when there is no numeric code', () => {
    expect(parseRpcErrorCode(new Error('network down'))).toBeUndefined();
    expect(parseRpcErrorCode(undefined)).toBeUndefined();
    expect(parseRpcErrorCode({ code: 'ECONNRESET' })).toBeUndefined();
  });
});

describe('starknet utils: cairo strings', () => {
  // captured from live starknet_call on name()/symbol()
  it('decodes a Cairo 1 ByteArray', () => {
    expect(
      decodeCairoString(['0x0', '0x537461726b6e657420546f6b656e', '0xe']),
    ).toBe('Starknet Token');
    expect(decodeCairoString(['0x0', '0x5354524b', '0x4'])).toBe('STRK');
    expect(decodeCairoString(['0x0', '0x4574686572', '0x5'])).toBe('Ether');
    expect(decodeCairoString(['0x0', '0x455448', '0x3'])).toBe('ETH');
  });

  it('decodes a felt252 short string', () => {
    expect(decodeCairoString(['0x55534420436f696e'])).toBe('USD Coin');
    expect(decodeCairoString(['0x55534443'])).toBe('USDC');
  });

  it('decodes a ByteArray with a full 31-byte word', () => {
    const word = Buffer.from('a'.repeat(31), 'utf8').toString('hex');
    expect(decodeCairoString([`0x1`, `0x${word}`, '0x0', '0x0'])).toBe(
      'a'.repeat(31),
    );
  });

  it('returns an empty string for empty or zero input', () => {
    expect(decodeCairoString([])).toBe('');
    expect(decodeCairoString(['0x0'])).toBe('');
    expect(decodeCairoString(['0x0', '0x0', '0x0'])).toBe('');
  });
});
