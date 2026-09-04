import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import type { IWcPaySolanaConsistencyResult } from '@onekeyhq/kit-bg/src/services/ServiceWalletConnectPay/wcPaySolanaConsistency';
import {
  PasswordPromptDialogCancel,
  PinCancelled,
  SecureQRCodeDialogCancel,
  UserCancelFromOutside,
} from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { toPlainErrorObject } from '@onekeyhq/shared/src/errors/utils/errorUtils';
import type {
  IWcPayAction,
  IWcPayOption,
} from '@onekeyhq/shared/src/walletConnect/payTypes';

import {
  EWcPayInlineFailureKind,
  WC_PAY_INLINE_POST_SIGN_FLAG,
  WC_PAY_PERSONAL_SIGN_MAX_CHARS,
  WC_PAY_PERSONAL_SIGN_MAX_LINES,
  classifyWcPayInlineFailure,
  getWcPayInlineMessagePlan,
  getWcPayInlinePersonalSignPlan,
  getWcPayInlineSolanaPlan,
  getWcPayInlineSolanaRequest,
  getWcPayInlineTxPlan,
  isWcPayInlinePostSignError,
  isWcPayInlineUserCancel,
  isWcPayUnlimitedApproveAmount,
  nextWcPayPagePhaseAfterAttempt,
  runWcPayInlineAttempts,
  sanitizeWcPayDisplayText,
} from '../wcPayInlineUtils';

import type {
  IWcPayInlineFailure,
  IWcPayInlineSendResult,
  IWcPayInlineStage,
} from '../wcPayInlineUtils';

const SENDER = '0x1111111111111111111111111111111111111111';

const option: IWcPayOption = {
  id: 'opt-1',
  account: `eip155:8453:${SENDER}`,
  amount: {
    unit: 'usdc',
    value: '1000000',
    display: { assetSymbol: 'USDC', assetName: 'USD Coin', decimals: 6 },
  },
  etaS: 10,
  actions: [],
};

const nativeAction: IWcPayAction = {
  walletRpc: {
    chainId: 'eip155:8453',
    method: 'eth_sendTransaction',
    params: JSON.stringify([{ from: SENDER, to: SENDER, value: '0xf4240' }]),
  },
};

const signAction: IWcPayAction = {
  walletRpc: {
    chainId: 'eip155:8453',
    method: 'personal_sign',
    params: JSON.stringify(['0xdead', SENDER]),
  },
};

// Actions shaped like a server response that lost — or lied about — its
// walletRpc payload. A method that is not a non-empty string is a malformed
// action, not a named one: no plan may echo a server-controlled value as if
// it were an RPC method.
const MALFORMED_ACTIONS: Array<[string, IWcPayAction]> = [
  ['an action without walletRpc', { walletRpc: undefined as never }],
  ['a missing action', null as unknown as IWcPayAction],
  [
    'an empty method',
    { walletRpc: { chainId: 'eip155:8453', method: '', params: '[]' } },
  ],
  [
    'a non-string method',
    {
      walletRpc: {
        chainId: 'eip155:8453',
        method: 7 as unknown as string,
        params: '[]',
      },
    },
  ],
];

describe('getWcPayInlineTxPlan', () => {
  it('inlines a matching transfer action regardless of sequence length', () => {
    expect(getWcPayInlineTxPlan({ action: nativeAction, option })).toEqual({
      mode: 'inline',
      kind: 'transfer',
    });
  });

  it('inlines a Permit2 approve action, naming its kind', () => {
    const PERMIT2 = '0x000000000022d473030f116ddee9f6b43ac78ba3';
    const approveAction: IWcPayAction = {
      walletRpc: {
        chainId: 'eip155:8453',
        method: 'eth_sendTransaction',
        params: JSON.stringify([
          {
            from: SENDER,
            to: '0x2222222222222222222222222222222222222222',
            value: '0x0',
            data: `0x095ea7b3${PERMIT2.slice(2).padStart(64, '0')}${(1_000_000)
              .toString(16)
              .padStart(64, '0')}`,
          },
        ]),
      },
    };
    expect(getWcPayInlineTxPlan({ action: approveAction, option })).toEqual({
      mode: 'inline',
      kind: 'approve',
    });
  });

  it('falls back for a non-transfer method, naming it', () => {
    expect(getWcPayInlineTxPlan({ action: signAction, option })).toEqual({
      mode: 'fallback',
      reason: 'method personal_sign',
    });
  });

  it('falls back without a selected option', () => {
    expect(
      getWcPayInlineTxPlan({ action: nativeAction, option: undefined }),
    ).toEqual({ mode: 'fallback', reason: 'no selected option' });
  });

  it('falls back on consistency mismatch', () => {
    const inflated: IWcPayAction = {
      walletRpc: {
        chainId: 'eip155:8453',
        method: 'eth_sendTransaction',
        params: JSON.stringify([
          { from: SENDER, to: SENDER, value: '0xffffff' },
        ]),
      },
    };
    // the validator's own reason is carried through verbatim — it is what
    // logs/telemetry read to tell one refusal from another
    expect(getWcPayInlineTxPlan({ action: inflated, option })).toEqual({
      mode: 'fallback',
      reason: 'native amount mismatch',
    });
  });

  it.each(MALFORMED_ACTIONS)(
    'falls back without throwing on %s',
    (_label, action) => {
      expect(() => getWcPayInlineTxPlan({ action, option })).not.toThrow();
      expect(getWcPayInlineTxPlan({ action, option })).toEqual({
        mode: 'fallback',
        reason: 'malformed action',
      });
    },
  );
});

const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const SPENDER = '0x2222222222222222222222222222222222222222';
const NOW_MS = 1_700_000_000_000;

const permitOption: IWcPayOption = {
  ...option,
  account: `eip155:8453:${SENDER}`,
  amount: {
    unit: 'USDC',
    value: '100000',
    display: { assetSymbol: 'USDC', assetName: 'USD Coin', decimals: 6 },
  },
};

