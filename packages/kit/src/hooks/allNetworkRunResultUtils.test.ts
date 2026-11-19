import {
  isAllNetworkFanOutExhausted,
  resolveAllNetworkFailedRunRestore,
  resolveAllNetworkPublishedResult,
} from './allNetworkRunResultUtils';

describe('resolveAllNetworkPublishedResult', () => {
  const signature = 'account-1|all--networks|wallet-1|0|0';

  test('publishes and records a stable result', () => {
    const result = [{ networkId: 'evm--1' }];

    expect(
      resolveAllNetworkPublishedResult({
        completedResult: result,
        hasQueuedRerun: false,
        lastPublished: undefined,
        runSignature: signature,
      }),
    ).toEqual({
      publishedResult: result,
      nextLastPublished: { result, runSignature: signature },
    });
  });

  test('keeps the previous stable result when the run is superseded', () => {
    const previous = [{ networkId: 'btc--0' }];

    const resolved = resolveAllNetworkPublishedResult({
      completedResult: [{ networkId: 'evm--1' }],
      hasQueuedRerun: true,
      lastPublished: { result: previous, runSignature: signature },
      runSignature: signature,
    });

    expect(resolved).toEqual({
      publishedResult: previous,
      nextLastPublished: { result: previous, runSignature: signature },
    });
    expect(resolved.publishedResult).toBe(previous);
  });

  test('does not publish when the first run is superseded', () => {
    expect(
      resolveAllNetworkPublishedResult({
        completedResult: [{ networkId: 'evm--1' }],
        hasQueuedRerun: true,
        lastPublished: undefined,
        runSignature: signature,
      }),
    ).toEqual({
      publishedResult: undefined,
      nextLastPublished: undefined,
    });
  });

  test('does not reuse a stable result from another owner', () => {
    const previous = [{ networkId: 'btc--0' }];

    expect(
      resolveAllNetworkPublishedResult({
        completedResult: [{ networkId: 'evm--1' }],
        hasQueuedRerun: true,
        lastPublished: {
          result: previous,
          runSignature: 'another-account|all--networks|wallet-2|0|0',
        },
        runSignature: signature,
      }),
    ).toEqual({
      publishedResult: undefined,
      nextLastPublished: {
        result: previous,
        runSignature: 'another-account|all--networks|wallet-2|0|0',
      },
    });
  });

  test('publishes a stable empty result', () => {
    expect(
      resolveAllNetworkPublishedResult({
        completedResult: null,
        hasQueuedRerun: false,
        lastPublished: undefined,
        runSignature: signature,
      }),
    ).toEqual({
      publishedResult: null,
      nextLastPublished: { result: null, runSignature: signature },
    });
  });

  test('retains a superseded result as the last-good snapshot when the accepted run cleared it', () => {
    const completed = [{ networkId: 'evm--1' }];

    // The accepted run invalidated the retained result before its fan-out;
    // a must-run queued meanwhile supersedes this completed result.
    const resolved = resolveAllNetworkPublishedResult({
      completedResult: completed,
      hasQueuedRerun: true,
      lastPublished: undefined,
      runSignature: signature,
      retainSupersededResult: true,
    });

    expect(resolved).toEqual({
      publishedResult: undefined,
      nextLastPublished: { result: completed, runSignature: signature },
    });

    // The queued run fails: the superseded snapshot must be restorable.
    expect(
      resolveAllNetworkFailedRunRestore({
        previousPublished: resolved.nextLastPublished,
        ownerUnchanged: true,
        currentRunSignature: signature,
      }),
    ).toEqual({
      nextLastPublished: { result: completed, runSignature: signature },
      shouldRestoreResult: true,
    });
  });

  test('prefers the newer superseded result over a retained one when retaining', () => {
    const previous = [{ networkId: 'btc--0' }];
    const completed = [{ networkId: 'evm--1' }];

    expect(
      resolveAllNetworkPublishedResult({
        completedResult: completed,
        hasQueuedRerun: true,
        lastPublished: { result: previous, runSignature: signature },
        runSignature: signature,
        retainSupersededResult: true,
      }),
    ).toEqual({
      publishedResult: previous,
      nextLastPublished: { result: completed, runSignature: signature },
    });
  });
});

