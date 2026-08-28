import type { IWcPaySolanaConsistencyResult } from '@onekeyhq/kit-bg/src/services/ServiceWalletConnectPay/wcPaySolanaConsistency';
import type {
  IWcPayAction,
  IWcPayOption,
} from '@onekeyhq/shared/src/walletConnect/payTypes';

import {
  EWcPayInlineFailureKind,
  WC_PAY_INLINE_POST_SIGN_FLAG,
  classifyWcPayInlineFailure,
  getWcPayInlineMessagePlan,
  getWcPayInlineSolanaPlan,
  getWcPayInlineSolanaRequest,
  getWcPayInlineTxPlan,
  isWcPayInlinePostSignError,
  nextWcPayPagePhaseAfterAttempt,
  runWcPayInlineAttempts,
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

// An action shaped like a server response that lost its walletRpc payload:
// every plan must refuse it instead of throwing.
const malformedAction: IWcPayAction = { walletRpc: undefined as never };

describe('getWcPayInlineTxPlan', () => {
  it('inlines a matching transfer action regardless of sequence length', () => {
    expect(getWcPayInlineTxPlan({ action: nativeAction, option })).toEqual({
      mode: 'inline',
    });
  });

  it('falls back for a non-transfer method and without an option', () => {
    expect(getWcPayInlineTxPlan({ action: signAction, option })).toEqual({
      mode: 'fallback',
      reason: 'method personal_sign',
    });
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

  it('falls back without throwing on a malformed action', () => {
    expect(() =>
      getWcPayInlineTxPlan({ action: malformedAction, option }),
    ).not.toThrow();
    expect(getWcPayInlineTxPlan({ action: malformedAction, option })).toEqual({
      mode: 'fallback',
      reason: 'malformed action',
    });
    const missingAction = null as unknown as IWcPayAction;
    expect(() =>
      getWcPayInlineTxPlan({ action: missingAction, option }),
    ).not.toThrow();
    expect(getWcPayInlineTxPlan({ action: missingAction, option })).toEqual({
      mode: 'fallback',
      reason: 'malformed action',
    });
  });
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

  it('falls back without throwing on a malformed action', () => {
    expect(() =>
      getWcPayInlineMessagePlan({
        action: malformedAction,
        option: permitOption,
        nowMs: NOW_MS,
        resolvedToken,
      }),
    ).not.toThrow();
    expect(
      getWcPayInlineMessagePlan({
        action: malformedAction,
        option: permitOption,
        nowMs: NOW_MS,
        resolvedToken,
      }).mode,
    ).toBe('fallback');
  });
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
  fundsRecipientAta: false,
};
const splSummary = {
  amountRaw: '100000',
  kind: 'spl' as const,
  mint: USDC_MINT,
  decimals: 6,
  priorityFeeLamports: '0',
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

  it('falls back without throwing on a malformed action', () => {
    expect(() =>
      getWcPayInlineSolanaRequest({
        action: malformedAction,
        option: solOption,
      }),
    ).not.toThrow();
    expect(
      getWcPayInlineSolanaRequest({
        action: malformedAction,
        option: solOption,
      }).mode,
    ).toBe('fallback');
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

  it('falls back when the resolved token disagrees with the mint or option', () => {
    expect(
      getWcPayInlineSolanaPlan({
        option: usdcSolOption,
        txBase64: TX_BASE64,
        consistency: okSpl,
        resolvedToken: {
          address: 'So11111111111111111111111111111111111111112',
          symbol: 'USDC',
          decimals: 6,
        },
      }),
    ).toEqual({ mode: 'fallback', reason: 'token address mismatch' });
    expect(
      getWcPayInlineSolanaPlan({
        option: usdcSolOption,
        txBase64: TX_BASE64,
        consistency: okSpl,
        resolvedToken: { address: USDC_MINT, symbol: 'USDT', decimals: 6 },
      }),
    ).toEqual({ mode: 'fallback', reason: 'token symbol mismatch' });
    expect(
      getWcPayInlineSolanaPlan({
        option: usdcSolOption,
        txBase64: TX_BASE64,
        consistency: okSpl,
        resolvedToken: { address: USDC_MINT, symbol: 'USDC', decimals: 9 },
      }),
    ).toEqual({ mode: 'fallback', reason: 'token decimals mismatch' });
  });

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
