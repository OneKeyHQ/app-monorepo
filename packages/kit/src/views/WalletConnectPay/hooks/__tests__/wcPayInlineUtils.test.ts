import type {
  IWcPayAction,
  IWcPayOption,
} from '@onekeyhq/shared/src/walletConnect/payTypes';

import {
  EWcPayInlineFailureKind,
  WC_PAY_INLINE_POST_SIGN_FLAG,
  classifyWcPayInlineFailure,
  getWcPayInlinePlan,
  isWcPayInlinePostSignError,
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

describe('getWcPayInlinePlan', () => {
  it('inlines a single matching eth_sendTransaction', () => {
    expect(getWcPayInlinePlan({ actions: [nativeAction], option })).toEqual({
      mode: 'inline',
    });
  });

  it('falls back for multi-action sequences (Permit2)', () => {
    const plan = getWcPayInlinePlan({
      actions: [nativeAction, signAction],
      option,
    });
    expect(plan.mode).toBe('fallback');
  });

  it('falls back for non-send methods', () => {
    expect(getWcPayInlinePlan({ actions: [signAction], option }).mode).toBe(
      'fallback',
    );
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
    expect(getWcPayInlinePlan({ actions: [inflated], option }).mode).toBe(
      'fallback',
    );
  });

  it('falls back with no selected option', () => {
    expect(
      getWcPayInlinePlan({ actions: [nativeAction], option: undefined }).mode,
    ).toBe('fallback');
  });

  it('falls back without throwing on undefined actions', () => {
    expect(() =>
      getWcPayInlinePlan({
        actions: undefined as unknown as IWcPayAction[],
        option,
      }),
    ).not.toThrow();
    expect(
      getWcPayInlinePlan({
        actions: undefined as unknown as IWcPayAction[],
        option,
      }).mode,
    ).toBe('fallback');
  });

  it('falls back without throwing on an empty actions array', () => {
    expect(() => getWcPayInlinePlan({ actions: [], option })).not.toThrow();
    expect(getWcPayInlinePlan({ actions: [], option }).mode).toBe('fallback');
  });

  it('falls back without throwing on a null action entry', () => {
    const actions = [null as unknown as IWcPayAction];
    expect(() => getWcPayInlinePlan({ actions, option })).not.toThrow();
    expect(getWcPayInlinePlan({ actions, option }).mode).toBe('fallback');
  });

  it('falls back without throwing on an action missing walletRpc', () => {
    const actions = [{} as IWcPayAction];
    expect(() => getWcPayInlinePlan({ actions, option })).not.toThrow();
    expect(getWcPayInlinePlan({ actions, option }).mode).toBe('fallback');
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
    return { onPhase: jest.fn(), onInlineFailure };
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
  });
});