describe('resolveAllNetworkFailedRunRestore', () => {
  const signature = 'account-1|all--networks|wallet-1|0|0';
  const previous = {
    result: [{ networkId: 'evm--1' }],
    runSignature: signature,
  };

  test('restores the last-good result when the owner is unchanged', () => {
    expect(
      resolveAllNetworkFailedRunRestore({
        previousPublished: previous,
        ownerUnchanged: true,
        currentRunSignature: signature,
      }),
    ).toEqual({
      nextLastPublished: previous,
      shouldRestoreResult: true,
    });
  });

  test('keeps the ref but does not touch the visible result after an owner switch', () => {
    expect(
      resolveAllNetworkFailedRunRestore({
        previousPublished: previous,
        ownerUnchanged: false,
        currentRunSignature: signature,
      }),
    ).toEqual({
      nextLastPublished: previous,
      shouldRestoreResult: false,
    });
  });

  test('has nothing to restore when no result was ever published', () => {
    expect(
      resolveAllNetworkFailedRunRestore({
        previousPublished: undefined,
        ownerUnchanged: true,
        currentRunSignature: signature,
      }),
    ).toEqual({
      nextLastPublished: undefined,
      shouldRestoreResult: false,
    });
  });

  test('keeps the ref but does not publish a snapshot minted for another run signature', () => {
    // The retained ref outlives an account switch: owner X's superseded
    // result is still in the ref when owner Y's first run is accepted. If
    // that run fails, `ownerUnchanged` is true for Y's own runner, yet the
    // snapshot belongs to X and must not be published under Y.
    expect(
      resolveAllNetworkFailedRunRestore({
        previousPublished: previous,
        ownerUnchanged: true,
        currentRunSignature: 'account-2|all--networks|wallet-1|0|0',
      }),
    ).toEqual({
      nextLastPublished: previous,
      shouldRestoreResult: false,
    });
  });
});

describe('isAllNetworkFanOutExhausted', () => {
  const signature = 'account-1|all--networks|wallet-1|0|0';

  test('an owner with no accounts issues no requests and is not exhausted', () => {
    expect(
      isAllNetworkFanOutExhausted({ requestCount: 0, resultCount: 0 }),
    ).toBe(false);
  });

  test('a fan-out whose every request failed is exhausted', () => {
    // `continueOnError` maps each rejection to `null`; after filtering, the
    // fan-out resolves with an empty array instead of throwing.
    expect(
      isAllNetworkFanOutExhausted({ requestCount: 3, resultCount: 0 }),
    ).toBe(true);
  });

  test('a partially failed fan-out still publishes its results', () => {
    expect(
      isAllNetworkFanOutExhausted({ requestCount: 3, resultCount: 1 }),
    ).toBe(false);
  });

  test('restores the superseded successful run when the queued refresh is exhausted', () => {
    const firstRun = [{ networkId: 'evm--1' }];

    // Refresh 1 succeeds but a second manual refresh queued behind it
    // supersedes the result; the accepted run had cleared the retained
    // snapshot, so the superseded result becomes the last-good snapshot.
    const superseded = resolveAllNetworkPublishedResult({
      completedResult: firstRun,
      hasQueuedRerun: true,
      lastPublished: undefined,
      runSignature: signature,
      retainSupersededResult: true,
    });
    expect(superseded.publishedResult).toBeUndefined();

    // Refresh 2 issues requests but every one of them fails.
    expect(
      isAllNetworkFanOutExhausted({ requestCount: 2, resultCount: 0 }),
    ).toBe(true);
    expect(
      resolveAllNetworkFailedRunRestore({
        previousPublished: superseded.nextLastPublished,
        ownerUnchanged: true,
        currentRunSignature: signature,
      }),
    ).toEqual({
      nextLastPublished: { result: firstRun, runSignature: signature },
      shouldRestoreResult: true,
    });
  });
});