const permitTypedData = {
  types: {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' },
    ],
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
  primaryType: 'PermitTransferFrom',
  domain: {
    name: 'Permit2',
    chainId: 8453,
    verifyingContract: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  },
  message: {
    permitted: { token: USDC_BASE, amount: '100000' },
    spender: SPENDER,
    nonce: '7',
    deadline: String(NOW_MS / 1000 + 600),
  },
};

const permitAction: IWcPayAction = {
  walletRpc: {
    chainId: 'eip155:8453',
    method: 'eth_signTypedData_v4',
    params: JSON.stringify([SENDER, JSON.stringify(permitTypedData)]),
  },
};

const brokenTypedDataAction: IWcPayAction = {
  walletRpc: {
    chainId: 'eip155:8453',
    method: 'eth_signTypedData_v4',
    params: '{',
  },
};

describe('getWcPayInlineMessagePlan', () => {
  const resolvedToken = { address: USDC_BASE, symbol: 'USDC', decimals: 6 };

  it('inlines a matching Permit2 payload and carries the summary', () => {
    const plan = getWcPayInlineMessagePlan({
      action: permitAction,
      option: permitOption,
      nowMs: NOW_MS,
      resolvedToken,
    });
    expect(plan.mode).toBe('inline');
    expect(plan.mode === 'inline' && plan.summary.spender).toBe(SPENDER);
    expect(plan.mode === 'inline' && plan.summary.amountRaw).toBe('100000');
  });

  it('falls back with the validator reason', () => {
    expect(
      getWcPayInlineMessagePlan({
        action: permitAction,
        option: permitOption,
        nowMs: NOW_MS,
        resolvedToken: undefined,
      }),
    ).toEqual({ mode: 'fallback', reason: 'unknown token' });
  });

  it('forwards a tightened deadline bound to the validator', () => {
    expect(
      getWcPayInlineMessagePlan({
        action: permitAction,
        option: permitOption,
        nowMs: NOW_MS,
        resolvedToken,
        maxDeadlineS: 60,
      }),
    ).toEqual({ mode: 'fallback', reason: 'deadline too far' });
  });

  it('falls back for unparseable params and other methods', () => {
    expect(
      getWcPayInlineMessagePlan({
        action: brokenTypedDataAction,
        option: permitOption,
        nowMs: NOW_MS,
        resolvedToken,
      }),
    ).toEqual({ mode: 'fallback', reason: 'unparseable params' });
    expect(
      getWcPayInlineMessagePlan({
        action: nativeAction,
        option: permitOption,
        nowMs: NOW_MS,
        resolvedToken,
      }),
    ).toEqual({ mode: 'fallback', reason: 'method eth_sendTransaction' });
  });

  it('falls back without a selected option', () => {
    expect(
      getWcPayInlineMessagePlan({
        action: permitAction,
        option: undefined,
        nowMs: NOW_MS,
        resolvedToken,
      }),
    ).toEqual({ mode: 'fallback', reason: 'no selected option' });
  });

  it.each(MALFORMED_ACTIONS)(
    'falls back without throwing on %s',
    (_label, action) => {
      const call = () =>
        getWcPayInlineMessagePlan({
          action,
          option: permitOption,
          nowMs: NOW_MS,
          resolvedToken,
        });
      expect(call).not.toThrow();
      expect(call()).toEqual({ mode: 'fallback', reason: 'malformed action' });
    },
  );
});

const SOLANA_CHAIN = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const TX_BASE64 = 'dW5zaWduZWQ=';

const solOption: IWcPayOption = {
  ...option,
  account: `${SOLANA_CHAIN}:payer`,
  amount: {
    unit: 'SOL',
    value: '1500',
    display: { assetSymbol: 'SOL', assetName: 'Solana', decimals: 9 },
  },
};
const usdcSolOption: IWcPayOption = {
  ...solOption,
  amount: {
    unit: 'USDC',
    value: '100000',
    display: { assetSymbol: 'USDC', assetName: 'USD Coin', decimals: 6 },
  },
};

const solanaAction: IWcPayAction = {
  walletRpc: {
    chainId: SOLANA_CHAIN,
    method: 'solana_signTransaction',
    params: JSON.stringify([{ transaction: TX_BASE64 }]),
  },
};
const brokenSolanaAction: IWcPayAction = {
  walletRpc: {
    chainId: SOLANA_CHAIN,
    method: 'solana_signTransaction',
    params: '{',
  },
};

// Verdicts the background validator would return; this suite feeds them in
// directly, so the plan's own decision logic is what is under test (the
// validator itself is exercised against real blobs in its kit-bg suite).
const nativeSummary = {
  amountRaw: '1500',
  kind: 'native' as const,
  priorityFeeLamports: '0',
  sponsoredFee: false,
  fundsRecipientAta: false,
};
const splSummary = {
  amountRaw: '100000',
  kind: 'spl' as const,
  mint: USDC_MINT,
  decimals: 6,
  priorityFeeLamports: '0',
  sponsoredFee: false,
  fundsRecipientAta: false,
};

