import type { IWcPayOption } from '@onekeyhq/shared/src/walletConnect/payTypes';

import {
  WC_PAY_PERMIT2_ADDRESS,
  checkWcPayTypedDataMatchesOrder,
  readWcPayPermitTokenAddress,
} from './wcPayMessageConsistency';

// yarn jest packages/kit-bg/src/services/ServiceWalletConnectPay/wcPayMessageConsistency.test.ts

const ACCOUNT = '0x1111111111111111111111111111111111111111';
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const SPENDER = '0x2222222222222222222222222222222222222222';
const NOW_MS = 1_700_000_000_000;
const NOW_S = NOW_MS / 1000;

const option: IWcPayOption = {
  id: 'opt-1',
  account: `eip155:8453:${ACCOUNT}`,
  amount: {
    unit: 'USDC',
    value: '100000',
    display: { assetSymbol: 'USDC', assetName: 'USD Coin', decimals: 6 },
  },
  etaS: 10,
  actions: [],
};

const resolvedToken = { address: USDC_BASE, symbol: 'USDC', decimals: 6 };

function buildTypedData(
  overrides: {
    domain?: Record<string, unknown>;
    message?: Record<string, unknown>;
    permitted?: Record<string, unknown>;
    primaryType?: string;
  } = {},
) {
  return {
    types: {
      PermitTransferFrom: [
        { name: 'permitted', type: 'TokenPermissions' },
        { name: 'spender', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
      TokenPermissions: [
        { name: 'token', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
    },
    primaryType: overrides.primaryType ?? 'PermitTransferFrom',
    domain: {
      name: 'Permit2',
      chainId: 8453,
      verifyingContract: WC_PAY_PERMIT2_ADDRESS,
      ...overrides.domain,
    },
    message: {
      permitted: {
        token: USDC_BASE,
        amount: '100000',
        ...overrides.permitted,
      },
      spender: SPENDER,
      nonce: '7',
      deadline: String(NOW_S + 600),
      ...overrides.message,
    },
  };
}

function check(
  typedData: unknown,
  extra: Partial<Parameters<typeof checkWcPayTypedDataMatchesOrder>[0]> = {},
) {
  return checkWcPayTypedDataMatchesOrder({
    typedData,
    caip2ChainId: 'eip155:8453',
    option,
    nowMs: NOW_MS,
    resolvedToken,
    ...extra,
  });
}

describe('checkWcPayTypedDataMatchesOrder', () => {
  it('accepts a Permit2 PermitTransferFrom that matches the order', () => {
    expect(check(buildTypedData())).toEqual({
      ok: true,
      summary: {
        amountRaw: '100000',
        tokenAddress: USDC_BASE,
        spender: SPENDER,
        deadlineSec: NOW_S + 600,
        chainReference: '8453',
      },
    });
  });

  it('accepts hex and decimal-string chainIds and a missing EIP712Domain type', () => {
    expect(check(buildTypedData({ domain: { chainId: '0x2105' } })).ok).toBe(
      true,
    );
    expect(check(buildTypedData({ domain: { chainId: '8453' } })).ok).toBe(
      true,
    );
  });

  it.each([
    ['not an object', 'x', 'invalid typed data shape'],
    [
      'a PermitTransferFrom type entry that is not an array',
      {
        ...buildTypedData(),
        types: {
          ...buildTypedData().types,
          PermitTransferFrom: { not: 'an array' },
        },
      },
      'invalid typed data shape',
    ],
    [
      'unknown primaryType',
      buildTypedData({ primaryType: 'PermitSingle' }),
      'unsupported primaryType',
    ],
    [
      'non-Permit2 verifyingContract',
      buildTypedData({ domain: { verifyingContract: SPENDER } }),
      'verifyingContract is not Permit2',
    ],
    [
      'chain mismatch with the option',
      buildTypedData({ domain: { chainId: 1 } }),
      'chain mismatch',
    ],
    [
      'a permitted value that is not an object',
      buildTypedData({ message: { permitted: 'x' } }),
      'invalid permitted shape',
    ],
    [
      'amount mismatch',
      buildTypedData({ permitted: { amount: '100001' } }),
      'amount mismatch',
    ],
    [
      'non-integer amount',
      buildTypedData({ permitted: { amount: '1e5' } }),
      'invalid amount',
    ],
    [
      'a token address that is too short',
      buildTypedData({ permitted: { token: '0x12' } }),
      'invalid token address',
    ],
    [
      'a non-numeric deadline',
      buildTypedData({ message: { deadline: 'soon' } }),
      'invalid deadline',
    ],
    [
      'expired deadline',
      buildTypedData({ message: { deadline: String(NOW_S - 1) } }),
      'deadline expired',
    ],
    [
      'unbounded deadline',
      buildTypedData({
        message: { deadline: String(NOW_S + 24 * 3600 + 1) },
      }),
      'deadline too far',
    ],
    [
      'negative nonce',
      buildTypedData({ message: { nonce: '-1' } }),
      'invalid nonce',
    ],
    [
      'invalid spender',
      buildTypedData({ message: { spender: '0x12' } }),
      'invalid spender',
    ],
    [
      'extra message key',
      buildTypedData({ message: { witness: '0x' } }),
      'unexpected message key: witness',
    ],
    [
      'extra permitted key',
      buildTypedData({ permitted: { extra: 1 } }),
      'unexpected permitted key: extra',
    ],
  ])('refuses %s', (_label, typedData, reason) => {
    expect(check(typedData)).toEqual({ ok: false, reason });
  });

  it('refuses when the action chainId disagrees with the option chain', () => {
    expect(check(buildTypedData(), { caip2ChainId: 'eip155:1' })).toEqual({
      ok: false,
      reason: 'chain mismatch',
    });
  });

  it('refuses an option account with too few CAIP-10 segments', () => {
    const twoSegments: IWcPayOption = { ...option, account: 'eip155:8453' };
    expect(check(buildTypedData(), { option: twoSegments })).toEqual({
      ok: false,
      reason: 'invalid option account shape',
    });
  });

  it('refuses a non-eip155 account namespace as an account-shape error, not a chain mismatch', () => {
    const nonEip155: IWcPayOption = {
      ...option,
      account: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:abc',
    };
    expect(check(buildTypedData(), { option: nonEip155 })).toEqual({
      ok: false,
      reason: 'invalid option account shape',
    });
  });

  it('refuses an option amount that is not a valid decimal string', () => {
    const badAmountOption: IWcPayOption = {
      ...option,
      amount: { ...option.amount, value: 'abc' },
    };
    expect(check(buildTypedData(), { option: badAmountOption })).toEqual({
      ok: false,
      reason: 'invalid order amount format',
    });
  });

  it('accepts option.amount.value with leading zeros matching permitted.amount', () => {
    const leadingZeroOption: IWcPayOption = {
      ...option,
      amount: { ...option.amount, value: '0100000' },
    };
    expect(check(buildTypedData(), { option: leadingZeroOption }).ok).toBe(
      true,
    );
  });

  it('refuses an unknown or mismatching token', () => {
    expect(check(buildTypedData(), { resolvedToken: undefined })).toEqual({
      ok: false,
      reason: 'unknown token',
    });
    expect(
      check(buildTypedData(), {
        resolvedToken: { ...resolvedToken, symbol: 'USDT' },
      }),
    ).toEqual({ ok: false, reason: 'token symbol mismatch' });
    expect(
      check(buildTypedData(), {
        resolvedToken: { ...resolvedToken, decimals: 18 },
      }),
    ).toEqual({ ok: false, reason: 'token decimals mismatch' });
    expect(
      check(buildTypedData(), {
        resolvedToken: { ...resolvedToken, address: SPENDER },
      }),
    ).toEqual({ ok: false, reason: 'token address mismatch' });
  });
});

describe('readWcPayPermitTokenAddress', () => {
  it('returns permitted.token for a plausible Permit2 payload', () => {
    expect(readWcPayPermitTokenAddress(JSON.stringify(buildTypedData()))).toBe(
      USDC_BASE,
    );
  });

  it('returns undefined for anything else', () => {
    expect(readWcPayPermitTokenAddress('{"types":{}}')).toBeUndefined();
    expect(readWcPayPermitTokenAddress('{not json')).toBeUndefined();
    expect(
      readWcPayPermitTokenAddress(
        JSON.stringify(buildTypedData({ permitted: { token: 'nope' } })),
      ),
    ).toBeUndefined();
  });
});
