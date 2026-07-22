import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { KytIntroPromptClaimManager } from './kytIntroPromptClaim';

import type { ISimpleDBAppStatus } from '../../dbs/simple/entity/SimpleDbEntityAppStatus';

function createManager(initialState: ISimpleDBAppStatus = {}) {
  let state = initialState;
  const appStatus = {
    getRawData: jest.fn(async () => state),
    setRawData: jest.fn(
      async (
        builder: (
          value: ISimpleDBAppStatus | null | undefined,
        ) => ISimpleDBAppStatus,
      ) => {
        state = builder(state);
        return state;
      },
    ),
  };
  return {
    appStatus,
    getState: () => state,
    manager: new KytIntroPromptClaimManager(appStatus),
  };
}

describe('KytIntroPromptClaimManager', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(1000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('lets a purchase reservation block another Home runtime', async () => {
    const { manager } = createManager();
    const purchaseClaim = await manager.tryClaim({
      onekeyUserId: 'user-a',
      ownerId: 'runtime-a',
      entryPoint: 'primeSubscribeSuccess',
    });
    const homeClaim = await manager.tryClaim({
      onekeyUserId: 'user-a',
      ownerId: 'runtime-b',
      entryPoint: 'homeAutoIntro',
    });

    expect(purchaseClaim).toEqual(
      expect.objectContaining({ status: 'claimed' }),
    );
    expect(homeClaim).toEqual(
      expect.objectContaining({ status: 'claimedByOther' }),
    );
  });

  it('does not let Home adopt a purchase lease from the same runtime without its claim id', async () => {
    const { manager } = createManager();
    const purchaseClaim = await manager.tryClaim({
      onekeyUserId: 'user-a',
      ownerId: 'runtime-a',
      entryPoint: 'primeSubscribeSuccess',
    });
    const earlyHomeClaim = await manager.tryClaim({
      onekeyUserId: 'user-a',
      ownerId: 'runtime-a',
      entryPoint: 'homeAutoIntro',
    });

    expect(earlyHomeClaim).toEqual(
      expect.objectContaining({ status: 'claimedByOther' }),
    );
    if (purchaseClaim.status !== 'claimed') {
      throw new OneKeyLocalError('Expected purchase to reserve the intro');
    }
    await expect(
      manager.tryClaim({
        onekeyUserId: 'user-a',
        ownerId: 'runtime-a',
        entryPoint: 'primeSubscribeSuccess',
        claimId: purchaseClaim.claimId,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'claimed',
        claimId: purchaseClaim.claimId,
      }),
    );
  });

  it('lets purchase preempt an unpresented Home claim', async () => {
    const { manager } = createManager();
    const homeClaim = await manager.tryClaim({
      onekeyUserId: 'user-a',
      ownerId: 'runtime-home',
      entryPoint: 'homeAutoIntro',
    });
    const purchaseClaim = await manager.tryClaim({
      onekeyUserId: 'user-a',
      ownerId: 'runtime-purchase',
      entryPoint: 'primeSubscribeSuccess',
    });

    expect(homeClaim.status).toBe('claimed');
    expect(purchaseClaim.status).toBe('claimed');
    if (homeClaim.status !== 'claimed' || purchaseClaim.status !== 'claimed') {
      throw new OneKeyLocalError(
        'Expected both requests to return claim details',
      );
    }
    await expect(
      manager.markPresented({
        onekeyUserId: 'user-a',
        ownerId: 'runtime-home',
        claimId: homeClaim.claimId,
      }),
    ).resolves.toBe(false);
    await expect(
      manager.markPresented({
        onekeyUserId: 'user-a',
        ownerId: 'runtime-purchase',
        claimId: purchaseClaim.claimId,
      }),
    ).resolves.toBe(true);
  });

  it('does not preempt a claim after its dialog is presented', async () => {
    const { manager } = createManager();
    const homeClaim = await manager.tryClaim({
      onekeyUserId: 'user-a',
      ownerId: 'runtime-home',
      entryPoint: 'homeAutoIntro',
    });
    if (homeClaim.status !== 'claimed') {
      throw new OneKeyLocalError('Expected Home to claim the intro');
    }
    await manager.markPresented({
      onekeyUserId: 'user-a',
      ownerId: 'runtime-home',
      claimId: homeClaim.claimId,
    });

    await expect(
      manager.tryClaim({
        onekeyUserId: 'user-a',
        ownerId: 'runtime-purchase',
        entryPoint: 'primeSubscribeSuccess',
      }),
    ).resolves.toEqual(expect.objectContaining({ status: 'claimedByOther' }));
  });

  it('persists completion and rejects every later claim for the user', async () => {
    const { getState, manager } = createManager();
    await manager.complete('user-a');

    await expect(
      manager.tryClaim({
        onekeyUserId: 'user-a',
        ownerId: 'runtime-a',
        entryPoint: 'primeSubscribeSuccess',
      }),
    ).resolves.toEqual({ status: 'shown' });
    expect(getState().kytIntroShownUserIds).toEqual(['user-a']);
    expect(getState().kytIntroClaimLeases).toEqual({});
  });

  it('answers the steady-state completed probe without writing', async () => {
    const { appStatus, manager } = createManager({
      kytIntroShownUserIds: ['user-a'],
      kytIntroClaimLeases: {},
    });

    await expect(manager.peekCompleted('user-a')).resolves.toBe(true);
    await expect(manager.peekCompleted('user-b')).resolves.toBe(false);
    expect(appStatus.setRawData).not.toHaveBeenCalled();
  });

  it('reports not-completed while a lease entry lingers for the user', async () => {
    const { manager } = createManager();
    const claim = await manager.tryClaim({
      onekeyUserId: 'user-a',
      ownerId: 'runtime-a',
      entryPoint: 'homeAutoIntro',
    });
    expect(claim.status).toBe('claimed');

    await expect(manager.peekCompleted('user-a')).resolves.toBe(false);
    await manager.complete('user-a');
    await expect(manager.peekCompleted('user-a')).resolves.toBe(true);
  });

  it('allows recovery after an abandoned reservation expires', async () => {
    const { manager } = createManager();
    await manager.tryClaim({
      onekeyUserId: 'user-a',
      ownerId: 'runtime-a',
      entryPoint: 'primeSubscribeSuccess',
    });
    jest.spyOn(Date, 'now').mockReturnValue(302_000);

    await expect(
      manager.tryClaim({
        onekeyUserId: 'user-a',
        ownerId: 'runtime-b',
        entryPoint: 'homeAutoIntro',
      }),
    ).resolves.toEqual(expect.objectContaining({ status: 'claimed' }));
  });
});