describe('getWcPayInlineSolanaRequest', () => {
  it('reads the blob and chain out of a solana action', () => {
    expect(
      getWcPayInlineSolanaRequest({ action: solanaAction, option: solOption }),
    ).toEqual({
      mode: 'request',
      txBase64: TX_BASE64,
      caip2ChainId: SOLANA_CHAIN,
    });
  });

  it('falls back for a non-solana method', () => {
    expect(
      getWcPayInlineSolanaRequest({ action: nativeAction, option: solOption }),
    ).toEqual({ mode: 'fallback', reason: 'method eth_sendTransaction' });
  });

  it('falls back without a selected option', () => {
    expect(
      getWcPayInlineSolanaRequest({ action: solanaAction, option: undefined }),
    ).toEqual({ mode: 'fallback', reason: 'no selected option' });
  });

  it('falls back without throwing on unparseable params', () => {
    expect(() =>
      getWcPayInlineSolanaRequest({
        action: brokenSolanaAction,
        option: solOption,
      }),
    ).not.toThrow();
    expect(
      getWcPayInlineSolanaRequest({
        action: brokenSolanaAction,
        option: solOption,
      }),
    ).toEqual({ mode: 'fallback', reason: 'unparseable params' });
  });

  it.each(MALFORMED_ACTIONS)(
    'falls back without throwing on %s',
    (_label, action) => {
      const call = () =>
        getWcPayInlineSolanaRequest({ action, option: solOption });
      expect(call).not.toThrow();
      expect(call()).toEqual({ mode: 'fallback', reason: 'malformed action' });
    },
  );

  // The chain reaches the background as the validator's own chain input, so
  // a non-string one is refused here rather than sent on.
  it.each([
    ['a numeric chainId', 7 as unknown as string],
    ['a missing chainId', undefined as unknown as string],
    ['an object chainId', {} as unknown as string],
    ['an empty chainId', ''],
  ])('falls back on %s', (_label, chainId) => {
    expect(
      getWcPayInlineSolanaRequest({
        action: {
          walletRpc: {
            chainId,
            method: 'solana_signTransaction',
            params: JSON.stringify([{ transaction: TX_BASE64 }]),
          },
        },
        option: solOption,
      }),
    ).toEqual({ mode: 'fallback', reason: 'malformed action' });
  });

  it('refuses an oversize blob before it crosses the proxy', () => {
    expect(
      getWcPayInlineSolanaRequest({
        action: {
          walletRpc: {
            chainId: SOLANA_CHAIN,
            method: 'solana_signTransaction',
            params: JSON.stringify([{ transaction: 'A'.repeat(200_000) }]),
          },
        },
        option: solOption,
      }),
    ).toEqual({ mode: 'fallback', reason: 'transaction too large' });
  });
});

describe('getWcPayInlineSolanaPlan', () => {
  const okNative: IWcPaySolanaConsistencyResult = {
    ok: true,
    summary: nativeSummary,
  };
  const okSpl: IWcPaySolanaConsistencyResult = {
    ok: true,
    summary: splSummary,
  };

  it('carries a background refusal reason through', () => {
    expect(
      getWcPayInlineSolanaPlan({
        option: solOption,
        txBase64: TX_BASE64,
        consistency: { ok: false, reason: 'amount mismatch' },
      }),
    ).toEqual({ mode: 'fallback', reason: 'amount mismatch' });
  });

  it('inlines a native leg and carries the summary and the blob', () => {
    expect(
      getWcPayInlineSolanaPlan({
        option: solOption,
        txBase64: TX_BASE64,
        consistency: okNative,
      }),
    ).toEqual({ mode: 'inline', summary: nativeSummary, txBase64: TX_BASE64 });
  });

  // An spl leg's mint is only an address until the wallet's own registry
  // agrees it is the asset the option displays (the background validator
  // never resolves a symbol — see its asset-identity note).
  it('falls back when an spl mint is unknown to the wallet registry', () => {
    expect(
      getWcPayInlineSolanaPlan({
        option: usdcSolOption,
        txBase64: TX_BASE64,
        consistency: okSpl,
      }),
    ).toEqual({ mode: 'fallback', reason: 'unknown token' });
  });

  it.each([
    [
      'the address',
      {
        address: 'So11111111111111111111111111111111111111112',
        symbol: 'USDC',
        decimals: 6,
      },
      'token address mismatch',
    ],
    [
      'the symbol',
      { address: USDC_MINT, symbol: 'USDT', decimals: 6 },
      'token symbol mismatch',
    ],
    [
      'the decimals',
      { address: USDC_MINT, symbol: 'USDC', decimals: 9 },
      'token decimals mismatch',
    ],
  ])(
    'falls back when the resolved token disagrees on %s',
    (_label, resolvedToken, reason) => {
      expect(
        getWcPayInlineSolanaPlan({
          option: usdcSolOption,
          txBase64: TX_BASE64,
          consistency: okSpl,
          resolvedToken,
        }),
      ).toEqual({ mode: 'fallback', reason });
    },
  );

  // The verdict now crosses a serialization boundary, so the option this
  // side holds may be shaped worse than the one the validator saw. A
  // matching resolvedToken is what carries these cases past the earlier
  // refusals and into the option reads.
  it.each([
    ['no amount', { ...usdcSolOption, amount: undefined as never }],
    ['no option at all', undefined as unknown as IWcPayOption],
    ['a null option', null as unknown as IWcPayOption],
  ])('falls back without throwing on %s', (_label, hostileOption) => {
    const call = () =>
      getWcPayInlineSolanaPlan({
        option: hostileOption,
        txBase64: TX_BASE64,
        consistency: okSpl,
        resolvedToken: { address: USDC_MINT, symbol: 'USDC', decimals: 6 },
      });
    expect(call).not.toThrow();
    expect(call()).toEqual({
      mode: 'fallback',
      reason: 'token symbol mismatch',
    });
  });

  // The verdict is built in the background and reaches this side through
  // the proxy, so its envelope is no more trustworthy than its payload.
  it.each([
    ['a verdict that lost its summary', { ok: true } as never],
    ['a verdict whose summary is null', { ok: true, summary: null } as never],
    ['no verdict at all', undefined as never],
    // fail-open guard: an unrecognized kind must not be treated as native,
    // which would inline a payment whose amount this side never saw
    ['a summary with no kind', { ok: true, summary: {} } as never],
    [
      'a summary with an unknown kind',
      { ok: true, summary: { kind: 'weird', amountRaw: '1' } } as never,
    ],
    [
      'a summary with a non-string amount',
      { ok: true, summary: { kind: 'native', amountRaw: 1500 } } as never,
    ],
  ])('falls back without throwing on %s', (_label, consistency) => {
    const call = () =>
      getWcPayInlineSolanaPlan({
        option: usdcSolOption,
        txBase64: TX_BASE64,
        consistency,
      });
    expect(call).not.toThrow();
    expect(call()).toEqual({ mode: 'fallback', reason: 'invalid verdict' });
  });

  it('names a reasonless refusal rather than reporting an empty reason', () => {
    expect(
      getWcPayInlineSolanaPlan({
        option: usdcSolOption,
        txBase64: TX_BASE64,
        consistency: { ok: false } as never,
      }),
    ).toEqual({ mode: 'fallback', reason: 'invalid verdict' });
  });

  it('inlines an spl leg the registry agrees with', () => {
    expect(
      getWcPayInlineSolanaPlan({
        option: usdcSolOption,
        txBase64: TX_BASE64,
        consistency: okSpl,
        resolvedToken: { address: USDC_MINT, symbol: 'USDC', decimals: 6 },
      }),
    ).toEqual({ mode: 'inline', summary: splSummary, txBase64: TX_BASE64 });
  });
});

