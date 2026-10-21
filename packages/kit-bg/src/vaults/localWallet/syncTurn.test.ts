import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { runBoundedSyncTurn } from './syncTurn';

function clock(start = 1_000_000) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe('runBoundedSyncTurn', () => {
  it('steps until the chain reports done', async () => {
    const c = clock();
    let n = 0;
    const result = await runBoundedSyncTurn({
      budgetMs: 30_000,
      expectedStepMs: 1000,
      now: c.now,
      step: async () => {
        c.advance(500);
        n += 1;
        return { done: n === 3, stateChanged: n === 2 };
      },
    });
    expect(result).toMatchObject({ done: true, steps: 3, stateChanged: true });
    expect(result.lastStepMs).toBe(500);
  });

  // 12 s steps in a 30 s budget: the third would end at 36 s, so it never starts.
  it('does not start a step expected to end past the budget', async () => {
    const c = clock();
    const result = await runBoundedSyncTurn({
      budgetMs: 30_000,
      expectedStepMs: 15_000,
      now: c.now,
      step: async () => {
        c.advance(12_000);
        return { done: false };
      },
    });
    expect(result).toMatchObject({ done: false, steps: 2 });
    expect(c.now() - 1_000_000).toBe(24_000);
  });

  it('corrects the estimate from measured steps, not the policy guess', async () => {
    const c = clock();
    // The policy guessed 15 s; steps actually take 2 s, so far more fit.
    const result = await runBoundedSyncTurn({
      budgetMs: 30_000,
      expectedStepMs: 15_000,
      now: c.now,
      step: async () => {
        c.advance(2000);
        return { done: false };
      },
    });
    // 28 s elapsed + 2 s = 30 s fits exactly; the 16th would not.
    expect(result.steps).toBe(15);
  });

  it('always runs the first step, so a pessimistic guess cannot stall a chain', async () => {
    const c = clock();
    const result = await runBoundedSyncTurn({
      budgetMs: 10_000,
      expectedStepMs: 60_000,
      now: c.now,
      step: async () => {
        c.advance(3000);
        return { done: false };
      },
    });
    expect(result.steps).toBeGreaterThanOrEqual(1);
  });
});

describe('runBoundedSyncTurn onStep', () => {
  it('runs after every step, so progress can be published step by step', async () => {
    const c = clock();
    const seen: number[] = [];
    let n = 0;
    await runBoundedSyncTurn({
      budgetMs: 30_000,
      expectedStepMs: 1000,
      now: c.now,
      step: async () => {
        c.advance(500);
        n += 1;
        return { done: n === 3 };
      },
      onStep: async () => {
        seen.push(n);
      },
    });
    expect(seen).toEqual([1, 2, 3]);
  });

  it('keeps scanning when publishing fails', async () => {
    const c = clock();
    let n = 0;
    const result = await runBoundedSyncTurn({
      budgetMs: 30_000,
      expectedStepMs: 1000,
      now: c.now,
      step: async () => {
        c.advance(500);
        n += 1;
        return { done: n === 2 };
      },
      onStep: async () => {
        throw new OneKeyLocalError('atom unavailable');
      },
    });
    expect(result).toMatchObject({ done: true, steps: 2 });
  });
});
