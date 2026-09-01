import { EDeviceType } from '@onekeyfe/hd-shared';

import {
  pickDeviceType,
  pickErrorMessage,
  pickIdentityText,
  pickQrScoped,
  resolveDeviceNotFoundLanding,
} from './DeviceStageBurst';

import type { IDeviceStageState } from '../../states/jotai/atoms';

describe('pickDeviceType', () => {
  it('keeps the device it already identified when an event does not know', () => {
    // SDK progress ticks carry no device and arrive stamped `unknown`;
    // taking that at face value dropped the replica mid-flow.
    expect(pickDeviceType(EDeviceType.Unknown, EDeviceType.Pro)).toBe(
      EDeviceType.Pro,
    );
  });

  it('learns the device the first time anything names it', () => {
    expect(pickDeviceType(EDeviceType.Pro, undefined)).toBe(EDeviceType.Pro);
  });

  it('lets a real model replace another', () => {
    expect(pickDeviceType(EDeviceType.Pro2, EDeviceType.Pro)).toBe(
      EDeviceType.Pro2,
    );
  });

  it('stays unknown while nothing has ever named the device', () => {
    expect(pickDeviceType(EDeviceType.Unknown, undefined)).toBe(
      EDeviceType.Unknown,
    );
  });
});

describe('pickIdentityText', () => {
  // The repro this rule exists for: the SDK's call-end close arrives with
  // connectId '', which won a `??` and erased the device the stage had
  // named — so the burst reached its end with nothing to probe, and an
  // unplugged device landed as a generic failure, not a disconnect.
  it('keeps the named device when a close event carries no name', () => {
    expect(pickIdentityText('', 'PRB09B0058A')).toBe('PRB09B0058A');
  });

  it('keeps what it knows when an event says nothing at all', () => {
    expect(pickIdentityText(undefined, 'PRB09B0058A')).toBe('PRB09B0058A');
  });

  it('learns the device the first time anything names it', () => {
    expect(pickIdentityText('PRB09B0058A', undefined)).toBe('PRB09B0058A');
  });

  it('lets one real name replace another', () => {
    expect(pickIdentityText('NEO-035F', 'PRB09B0058A')).toBe('NEO-035F');
  });

  it('stays unknown while nothing has ever named it', () => {
    expect(pickIdentityText('', undefined)).toBeUndefined();
    expect(pickIdentityText(undefined, undefined)).toBeUndefined();
  });
});

describe('pickQrScoped', () => {
  const ur = { type: 'onekey-app-call-device' } as NonNullable<
    IDeviceStageState['qrValueUr']
  >;
  const newerUr = { type: 'eth-sign-request' } as NonNullable<
    IDeviceStageState['qrValueUr']
  >;

  it('carries the code across the crossing to the camera and back', () => {
    // The way back from scanQr re-presents the same code — dropping it at
    // the crossing would land the person on an empty white card.
    expect(pickQrScoped('scanQr', undefined, ur)).toBe(ur);
    expect(pickQrScoped('showQr', undefined, ur)).toBe(ur);
  });

  it('lets an explicit hand-over replace what the step showed', () => {
    expect(pickQrScoped('showQr', newerUr, ur)).toBe(newerUr);
  });

  it('drops the code the moment the stage leaves the pair', () => {
    // No other step may re-present a stale request code — and no stale
    // session tag may authorize a submit (the same rule carries both).
    expect(pickQrScoped('processing', undefined, ur)).toBeUndefined();
    expect(pickQrScoped('error', undefined, ur)).toBeUndefined();
    expect(pickQrScoped('off', undefined, ur)).toBeUndefined();
    expect(pickQrScoped('processing', undefined, 7)).toBeUndefined();
  });

  it('carries the session tag by the same rule', () => {
    expect(pickQrScoped('scanQr', undefined, 7)).toBe(7);
    expect(pickQrScoped('showQr', 8, 7)).toBe(8);
  });

  it('never invents one outside the pair, explicit or not', () => {
    expect(pickQrScoped('connecting', ur, undefined)).toBeUndefined();
  });
});

describe('resolveDeviceNotFoundLanding', () => {
  it('lands the Device-not-connected card when the burst never heard from the device', () => {
    // A call initiated with no device present fails the SDK's initial
    // search — nothing has spoken, so this is mapping-A's deviceNotFound.
    expect(
      resolveDeviceNotFoundLanding({
        wasVendorBurst: false,
        sawDeviceEventThisBurst: false,
      }),
    ).toBe('deviceNotFound');
  });

  it('keeps the disconnect notice for a device the burst has heard from', () => {
    // A later call in the same burst re-searches an unplugged device and
    // throws the very same 105 — that is a mid-burst unplug, and the
    // agreed split keeps it on the disconnect notice.
    expect(
      resolveDeviceNotFoundLanding({
        wasVendorBurst: false,
        sawDeviceEventThisBurst: true,
      }),
    ).toBe('disconnected');
  });

  it('never lands the outcome card on a vendor burst', () => {
    // The vendor track's deviceNotFound is the adapter's live retry ask,
    // not an ending — a 105 there keeps today's error path either way.
    expect(
      resolveDeviceNotFoundLanding({
        wasVendorBurst: true,
        sawDeviceEventThisBurst: false,
      }),
    ).toBe('disconnected');
    expect(
      resolveDeviceNotFoundLanding({
        wasVendorBurst: true,
        sawDeviceEventThisBurst: true,
      }),
    ).toBe('disconnected');
  });
});

describe('pickErrorMessage', () => {
  it('carries the words the error already localized', () => {
    // OK-59934: the hardware error layer resolves a class's translation
    // key into `.message`, and the stage suppresses the toast that used
    // to speak it — so the card has to.
    expect(
      pickErrorMessage({
        message:
          'Passphrase does not match the current wallet, please try again',
      }),
    ).toBe('Passphrase does not match the current wallet, please try again');
  });

  it('carries a raw SDK line too, rather than saying nothing', () => {
    expect(
      pickErrorMessage({ message: 'Protocol V2 USB read failed: transferIn' }),
    ).toBe('Protocol V2 USB read failed: transferIn');
  });

  it('declines what it cannot speak', () => {
    expect(pickErrorMessage(undefined)).toBeUndefined();
    expect(pickErrorMessage({})).toBeUndefined();
    expect(pickErrorMessage({ message: '   ' })).toBeUndefined();
    expect(pickErrorMessage({ message: 500 })).toBeUndefined();
    expect(pickErrorMessage('a bare string, not an error')).toBeUndefined();
  });
});