describe('classifyWcPayInlineFailure', () => {
  it('maps the estimate stage to feeEstimateFailed', () => {
    expect(
      classifyWcPayInlineFailure({
        stage: 'estimate',
        error: new Error('rpc down'),
      }).kind,
    ).toBe(EWcPayInlineFailureKind.FeeEstimateFailed);
  });

  it('maps the backup stage to walletNotBackedUp', () => {
    expect(
      classifyWcPayInlineFailure({
        stage: 'backup',
        error: new Error('Wallet is not backed up'),
      }).kind,
    ).toBe(EWcPayInlineFailureKind.WalletNotBackedUp);
  });

  it('maps the balance stage to insufficientBalance', () => {
    expect(
      classifyWcPayInlineFailure({
        stage: 'balance',
        error: new Error('no gas'),
      }).kind,
    ).toBe(EWcPayInlineFailureKind.InsufficientBalance);
  });

  it('maps the precheck stage to preSignBlocked (caller falls back)', () => {
    expect(
      classifyWcPayInlineFailure({
        stage: 'precheck',
        error: new Error('no gas'),
      }).kind,
    ).toBe(EWcPayInlineFailureKind.PreSignBlocked);
  });

  it('maps the send stage to sendFailed', () => {
    expect(
      classifyWcPayInlineFailure({ stage: 'send', error: new Error('nope') })
        .kind,
    ).toBe(EWcPayInlineFailureKind.SendFailed);
  });

  it('maps prepare stage to preSignBlocked (caller falls back)', () => {
    expect(
      classifyWcPayInlineFailure({ stage: 'prepare', error: new Error('x') })
        .kind,
    ).toBe(EWcPayInlineFailureKind.PreSignBlocked);
  });

  it('passes through an Error message', () => {
    expect(
      classifyWcPayInlineFailure({
        stage: 'send',
        error: new Error('insufficient funds for gas'),
      }).message,
    ).toBe('insufficient funds for gas');
  });

  it('preserves a thrown string error', () => {
    expect(
      classifyWcPayInlineFailure({ stage: 'send', error: 'user rejected' })
        .message,
    ).toBe('user rejected');
  });

  it('falls back to a generic message for an empty Error message', () => {
    expect(
      classifyWcPayInlineFailure({ stage: 'send', error: new Error('') })
        .message,
    ).toBe('Something went wrong');
  });

  it('falls back to a generic message for undefined error', () => {
    expect(
      classifyWcPayInlineFailure({ stage: 'send', error: undefined }).message,
    ).toBe('Something went wrong');
  });

  it('marks the estimate stage retryable and every other stage not', () => {
    const stages: IWcPayInlineStage[] = [
      'backup',
      'estimate',
      'balance',
      'precheck',
      'prepare',
      'send',
    ];
    const retryable = stages.filter(
      (stage) =>
        classifyWcPayInlineFailure({ stage, error: new Error('x') }).retryable,
    );
    expect(retryable).toEqual(['estimate']);
  });
});

describe('isWcPayInlinePostSignError', () => {
  it('detects a tagged error', () => {
    const error = new Error('broadcast rejected');
    (error as unknown as Record<string, unknown>)[
      WC_PAY_INLINE_POST_SIGN_FLAG
    ] = true;
    expect(isWcPayInlinePostSignError(error)).toBe(true);
  });

  it('rejects an untagged error and non-object throws', () => {
    expect(isWcPayInlinePostSignError(new Error('expired'))).toBe(false);
    expect(isWcPayInlinePostSignError('user rejected')).toBe(false);
    expect(isWcPayInlinePostSignError(undefined)).toBe(false);
    expect(isWcPayInlinePostSignError(null)).toBe(false);
  });
});

