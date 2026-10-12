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

const EIP712_DOMAIN_FIELDS = [
  { name: 'name', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' },
];
const PERMIT_TRANSFER_FROM_FIELDS = [
  { name: 'permitted', type: 'TokenPermissions' },
  { name: 'spender', type: 'address' },
  { name: 'nonce', type: 'uint256' },
  { name: 'deadline', type: 'uint256' },
];
const TOKEN_PERMISSIONS_FIELDS = [
  { name: 'token', type: 'address' },
  { name: 'amount', type: 'uint256' },
];
const DEFAULT_TYPES = {
  EIP712Domain: EIP712_DOMAIN_FIELDS,
  PermitTransferFrom: PERMIT_TRANSFER_FROM_FIELDS,
  TokenPermissions: TOKEN_PERMISSIONS_FIELDS,
};

function buildTypedData(
  overrides: {
    types?: Record<string, unknown>;
    domain?: Record<string, unknown>;
    message?: Record<string, unknown>;
    permitted?: Record<string, unknown>;
    primaryType?: string;
  } = {},
) {
  return {
    types: overrides.types ?? DEFAULT_TYPES,
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

  it('accepts hex and decimal-string chainIds for domain.chainId', () => {
    expect(check(buildTypedData({ domain: { chainId: '0x2105' } })).ok).toBe(
      true,
    );
    expect(check(buildTypedData({ domain: { chainId: '8453' } })).ok).toBe(
      true,
    );
  });

  it('summary.tokenAddress uses the registry-canonical casing, not the payload casing', () => {
    const lowerCaseToken = USDC_BASE.toLowerCase();
    const result = check(
      buildTypedData({ permitted: { token: lowerCaseToken } }),
    );
    expect(result).toEqual({
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

  it.each([
    ['not an object', 'x', 'invalid typed data shape'],
    [
      'a PermitTransferFrom type entry that is not an array',
      buildTypedData({
        types: { ...DEFAULT_TYPES, PermitTransferFrom: { not: 'an array' } },
      }),
      'unsupported typed data types',
    ],
    [
      'a types object missing TokenPermissions',
      buildTypedData({
        types: {
          EIP712Domain: EIP712_DOMAIN_FIELDS,
          PermitTransferFrom: PERMIT_TRANSFER_FROM_FIELDS,
        },
      }),
      'unsupported typed data types',
    ],
    [
      'an empty PermitTransferFrom field list',
      buildTypedData({
        types: { ...DEFAULT_TYPES, PermitTransferFrom: [] },
      }),
      'unsupported typed data types',
    ],
    [
      'an extra witness field on PermitTransferFrom',
      buildTypedData({
        types: {
          ...DEFAULT_TYPES,
          PermitTransferFrom: [
            ...PERMIT_TRANSFER_FROM_FIELDS,
            { name: 'witness', type: 'Witness' },
          ],
        },
      }),
      'unsupported typed data types',
    ],
    [
      'an extra struct in types',
      buildTypedData({
        types: { ...DEFAULT_TYPES, Witness: [{ name: 'foo', type: 'string' }] },
      }),
      'unsupported typed data types',
    ],
    [
      'unknown primaryType',
      buildTypedData({ primaryType: 'PermitSingle' }),
      'unsupported primaryType',
    ],
    [
      'primaryType PermitWitnessTransferFrom',
      buildTypedData({ primaryType: 'PermitWitnessTransferFrom' }),
      'unsupported primaryType',
    ],
    [
      'primaryType PermitBatchTransferFrom',
      buildTypedData({ primaryType: 'PermitBatchTransferFrom' }),
      'unsupported primaryType',
    ],
    [
      'a domain carrying an extra salt field',
      buildTypedData({ domain: { salt: '0x00' } }),
      'unsupported domain',
    ],
    [
      'a domain name other than Permit2',
      buildTypedData({ domain: { name: 'NotPermit2' } }),
      'unsupported domain',
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
      'a zero permitted amount',
      buildTypedData({ permitted: { amount: '0' } }),
      'invalid amount',
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
      // JSON number, not a string: Number.isSafeInteger(1e21) is false
      // (1e21 exceeds Number.MAX_SAFE_INTEGER), so parseUint's number
      // branch must reject it rather than silently rounding to a wrong
      // BigNumber value.
      'an unsafe-integer JSON number amount',
      buildTypedData({ permitted: { amount: 1e21 } }),
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
        message: { deadline: String(NOW_S + 30 * 24 * 3600 + 1) },
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

  it('refuses a non-finite clock before any deadline check', () => {
    expect(check(buildTypedData(), { nowMs: NaN })).toEqual({
      ok: false,
      reason: 'invalid clock',
    });
  });

  it('refuses a deadline beyond a caller-provided maxDeadlineS', () => {
    const typedData = buildTypedData({
      message: { deadline: String(NOW_S + 601) },
    });
    expect(check(typedData, { maxDeadlineS: 600 })).toEqual({
      ok: false,
      reason: 'deadline too far',
    });
  });

  // The bound is inclusive: the check is `isGreaterThan(nowSec + bound)`, so
  // a deadline landing exactly on it passes and the next second does not.
  it('admits a deadline exactly at the effective bound and refuses one second more', () => {
    expect(
      check(buildTypedData({ message: { deadline: String(NOW_S + 600) } }), {
        maxDeadlineS: 600,
      }).ok,
    ).toBe(true);
    expect(
      check(buildTypedData({ message: { deadline: String(NOW_S + 601) } }), {
        maxDeadlineS: 600,
      }),
    ).toEqual({ ok: false, reason: 'deadline too far' });
  });

  it('falls back to the default maxDeadlineS when given a non-positive value', () => {
    // A deadline just inside the default 30-day bound must still pass even
    // though the caller passed a bogus maxDeadlineS.
    const typedData = buildTypedData({
      message: { deadline: String(NOW_S + 600) },
    });
    expect(check(typedData, { maxDeadlineS: -1 }).ok).toBe(true);
  });

  it('admits a server-issued long deadline inside the 30-day ceiling', () => {
    // The Pay server customarily issues multi-week sigDeadlines; a 29-day
    // one must inline rather than fall back (Phase 3 §6).
    const typedData = buildTypedData({
      message: { deadline: String(NOW_S + 29 * 24 * 3600) },
    });
    expect(check(typedData).ok).toBe(true);
  });

  it('never lets a caller-provided maxDeadlineS widen the bound past the default ceiling', () => {
    // 10 years — far larger than WC_PAY_PERMIT_MAX_DEADLINE_S (30 days) —
    // must not let a deadline just past the default ceiling through.
    const typedData = buildTypedData({
      message: { deadline: String(NOW_S + 30 * 24 * 3600 + 1) },
    });
    expect(check(typedData, { maxDeadlineS: 10 * 365 * 24 * 3600 })).toEqual({
      ok: false,
      reason: 'deadline too far',
    });
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

// EIP-3009 ReceiveWithAuthorization — the shape the Pay server actually
// issues for USDC on Base (observed live 2026-08-31): the token contract
// itself is the verifying contract, the user authorizes the named `to` to
// pull exactly `value` before `validBefore`.
describe('checkWcPayTypedDataMatchesOrder — ReceiveWithAuthorization', () => {
  const EIP3009_TYPES = {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' },
    ],
    ReceiveWithAuthorization: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
    ],
  };
  const NONCE_32 = `0x${'f4'.repeat(32)}`;

  function buildReceiveAuth(
    overrides: {
      types?: Record<string, unknown>;
      domain?: Record<string, unknown>;
      message?: Record<string, unknown>;
    } = {},
  ) {
    return {
      types: overrides.types ?? EIP3009_TYPES,
      primaryType: 'ReceiveWithAuthorization',
      domain: {
        name: 'USD Coin',
        version: '2',
        chainId: 8453,
        verifyingContract: USDC_BASE,
        ...overrides.domain,
      },
      message: {
        from: ACCOUNT,
        to: SPENDER,
        value: '100000',
        validAfter: '0',
        validBefore: String(NOW_S + 3600),
        nonce: NONCE_32,
        ...overrides.message,
      },
    };
  }

  const checkAuth = (
    typedData: unknown,
    extras: {
      nowMs?: number;
      resolvedToken?: typeof resolvedToken;
      maxDeadlineS?: number;
      caip2ChainId?: string;
      option?: IWcPayOption;
    } = {},
  ) =>
    checkWcPayTypedDataMatchesOrder({
      typedData,
      caip2ChainId: extras.caip2ChainId ?? 'eip155:8453',
      option: extras.option ?? option,
      nowMs: extras.nowMs ?? NOW_MS,
      resolvedToken:
        'resolvedToken' in extras ? extras.resolvedToken : resolvedToken,
      maxDeadlineS: extras.maxDeadlineS,
    });

  it('inlines the observed Base USDC shape and maps the summary', () => {
    expect(checkAuth(buildReceiveAuth())).toEqual({
      ok: true,
      summary: {
        amountRaw: '100000',
        tokenAddress: USDC_BASE,
        spender: SPENDER,
        deadlineSec: NOW_S + 3600,
        chainReference: '8453',
      },
    });
  });

  it('accepts a case-different from address', () => {
    const payload = buildReceiveAuth({
      message: { from: ACCOUNT.toUpperCase().replace('0X', '0x') },
    });
    expect(checkAuth(payload).ok).toBe(true);
  });

  it('refuses a from that is not the option account', () => {
    expect(
      checkAuth(
        buildReceiveAuth({
          message: { from: '0x3333333333333333333333333333333333333333' },
        }),
      ),
    ).toEqual({ ok: false, reason: 'from mismatch' });
  });

  it('refuses a value that differs from the order amount', () => {
    expect(
      checkAuth(buildReceiveAuth({ message: { value: '100001' } })),
    ).toEqual({ ok: false, reason: 'amount mismatch' });
  });

  it('refuses a verifying contract the registry does not confirm', () => {
    expect(checkAuth(buildReceiveAuth(), { resolvedToken: undefined })).toEqual(
      { ok: false, reason: 'unknown token' },
    );
    expect(
      checkAuth(
        buildReceiveAuth({
          domain: {
            verifyingContract: '0x4444444444444444444444444444444444444444',
          },
        }),
      ),
    ).toEqual({ ok: false, reason: 'token address mismatch' });
  });

  it('refuses a registry token that disagrees with the order asset', () => {
    expect(
      checkAuth(buildReceiveAuth(), {
        resolvedToken: { address: USDC_BASE, symbol: 'SCAM', decimals: 6 },
      }),
    ).toEqual({ ok: false, reason: 'token symbol mismatch' });
  });

  it('refuses an expired or too-far validBefore', () => {
    expect(
      checkAuth(
        buildReceiveAuth({ message: { validBefore: String(NOW_S - 1) } }),
      ),
    ).toEqual({ ok: false, reason: 'deadline expired' });
    expect(
      checkAuth(
        buildReceiveAuth({
          message: { validBefore: String(NOW_S + 31 * 24 * 3600) },
        }),
      ),
    ).toEqual({ ok: false, reason: 'deadline too far' });
  });

  it('refuses an authorization that is not yet valid', () => {
    expect(
      checkAuth(
        buildReceiveAuth({ message: { validAfter: String(NOW_S + 600) } }),
      ),
    ).toEqual({ ok: false, reason: 'authorization not yet valid' });
  });

  it('refuses a malformed nonce', () => {
    expect(
      checkAuth(buildReceiveAuth({ message: { nonce: '0x1234' } })),
    ).toEqual({ ok: false, reason: 'invalid nonce' });
  });

  it('refuses extra message keys and non-canonical types', () => {
    expect(checkAuth(buildReceiveAuth({ message: { extra: '1' } }))).toEqual({
      ok: false,
      reason: 'unexpected message key: extra',
    });
    expect(
      checkAuth(
        buildReceiveAuth({
          types: {
            ...EIP3009_TYPES,
            ReceiveWithAuthorization: [
              ...EIP3009_TYPES.ReceiveWithAuthorization,
              { name: 'extra', type: 'uint256' },
            ],
          },
        }),
      ),
    ).toEqual({ ok: false, reason: 'unsupported typed data types' });
  });

  it('refuses a chain mismatch', () => {
    expect(checkAuth(buildReceiveAuth({ domain: { chainId: 1 } }))).toEqual({
      ok: false,
      reason: 'chain mismatch',
    });
  });

  it('reads the token address from the domain for registry resolution', () => {
    expect(
      readWcPayPermitTokenAddress(JSON.stringify(buildReceiveAuth())),
    ).toBe(USDC_BASE);
  });
});
