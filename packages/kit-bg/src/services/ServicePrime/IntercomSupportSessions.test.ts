import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { INTERCOM_SUPPORT_ORIGIN } from '@onekeyhq/shared/src/modules3rdParty/intercom/bridge';

import { IntercomSupportSessions } from './IntercomSupportSessions';

describe('Intercom Support handoff', () => {
  it('requires the exact origin and consumes a local handoff only once', () => {
    const sessions = new IntercomSupportSessions();
    sessions.create('handoff', 'owner', 0);
    expect(
      sessions.take(
        'handoff',
        'https://intercom.onekey.so.evil.test',
        'owner',
        1,
      ),
    ).toBe(false);
    expect(
      sessions.take('handoff', 'https://asset.onekey-asset.com', 'owner', 1),
    ).toBe(false);
    expect(sessions.take('handoff', INTERCOM_SUPPORT_ORIGIN, 'owner', 1)).toBe(
      true,
    );
    expect(sessions.take('handoff', INTERCOM_SUPPORT_ORIGIN, 'owner', 2)).toBe(
      false,
    );
  });

  it('cannot redeem the URL handoff in another background instance', () => {
    const source = new IntercomSupportSessions();
    const otherDevice = new IntercomSupportSessions();
    source.create('handoff', 'owner', 0);
    expect(
      otherDevice.take('handoff', INTERCOM_SUPPORT_ORIGIN, 'owner', 1),
    ).toBe(false);
  });

  it('rejects an expired handoff or changed identity', () => {
    const sessions = new IntercomSupportSessions();
    sessions.create('expired', 'owner', 0);
    expect(
      sessions.take('expired', INTERCOM_SUPPORT_ORIGIN, 'owner', 120_000),
    ).toBe(false);
    sessions.create('changed', 'owner', 0);
    expect(
      sessions.take('changed', INTERCOM_SUPPORT_ORIGIN, 'other-owner', 1),
    ).toBe(false);
    expect(sessions.take('changed', INTERCOM_SUPPORT_ORIGIN, 'owner', 2)).toBe(
      false,
    );
  });

  it('drops credentials when identity changes while they are being fetched', async () => {
    const sessions = new IntercomSupportSessions();
    sessions.create('handoff', 'owner');
    let owner = 'owner';
    await expect(
      sessions.redeem({
        id: 'handoff',
        origin: INTERCOM_SUPPORT_ORIGIN,
        getOwner: async () => owner,
        getContext: async () => {
          owner = 'other-owner';
          return { intercom_user_jwt: 'must-not-be-returned' };
        },
      }),
    ).rejects.toThrow('identity changed');
  });

  it('does not fetch credentials for unavailable ownership or an invalid origin', async () => {
    const sessions = new IntercomSupportSessions();
    sessions.create('handoff', 'owner');
    const getContext = jest.fn(async () => ({}));
    await expect(
      sessions.redeem({
        id: 'handoff',
        origin: INTERCOM_SUPPORT_ORIGIN,
        getOwner: async () => {
          throw new OneKeyLocalError('ownership unavailable');
        },
        getContext,
      }),
    ).rejects.toThrow('ownership unavailable');
    await expect(
      sessions.redeem({
        id: 'handoff',
        origin: 'https://evil.test',
        getOwner: async () => 'owner',
        getContext,
      }),
    ).rejects.toThrow('Invalid');
    expect(getContext).not.toHaveBeenCalled();
  });
});