describe('runWcPayInlineAttempts', () => {
  const feeFailure: IWcPayInlineFailure = {
    kind: EWcPayInlineFailureKind.FeeEstimateFailed,
    message: 'rpc down',
    retryable: true,
  };
  const balanceFailure: IWcPayInlineFailure = {
    kind: EWcPayInlineFailureKind.InsufficientBalance,
    message: 'not enough USDC',
    retryable: false,
  };
  // Decisions are consumed in order; the last one repeats for every further
  // failure, so a single argument means "always decide this".
  const buildController = (
    ...decisions: ('retry' | 'fallback' | 'abort')[]
  ) => {
    const onInlineFailure = jest.fn<
      Promise<'retry' | 'fallback' | 'abort'>,
      [IWcPayInlineFailure]
    >();
    decisions.forEach((decision, index) => {
      if (index === decisions.length - 1) {
        onInlineFailure.mockResolvedValue(decision);
      } else {
        onInlineFailure.mockResolvedValueOnce(decision);
      }
    });
    return { onPhase: jest.fn(), onInlineFailure, onFallback: jest.fn() };
  };

  it('returns the txid of a successful attempt', async () => {
    const controller = buildController('fallback');
    const run = jest
      .fn<Promise<IWcPayInlineSendResult>, []>()
      .mockResolvedValue({ status: 'ok', txid: '0xabc' });

    await expect(runWcPayInlineAttempts({ controller, run })).resolves.toEqual({
      status: 'ok',
      txid: '0xabc',
    });
    expect(run).toHaveBeenCalledTimes(1);
    expect(controller.onInlineFailure).not.toHaveBeenCalled();
    expect(controller.onFallback).not.toHaveBeenCalled();
  });

  it('re-runs the attempt when a fee-estimate failure is retried', async () => {
    const controller = buildController('retry', 'fallback');
    const run = jest
      .fn<Promise<IWcPayInlineSendResult>, []>()
      .mockResolvedValueOnce({ status: 'inlineError', failure: feeFailure })
      .mockResolvedValueOnce({ status: 'ok', txid: '0xdef' });

    await expect(runWcPayInlineAttempts({ controller, run })).resolves.toEqual({
      status: 'ok',
      txid: '0xdef',
    });
    expect(run).toHaveBeenCalledTimes(2);
    expect(controller.onInlineFailure).toHaveBeenCalledTimes(1);
    expect(controller.onInlineFailure).toHaveBeenCalledWith(feeFailure);
  });

  it('falls back after a single attempt when the fee failure is not retried', async () => {
    const controller = buildController('fallback');
    const run = jest
      .fn<Promise<IWcPayInlineSendResult>, []>()
      .mockResolvedValue({ status: 'inlineError', failure: feeFailure });

    await expect(runWcPayInlineAttempts({ controller, run })).resolves.toEqual({
      status: 'fallback',
    });
    expect(run).toHaveBeenCalledTimes(1);
    expect(controller.onFallback).toHaveBeenCalledTimes(1);
  });

  it('aborts when the controller aborts on insufficient balance', async () => {
    const controller = buildController('abort');
    const run = jest
      .fn<Promise<IWcPayInlineSendResult>, []>()
      .mockResolvedValue({ status: 'inlineError', failure: balanceFailure });

    await expect(runWcPayInlineAttempts({ controller, run })).resolves.toEqual({
      status: 'abort',
    });
    expect(run).toHaveBeenCalledTimes(1);
    expect(controller.onFallback).not.toHaveBeenCalled();
  });

  it('stops retrying once the retry budget is spent', async () => {
    const controller = buildController('retry');
    const run = jest
      .fn<Promise<IWcPayInlineSendResult>, []>()
      .mockResolvedValue({ status: 'inlineError', failure: feeFailure });

    await expect(runWcPayInlineAttempts({ controller, run })).resolves.toEqual({
      status: 'fallback',
    });
    // the default budget is 2 RE-RUNS, so three attempts in total
    expect(run).toHaveBeenCalledTimes(3);
    // the exhaustion exit is decided by the loop, not the controller, so this
    // is the announcement the page has no other way to hear
    expect(controller.onFallback).toHaveBeenCalledTimes(1);
  });

  it('honours an explicit retry budget', async () => {
    const controller = buildController('retry');
    const run = jest
      .fn<Promise<IWcPayInlineSendResult>, []>()
      .mockResolvedValue({ status: 'inlineError', failure: feeFailure });

    await expect(
      runWcPayInlineAttempts({ controller, run, maxRetries: 0 }),
    ).resolves.toEqual({ status: 'fallback' });
    expect(run).toHaveBeenCalledTimes(1);
    expect(controller.onFallback).toHaveBeenCalledTimes(1);
  });

  it('degrades a retry of a non-retryable failure to a fallback, running once', async () => {
    const controller = buildController('retry');
    const run = jest
      .fn<Promise<IWcPayInlineSendResult>, []>()
      .mockResolvedValue({ status: 'inlineError', failure: balanceFailure });

    await expect(runWcPayInlineAttempts({ controller, run })).resolves.toEqual({
      status: 'fallback',
    });
    expect(run).toHaveBeenCalledTimes(1);
    expect(controller.onFallback).toHaveBeenCalledTimes(1);
  });

  it('routes a pipeline fallback result through the controller too', async () => {
    const controller = buildController('fallback');
    const failure: IWcPayInlineFailure = {
      kind: EWcPayInlineFailureKind.PreSignBlocked,
      message: 'wallet not backed up',
      retryable: false,
    };
    const run = jest
      .fn<Promise<IWcPayInlineSendResult>, []>()
      .mockResolvedValue({ status: 'fallback', failure });

    await expect(runWcPayInlineAttempts({ controller, run })).resolves.toEqual({
      status: 'fallback',
    });
    expect(controller.onInlineFailure).toHaveBeenCalledWith(failure);
    expect(controller.onFallback).toHaveBeenCalledTimes(1);
  });

  it('propagates a thrown pipeline error without consulting the controller', async () => {
    const controller = buildController('fallback');
    const thrown = new Error('signing failed');
    const run = jest
      .fn<Promise<IWcPayInlineSendResult>, []>()
      .mockRejectedValue(thrown);

    await expect(runWcPayInlineAttempts({ controller, run })).rejects.toBe(
      thrown,
    );
    expect(controller.onInlineFailure).not.toHaveBeenCalled();
    expect(controller.onFallback).not.toHaveBeenCalled();
  });
});

describe('nextWcPayPagePhaseAfterAttempt', () => {
  it('keeps a terminal result phase, by reference', () => {
    const prev = {
      name: 'result' as const,
      params: { paymentId: 'pay-1', optionId: 'opt-1' },
    };
    // identity matters: a rebuilt object would re-render the result view and
    // restart its polling identity
    expect(nextWcPayPagePhaseAfterAttempt(prev)).toBe(prev);
  });

  it('returns to idle from every non-terminal phase', () => {
    expect(nextWcPayPagePhaseAfterAttempt({ name: 'idle' as const })).toEqual({
      name: 'idle',
    });
    expect(
      nextWcPayPagePhaseAfterAttempt({
        name: 'paying' as const,
        step: 'signing' as const,
      }),
    ).toEqual({ name: 'idle' });
  });
});

