import { OneKeyServerApiError } from '../errors/baseErrors';

import {
  getBroadcastTxContext,
  withBroadcastTxContext,
} from './broadcastTxErrorUtils';
import { toPlainErrorObject } from './errorUtils';

const networkId = 'evm--46630';
const txId = `0x${'a'.repeat(64)}`;
const context = { networkId, txId };

describe('broadcast transaction error context', () => {
  it('keeps a writable OneKey error identity and class for existing error handlers', () => {
    const original = new OneKeyServerApiError({
      code: 40_024,
      message: 'Nonce already used',
    });

    expect(withBroadcastTxContext(original, context)).toBe(original);
    expect(getBroadcastTxContext(original, networkId)).toEqual(context);
    expect(original).toBeInstanceOf(OneKeyServerApiError);
  });

  it('preserves the original API error contract without mutating a frozen error', () => {
    const original = new OneKeyServerApiError({
      code: 40_024,
      message: 'Nonce (265) already used',
      requestId: 'request-1',
      httpStatusCode: 400,
      autoToast: true,
      data: { reason: 'nonce' },
    });
    Object.freeze(original);
    const wrapped = withBroadcastTxContext(original, context);

    expect(wrapped).toMatchObject({
      code: original.code,
      className: original.className,
      name: original.name,
      message: original.message,
      requestId: original.requestId,
      httpStatusCode: original.httpStatusCode,
      autoToast: true,
      data: { reason: 'nonce', $$broadcastTxContext: context },
    });
    expect(getBroadcastTxContext(wrapped, networkId)).toEqual(context);
    expect(original.data).toEqual({ reason: 'nonce' });
  });

  it('retains the context through error serialization and native Error rehydration', () => {
    const wrapped = withBroadcastTxContext(
      new OneKeyServerApiError({ message: 'Nonce already used', code: 40_024 }),
      context,
    );
    const serialized = JSON.parse(
      JSON.stringify(toPlainErrorObject(wrapped)),
    ) as ReturnType<typeof toPlainErrorObject>;
    const rehydrated = Object.assign(new Error(serialized.message), serialized);

    expect(getBroadcastTxContext(rehydrated, networkId)).toEqual(context);
    expect(
      getBroadcastTxContext({ data: wrapped.serialize().data }, networkId),
    ).toEqual(context);
    expect(rehydrated.code).toBe(40_024);
  });

  it.each([
    undefined,
    {},
    { data: { $$broadcastTxContext: { ...context, txId: '0xshort' } } },
    { data: { $$broadcastTxContext: { ...context, networkId: 'sol--101' } } },
    { data: { $$broadcastTxContext: { ...context, networkId: 'evm--1' } } },
    { data: { $$broadcastTxContext: { ...context, txId: 1 } } },
  ])(
    'does not recover a missing, malformed or other-network hash: %j',
    (error) => {
      expect(getBroadcastTxContext(error, networkId)).toBeUndefined();
    },
  );

  it('does not replace an existing primitive error data contract', () => {
    const original = new OneKeyServerApiError({
      message: 'rejected',
      data: 42,
    });
    const wrapped = withBroadcastTxContext(original, context);

    expect(wrapped.data).toBe(42);
    expect(getBroadcastTxContext(wrapped, networkId)).toBeUndefined();
  });

  it('keeps a transport error message and hash when its code is not numeric', () => {
    const original = Object.assign(new Error('connection reset'), {
      code: 'ECONNRESET',
    });
    const wrapped = withBroadcastTxContext(original, context);

    expect(wrapped.message).toBe(original.message);
    expect(getBroadcastTxContext(wrapped, networkId)).toEqual(context);
  });

  it('overrides an existing context with only the locally supplied identity', () => {
    const original = new OneKeyServerApiError({
      message: 'rejected',
      data: {
        $$broadcastTxContext: { ...context, txId: `0x${'b'.repeat(64)}` },
      },
    });

    expect(
      getBroadcastTxContext(
        withBroadcastTxContext(original, context),
        networkId,
      ),
    ).toEqual(context);
  });
});
