import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  claimAccountSelectorBackgroundRecovery,
  getAccountSelectorBackgroundRecoveryRawReadySequence,
  markAccountSelectorBackgroundRecoveryRawReady,
  onAccountSelectorBackgroundRecoveryComplete,
  onAccountSelectorBackgroundRecoveryRawReady,
  publishAccountSelectorBackgroundRecoveryComplete,
} from './accountSelectorBackgroundRecovery';

function readySignal(sequence: number) {
  return {
    bootId: `boot-${sequence}`,
    reason: 'recovered' as const,
    sequence,
  };
}

function publishCurrentRecovery({
  owner,
  sequence,
}: {
  owner: {
    sceneName: EAccountSelectorSceneName;
    sceneUrl: string;
  };
  sequence: number;
}) {
  const signal = readySignal(sequence);
  markAccountSelectorBackgroundRecoveryRawReady({
    owner,
    readySignal: signal,
  });
  return publishAccountSelectorBackgroundRecoveryComplete({
    owner,
    readySignal: signal,
  });
}

describe('account-selector background recovery owners', () => {
  it('isolates A -> B -> A owners and deduplicates the same sequence', () => {
    const ownerA = {
      sceneName: EAccountSelectorSceneName.home,
      sceneUrl: 'owner-a',
    };
    const ownerB = {
      sceneName: EAccountSelectorSceneName.home,
      sceneUrl: 'owner-b',
    };
    const listenerA = jest.fn();
    const listenerB = jest.fn();
    const unsubscribeA = onAccountSelectorBackgroundRecoveryComplete(
      ownerA,
      listenerA,
    );
    const unsubscribeB = onAccountSelectorBackgroundRecoveryComplete(
      ownerB,
      listenerB,
    );

    publishCurrentRecovery({
      owner: ownerA,
      sequence: 101,
    });
    publishCurrentRecovery({
      owner: ownerB,
      sequence: 101,
    });
    publishCurrentRecovery({
      owner: ownerA,
      sequence: 101,
    });

    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledTimes(1);
    expect(listenerA).toHaveBeenCalledWith(
      expect.objectContaining({ owner: ownerA }),
    );
    expect(listenerB).toHaveBeenCalledWith(
      expect.objectContaining({ owner: ownerB }),
    );

    unsubscribeA();
    unsubscribeB();
    publishCurrentRecovery({
      owner: ownerA,
      sequence: 102,
    });
    expect(listenerA).toHaveBeenCalledTimes(1);
  });

  it('does not deliver a non-Home owner event to the Home consumer', () => {
    const homeListener = jest.fn();
    const unsubscribe = onAccountSelectorBackgroundRecoveryComplete(
      {
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: 'non-home-isolation',
      },
      homeListener,
    );

    publishCurrentRecovery({
      owner: {
        sceneName: EAccountSelectorSceneName.swap,
        sceneUrl: 'non-home-isolation',
      },
      sequence: 202,
    });

    expect(homeListener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('allows one Home data claim across native and legacy consumers', () => {
    const owner = {
      sceneName: EAccountSelectorSceneName.home,
      sceneUrl: 'claim-sequence',
    };
    publishCurrentRecovery({
      owner,
      sequence: 301,
    });

    expect(
      claimAccountSelectorBackgroundRecovery({
        consumerId: 'home-token-overview',
        owner,
        sequence: 300,
      }),
    ).toBe(false);
    expect(
      claimAccountSelectorBackgroundRecovery({
        consumerId: 'home-token-overview',
        owner,
        sequence: 301,
      }),
    ).toBe(true);
    expect(
      claimAccountSelectorBackgroundRecovery({
        consumerId: 'home-token-overview',
        owner,
        sequence: 301,
      }),
    ).toBe(false);
    expect(
      claimAccountSelectorBackgroundRecovery({
        consumerId: 'home-wallet-list',
        owner,
        sequence: 301,
      }),
    ).toBe(true);
  });

  it('does not re-claim a late replay after a StrictMode-style remount', () => {
    const owner = {
      sceneName: EAccountSelectorSceneName.home,
      sceneUrl: 'strict-remount',
    };
    publishCurrentRecovery({
      owner,
      sequence: 401,
    });
    const firstListener = jest.fn();
    const unsubscribeFirst = onAccountSelectorBackgroundRecoveryComplete(
      owner,
      firstListener,
    );
    expect(firstListener).toHaveBeenCalledTimes(1);
    expect(
      claimAccountSelectorBackgroundRecovery({
        consumerId: 'home-wallet-list',
        owner,
        sequence: 401,
      }),
    ).toBe(true);
    unsubscribeFirst();

    const remountedListener = jest.fn();
    const unsubscribeRemounted = onAccountSelectorBackgroundRecoveryComplete(
      owner,
      remountedListener,
    );
    expect(remountedListener).toHaveBeenCalledTimes(1);
    expect(
      claimAccountSelectorBackgroundRecovery({
        consumerId: 'home-wallet-list',
        owner,
        sequence: 401,
      }),
    ).toBe(false);
    unsubscribeRemounted();
  });

  it('invalidates a completed sequence at raw ready and suppresses its late completion', () => {
    const owner = {
      sceneName: EAccountSelectorSceneName.home,
      sceneUrl: 'raw-ready-supersede',
    };
    const rawReadyListener = jest.fn();
    const completeListener = jest.fn();
    const unsubscribeRawReady = onAccountSelectorBackgroundRecoveryRawReady(
      owner,
      rawReadyListener,
    );
    const unsubscribeComplete = onAccountSelectorBackgroundRecoveryComplete(
      owner,
      completeListener,
    );
    const sequenceN = readySignal(501);
    const sequenceN1 = readySignal(502);

    markAccountSelectorBackgroundRecoveryRawReady({
      owner,
      readySignal: sequenceN,
    });
    publishAccountSelectorBackgroundRecoveryComplete({
      owner,
      readySignal: sequenceN,
    });
    expect(completeListener).toHaveBeenCalledTimes(1);

    markAccountSelectorBackgroundRecoveryRawReady({
      owner,
      readySignal: sequenceN1,
    });
    expect(rawReadyListener).toHaveBeenCalledTimes(2);
    expect(getAccountSelectorBackgroundRecoveryRawReadySequence(owner)).toBe(
      sequenceN1.sequence,
    );
    expect(
      claimAccountSelectorBackgroundRecovery({
        consumerId: 'raw-ready-home',
        owner,
        sequence: sequenceN.sequence,
      }),
    ).toBe(false);

    expect(
      publishAccountSelectorBackgroundRecoveryComplete({
        owner,
        readySignal: sequenceN,
      }),
    ).toBeUndefined();
    expect(completeListener).toHaveBeenCalledTimes(1);
    expect(getAccountSelectorBackgroundRecoveryRawReadySequence(owner)).toBe(
      sequenceN1.sequence,
    );

    publishAccountSelectorBackgroundRecoveryComplete({
      owner,
      readySignal: sequenceN1,
    });
    publishAccountSelectorBackgroundRecoveryComplete({
      owner,
      readySignal: sequenceN1,
    });
    expect(completeListener).toHaveBeenCalledTimes(2);
    expect(
      claimAccountSelectorBackgroundRecovery({
        consumerId: 'raw-ready-home',
        owner,
        sequence: sequenceN1.sequence,
      }),
    ).toBe(true);

    unsubscribeComplete();
    unsubscribeRawReady();
  });
});