// Shared by every headless signing leg (typed data, Solana sign-only), so it
// is pinned here directly rather than only through the pipelines that use it.
describe('isWcPayInlineUserCancel', () => {
  it('recognizes a dismissed password prompt', () => {
    expect(isWcPayInlineUserCancel(new PasswordPromptDialogCancel())).toBe(
      true,
    );
  });

  // The AirGap QR flow's own dismissal, raised by
  // AirGapQrcodeDialogContainer when the scanner dialog is closed.
  it('recognizes a closed AirGap QR dialog', () => {
    expect(isWcPayInlineUserCancel(new SecureQRCodeDialogCancel())).toBe(true);
  });

  it.each<[string, number]>([
    ['ActionCancelled', HardwareErrorCode.ActionCancelled],
    ['PinCancelled', HardwareErrorCode.PinCancelled],
    ['CallQueueActionCancelled', HardwareErrorCode.CallQueueActionCancelled],
    ['DeviceInterruptedFromUser', HardwareErrorCode.DeviceInterruptedFromUser],
    [
      'DeviceInterruptedFromOutside',
      HardwareErrorCode.DeviceInterruptedFromOutside,
    ],
  ])('recognizes hardware %s', (_name, code) => {
    expect(
      isWcPayInlineUserCancel(
        Object.assign(new Error('cancelled on device'), {
          className: EOneKeyErrorClassNames.OneKeyHardwareError,
          code,
        }),
      ),
    ).toBe(true);
  });

  // There is no `HardwareErrorCode.UserCancelFromOutside`; the real error is
  // this class, which carries DeviceInterruptedFromOutside. Constructed for
  // real so the coverage claim rests on the shipped definition, not a fixture.
  //
  // Both runtime shapes are asserted because they take different routes
  // through the detector. Desktop and web run bg and main in one runtime, so
  // the live instance arrives intact. On iOS, Android and the extension the
  // rejection crosses the bridge as a plain object: `instanceof` and the
  // `$isHardwareError` own property are both gone, and this class overrides
  // `className` to HardwareUserCancelFromOutside — so nothing identifies it
  // as a hardware error any more and its code is never consulted. Only the
  // className entry catches that form.
  it.each<[string, () => unknown]>([
    ['as a live instance', () => new UserCancelFromOutside()],
    [
      'after crossing the bridge as a plain object',
      () => toPlainErrorObject(new UserCancelFromOutside()),
    ],
  ])('recognizes UserCancelFromOutside %s', (_name, build) => {
    expect(isWcPayInlineUserCancel(build())).toBe(true);
  });

  // The counterpart that still works on codes alone: PinCancelled does not
  // override className, so the plain object keeps `OneKeyHardwareError` and
  // stays recognizable as a hardware error across the bridge.
  it('recognizes a bridged PinCancelled through its surviving hardware class', () => {
    const plain = toPlainErrorObject(new PinCancelled());
    expect(plain.className).toBe(EOneKeyErrorClassNames.OneKeyHardwareError);
    expect(isWcPayInlineUserCancel(plain)).toBe(true);
  });

  // The rule under test: classification comes from the class and the code,
  // never from the message text, which is localized and vendor-supplied.
  it('recognizes a cancellation whose message never mentions cancelling', () => {
    expect(
      isWcPayInlineUserCancel(
        Object.assign(new Error('hd bridge returned 803'), {
          className: EOneKeyErrorClassNames.OneKeyHardwareError,
          code: HardwareErrorCode.ActionCancelled,
        }),
      ),
    ).toBe(true);
  });

  it('does not claim a rejection-sounding message was a cancellation', () => {
    expect(
      isWcPayInlineUserCancel(new Error('User rejected the request')),
    ).toBe(false);
  });

  it('does not treat a non-cancel hardware code as a cancellation', () => {
    expect(
      isWcPayInlineUserCancel(
        Object.assign(new Error('device not found'), {
          className: EOneKeyErrorClassNames.OneKeyHardwareError,
          code: HardwareErrorCode.DeviceNotFound,
        }),
      ),
    ).toBe(false);
  });

  it('does not claim a plain failure was a cancellation', () => {
    expect(isWcPayInlineUserCancel(new Error('keyring exploded'))).toBe(false);
  });

  it('returns a boolean for a missing error rather than propagating it', () => {
    expect(isWcPayInlineUserCancel(undefined)).toBe(false);
  });
});

