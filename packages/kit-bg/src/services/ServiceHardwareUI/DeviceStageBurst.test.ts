import { EDeviceType } from '@onekeyfe/hd-shared';

import { pickDeviceType, pickErrorMessage } from './DeviceStageBurst';

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
