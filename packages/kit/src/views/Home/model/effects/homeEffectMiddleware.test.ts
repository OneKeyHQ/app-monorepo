import { HomeEffectMiddleware } from './homeEffectMiddleware';

import type { IHomeEffectEnvelope } from './homeEffectMiddleware';

function envelope(effectId: string): IHomeEffectEnvelope {
  return {
    effectId,
    eventSequence: 1,
    sessionId: 'session-a',
    effect: { kind: 'reconcileSourcePlan', sessionId: 'session-a' },
  };
}

describe('HomeEffectMiddleware', () => {
  it('delivers each effect identity once and reports its completion value', async () => {
    const handled: string[] = [];
    const completed: Array<{ error?: unknown; value?: unknown }> = [];
    const middleware = new HomeEffectMiddleware({
      handlers: {
        reconcileSourcePlan: async (effect) => {
          handled.push(effect.effectId);
          return 'done';
        },
      },
      dispatchCompletion: ({ error, value }) => {
        completed.push({ error, value });
      },
    });
    const effect = envelope('effect-a');

    middleware.enqueue([effect, effect]);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(handled).toEqual(['effect-a']);
    expect(completed).toEqual([{ error: undefined, value: 'done' }]);
    expect(middleware.getSnapshot()).toMatchObject({
      queuedCount: 0,
      runningCount: 0,
    });
  });

  it('bounds completed effect identities', async () => {
    const middleware = new HomeEffectMiddleware({
      handlers: {
        reconcileSourcePlan: async () => undefined,
      },
      maxProcessedEffectIds: 2,
    });

    middleware.enqueue([
      envelope('effect-a'),
      envelope('effect-b'),
      envelope('effect-c'),
    ]);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(middleware.enqueue([envelope('effect-a')])).toBe(true);
    await Promise.resolve();

    expect(middleware.getSnapshot().queuedCount).toBe(0);
  });

  it('drops queued ownership on dispose', () => {
    const middleware = new HomeEffectMiddleware({ handlers: {} });
    middleware.dispose();

    expect(middleware.enqueue([envelope('effect-a')])).toBe(false);
    expect(middleware.getSnapshot()).toEqual({
      disposed: true,
      queuedCount: 0,
      runningCount: 0,
    });
  });
});