describe('getWcPayInlinePersonalSignPlan', () => {
  const buildPersonalSignAction = (params: unknown[]): IWcPayAction => ({
    walletRpc: {
      chainId: 'eip155:8453',
      method: 'personal_sign',
      params: JSON.stringify(params),
    },
  });
  const textToHex = (text: string) =>
    `0x${Buffer.from(text, 'utf8').toString('hex')}`;
  const plan = (action: IWcPayAction, opt: IWcPayOption | undefined = option) =>
    getWcPayInlinePersonalSignPlan({
      action,
      option: opt,
      accountAddress: SENDER,
    });

  it('inlines a hex-encoded UTF-8 message and carries its decode', () => {
    const action = buildPersonalSignAction([
      textToHex('Pay order #123'),
      SENDER,
    ]);
    expect(plan(action)).toEqual({
      mode: 'inline',
      summary: { text: 'Pay order #123' },
      message: textToHex('Pay order #123'),
    });
  });

  it('inlines a plain-text message as-is', () => {
    const action = buildPersonalSignAction(['hello merchant', SENDER]);
    expect(plan(action)).toEqual({
      mode: 'inline',
      summary: { text: 'hello merchant' },
      message: 'hello merchant',
    });
  });

  it('inlines multi-line text with tabs and newlines', () => {
    const text = 'line one\n\tline two\r\nline three';
    const action = buildPersonalSignAction([textToHex(text), SENDER]);
    expect(plan(action)).toEqual({
      mode: 'inline',
      summary: { text },
      message: textToHex(text),
    });
  });

  it('refuses a binary blob', () => {
    const action = buildPersonalSignAction(['0x0001020304050607', SENDER]);
    expect(plan(action)).toEqual({
      mode: 'fallback',
      reason: 'undisplayable message',
    });
  });

  it('refuses text containing a bare control character', () => {
    // BEL (U+0007) embedded in otherwise-normal text
    const action = buildPersonalSignAction([
      textToHex(`ding${String.fromCharCode(7)}dong`),
      SENDER,
    ]);
    expect(plan(action)).toEqual({
      mode: 'fallback',
      reason: 'undisplayable message',
    });
  });

  it('refuses invalid UTF-8 hex', () => {
    // 0xc3 opens a two-byte sequence that never completes
    const action = buildPersonalSignAction(['0xc3c3', SENDER]);
    expect(plan(action)).toEqual({
      mode: 'fallback',
      reason: 'undisplayable message',
    });
  });

  it('refuses an oversized message', () => {
    const action = buildPersonalSignAction([
      textToHex('a'.repeat(5000)),
      SENDER,
    ]);
    expect(plan(action)).toEqual({
      mode: 'fallback',
      reason: 'message too long',
    });
  });

  it('refuses an empty or whitespace-only message', () => {
    expect(
      plan(buildPersonalSignAction([textToHex('   \n '), SENDER])),
    ).toEqual({ mode: 'fallback', reason: 'undisplayable message' });
    expect(plan(buildPersonalSignAction(['0x', SENDER]))).toEqual({
      mode: 'fallback',
      reason: 'undisplayable message',
    });
  });

  it('refuses a non-personal_sign method by name', () => {
    expect(plan(nativeAction)).toEqual({
      mode: 'fallback',
      reason: 'method eth_sendTransaction',
    });
  });

  it('refuses when no option is selected', () => {
    const action = buildPersonalSignAction([textToHex('hi there'), SENDER]);
    expect(
      getWcPayInlinePersonalSignPlan({
        action,
        option: undefined,
        accountAddress: SENDER,
      }),
    ).toEqual({
      mode: 'fallback',
      reason: 'no selected option',
    });
  });

  it('refuses unparseable params without throwing', () => {
    const action: IWcPayAction = {
      walletRpc: {
        chainId: 'eip155:8453',
        method: 'personal_sign',
        params: 'not-json',
      },
    };
    expect(() => plan(action)).not.toThrow();
    expect(plan(action)).toEqual({
      mode: 'fallback',
      reason: 'unparseable params',
    });
  });

  it.each(MALFORMED_ACTIONS)('refuses %s', (_label, action) => {
    expect(plan(action)).toEqual({
      mode: 'fallback',
      reason: 'malformed action',
    });
  });
});

describe('isWcPayUnlimitedApproveAmount', () => {
  const PERMIT2_WORD = '000000000022d473030f116ddee9f6b43ac78ba3'.padStart(
    64,
    '0',
  );

  it('recognizes the customary max-uint approve', () => {
    expect(
      isWcPayUnlimitedApproveAmount(
        `0x095ea7b3${PERMIT2_WORD}${'f'.repeat(64)}`,
      ),
    ).toBe(true);
  });

  it('treats a finite amount as limited', () => {
    expect(
      isWcPayUnlimitedApproveAmount(
        `0x095ea7b3${PERMIT2_WORD}${(1_000_000).toString(16).padStart(64, '0')}`,
      ),
    ).toBe(false);
  });

  it('treats missing or malformed calldata as limited', () => {
    expect(isWcPayUnlimitedApproveAmount(undefined)).toBe(false);
    expect(isWcPayUnlimitedApproveAmount('0x')).toBe(false);
  });
});

