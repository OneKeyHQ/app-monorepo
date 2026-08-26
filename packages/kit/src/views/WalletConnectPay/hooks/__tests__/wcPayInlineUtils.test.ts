import type {
  IWcPayAction,
  IWcPayOption,
} from '@onekeyhq/shared/src/walletConnect/payTypes';

import {
  EWcPayInlineFailureKind,
  classifyWcPayInlineFailure,
  getWcPayInlinePlan,
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
});
