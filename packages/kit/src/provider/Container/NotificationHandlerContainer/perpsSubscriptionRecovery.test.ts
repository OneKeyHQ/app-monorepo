import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { recoverPerpsSubscriptionsAfterNavigation } from './perpsSubscriptionRecovery';

describe('recoverPerpsSubscriptionsAfterNavigation', () => {
  it('reads the generation after navigation and recovers while visible', async () => {
    const calls: string[] = [];

    await expect(
      recoverPerpsSubscriptionsAfterNavigation({
        isAppVisible: () => true,
        isAppLocked: async () => false,
        readDisabledCount: async () => {
          calls.push('read');
          return 7;
        },
        recover: async (disabledCount) => {
          calls.push(`recover:${disabledCount}`);
          return true;
        },
      }),
    ).resolves.toBe(true);
    expect(calls).toEqual(['read', 'recover:7']);
  });

  it('does not recover after the app becomes hidden', async () => {
    let visible = true;
    const recover = jest.fn<Promise<boolean>, [number]>();

    await expect(
      recoverPerpsSubscriptionsAfterNavigation({
        isAppVisible: () => visible,
        isAppLocked: async () => false,
        readDisabledCount: async () => {
          visible = false;
          return 7;
        },
        recover,
      }),
    ).resolves.toBe(false);
    expect(recover).not.toHaveBeenCalled();
  });

  it('does not read the generation while the app is locked', async () => {
    const readDisabledCount = jest.fn<Promise<number>, []>();

    await expect(
      recoverPerpsSubscriptionsAfterNavigation({
        isAppVisible: () => true,
        isAppLocked: async () => true,
        readDisabledCount,
        recover: async () => true,
      }),
    ).resolves.toBe(false);
    expect(readDisabledCount).not.toHaveBeenCalled();
  });

  it('falls back safely when the bg bridge rejects', async () => {
    await expect(
      recoverPerpsSubscriptionsAfterNavigation({
        isAppVisible: () => true,
        isAppLocked: async () => false,
        readDisabledCount: async () => {
          throw new OneKeyLocalError('bridge unavailable');
        },
        recover: async () => true,
      }),
    ).resolves.toBe(false);
  });
});