describe('review-hardening: unlimited threshold and displayability', () => {
  const PERMIT2_WORD = '000000000022d473030f116ddee9f6b43ac78ba3'.padStart(
    64,
    '0',
  );
  const approveDataWithAmountWord = (word: string) =>
    `0x095ea7b3${PERMIT2_WORD}${word}`;

  it('flags a near-max allowance as unlimited for disclosure', () => {
    // 2^256 - 2: not the customary max-uint word, every bit as unbounded
    expect(
      isWcPayUnlimitedApproveAmount(
        approveDataWithAmountWord(`${'f'.repeat(63)}e`),
      ),
    ).toBe(true);
    // 2^128 exactly: first of the flagged range
    expect(
      isWcPayUnlimitedApproveAmount(
        approveDataWithAmountWord(`${'0'.repeat(31)}1${'0'.repeat(32)}`),
      ),
    ).toBe(true);
    // 2^128 - 1: largest amount still presented as bounded
    expect(
      isWcPayUnlimitedApproveAmount(
        approveDataWithAmountWord(`${'0'.repeat(32)}${'f'.repeat(32)}`),
      ),
    ).toBe(false);
  });

  it('refuses an odd-nibble hex personal_sign message', () => {
    // Buffer would drop the tail nibble while the signer pads it — the
    // display and the signature would disagree about the bytes.
    const action: IWcPayAction = {
      walletRpc: {
        chainId: 'eip155:8453',
        method: 'personal_sign',
        params: JSON.stringify(['0x616', SENDER]),
      },
    };
    expect(
      getWcPayInlinePersonalSignPlan({
        action,
        option,
        accountAddress: SENDER,
      }),
    ).toEqual({ mode: 'fallback', reason: 'undisplayable message' });
  });

  it('refuses bidi and zero-width characters in a personal_sign message', () => {
    const bidiOverride = String.fromCharCode(0x20_2e);
    const zeroWidth = String.fromCharCode(0x20_0b);
    for (const poison of [bidiOverride, zeroWidth]) {
      const text = `Pay 10 USDC${poison}to merchant`;
      const hex = `0x${Buffer.from(text, 'utf8').toString('hex')}`;
      const action: IWcPayAction = {
        walletRpc: {
          chainId: 'eip155:8453',
          method: 'personal_sign',
          params: JSON.stringify([hex, SENDER]),
        },
      };
      expect(
        getWcPayInlinePersonalSignPlan({
          action,
          option,
          accountAddress: SENDER,
        }),
      ).toEqual({ mode: 'fallback', reason: 'undisplayable message' });
    }
  });

  it('refuses format, private-use, unassigned and filler characters', () => {
    // Each of these renders as nothing in the sheet, so its bytes would be
    // signed without ever being shown: the soft hyphen, the Arabic letter
    // mark (a bidi control the enumerated set missed), the Mongolian vowel
    // separator, the tag block, a private-use code point, a non-character,
    // and the Hangul fillers (letters by category, blank on screen).
    const poisons = [
      '\u00AD',
      '\u061C',
      '\u180E',
      '\u{E0001}',
      '\u{E0041}',
      '\uE000',
      '\uFFFE',
      '\u115F',
      '\u3164',
      '\uFFA0',
    ];
    for (const poison of poisons) {
      const text = `Pay 10 USDC${poison}to merchant`;
      const hex = `0x${Buffer.from(text, 'utf8').toString('hex')}`;
      const action: IWcPayAction = {
        walletRpc: {
          chainId: 'eip155:8453',
          method: 'personal_sign',
          params: JSON.stringify([hex, SENDER]),
        },
      };
      expect(
        getWcPayInlinePersonalSignPlan({
          action,
          option,
          accountAddress: SENDER,
        }),
      ).toEqual({ mode: 'fallback', reason: 'undisplayable message' });
    }
  });

  it('refuses a message whose signed bytes exceed its visible text', () => {
    // The visible line is a benign sign-in; an authorization rides behind
    // it in tag characters, which decode losslessly and round-trip, so only
    // the character class can catch that the signed bytes are a strict
    // superset of what the sheet shows.
    const visible = 'Sign in to pay.walletconnect.com';
    const smuggled = Array.from('I authorize a transfer', (char) =>
      String.fromCodePoint(0xe_00_00 + char.charCodeAt(0)),
    ).join('');
    const hex = `0x${Buffer.from(visible + smuggled, 'utf8').toString('hex')}`;
    const action: IWcPayAction = {
      walletRpc: {
        chainId: 'eip155:8453',
        method: 'personal_sign',
        params: JSON.stringify([hex, SENDER]),
      },
    };
    expect(
      getWcPayInlinePersonalSignPlan({
        action,
        option,
        accountAddress: SENDER,
      }),
    ).toEqual({ mode: 'fallback', reason: 'undisplayable message' });
  });

  it('refuses messages that outgrow the sheet or pad a fake end of message', () => {
    const plan = (text: string) =>
      getWcPayInlinePersonalSignPlan({
        action: {
          walletRpc: {
            chainId: 'eip155:8453',
            method: 'personal_sign',
            params: JSON.stringify([text, SENDER]),
          },
        },
        option,
        accountAddress: SENDER,
      });
    const refused = { mode: 'fallback', reason: 'undisplayable message' };
    // the tail can be hidden behind blank lines, behind many short lines
    // (no blank line anywhere) or behind one very long line: the size
    // bounds catch all three shapes
    for (const padded of [
      `Order #123${'\n'.repeat(200)}I authorize a transfer`,
      `Order #123${'.\n'.repeat(1000)}I authorize a transfer of all funds`,
      `Order #123${'.'.repeat(3900)}I authorize a transfer of all funds`,
      `Order #123\n${'x\n'.repeat(WC_PAY_PERSONAL_SIGN_MAX_LINES)}tail`,
      'x'.repeat(WC_PAY_PERSONAL_SIGN_MAX_CHARS + 1),
      // three blank lines inside the bounds still read as a fake end
      'Order #123\n \n \n \nI authorize a transfer',
      `Order #123${' '.repeat(64)}I authorize a transfer`,
      `Order #123${'\t'.repeat(40)}I authorize a transfer`,
      `Order #123${'\u3000'.repeat(40)}I authorize a transfer`,
    ]) {
      expect(plan(padded)).toEqual(refused);
    }
    // sign-in style blank lines and modest column alignment are content;
    // an EIP-4361 message without a statement is `address LF LF LF "URI: "`
    for (const legit of [
      'pay.walletconnect.com wants you to sign in\n\nURI: https://pay.walletconnect.com\r\nAmount:          10 USDC\n\nNonce: 8f2a',
      `pay.walletconnect.com wants you to sign in with your Ethereum account:\n${SENDER}\n\n\nURI: https://pay.walletconnect.com\nVersion: 1\nChain ID: 8453\nNonce: 8f2a\nIssued At: 2026-09-04T00:00:00Z`,
      'x'.repeat(WC_PAY_PERSONAL_SIGN_MAX_CHARS),
      `${'x\n'.repeat(WC_PAY_PERSONAL_SIGN_MAX_LINES - 1)}x`,
    ]) {
      expect(plan(legit)).toEqual({
        mode: 'inline',
        summary: { text: legit },
        message: legit,
      });
    }
  });

  it('keeps emoji and CJK text displayable', () => {
    // the category switch must not start refusing ordinary international
    // text: letters, symbols, an emoji with a variation selector, a skin
    // tone modifier and a regional-indicator flag all render
    const text =
      '支付订单 #123 ¡Gracias! Ünïcödé ☕\uFE0F \u{1F44D}\u{1F3FB} \u{1F1FA}\u{1F1F8}';
    const hex = `0x${Buffer.from(text, 'utf8').toString('hex')}`;
    const action: IWcPayAction = {
      walletRpc: {
        chainId: 'eip155:8453',
        method: 'personal_sign',
        params: JSON.stringify([hex, SENDER]),
      },
    };
    expect(
      getWcPayInlinePersonalSignPlan({
        action,
        option,
        accountAddress: SENDER,
      }),
    ).toEqual({ mode: 'inline', summary: { text }, message: hex });
  });

  it('sanitizeWcPayDisplayText strips forbidden characters and bounds length', () => {
    const poisoned = `USD${String.fromCharCode(0x20_2e)}C`;
    expect(sanitizeWcPayDisplayText(poisoned, 12)).toBe('USDC');
    // a soft hyphen and a tag-block letter are as invisible as a bidi mark
    expect(sanitizeWcPayDisplayText('US\u00ADD\u{E0041}C', 12)).toBe('USDC');
    expect(sanitizeWcPayDisplayText('A'.repeat(20), 12)).toBe(
      `${'A'.repeat(12)}…`,
    );
  });
});
