import type { IConnectYourDeviceItem } from '@onekeyhq/shared/types/device';

import {
  getFoundDeviceKey,
  resolveSelectedFoundDevice,
} from './foundDevicesFooterUtils';

function makeItem(
  device: {
    connectId?: string | null;
    deviceId?: string | null;
    uuid?: string;
  },
  title = 'OneKey Pro',
): IConnectYourDeviceItem {
  return {
    title,
    src: 0,
    device: {
      connectId: null,
      deviceId: null,
      uuid: '',
      name: title,
      deviceType: 'pro',
      commType: 'usb',
      ...device,
    },
  } as unknown as IConnectYourDeviceItem;
}

describe('getFoundDeviceKey', () => {
  it('prefers connectId, then deviceId, then uuid, then title', () => {
    expect(
      getFoundDeviceKey(
        makeItem({ connectId: 'c1', deviceId: 'd1', uuid: 'u1' }),
      ),
    ).toBe('c1');
    expect(getFoundDeviceKey(makeItem({ deviceId: 'd1', uuid: 'u1' }))).toBe(
      'd1',
    );
    expect(getFoundDeviceKey(makeItem({ uuid: 'u1' }))).toBe('u1');
    expect(getFoundDeviceKey(makeItem({}, 'Fallback'))).toBe('Fallback');
  });
});

describe('resolveSelectedFoundDevice', () => {
  const first = makeItem({ connectId: 'c1' });
  const second = makeItem({ connectId: 'c2' });

  it('returns undefined for an empty list', () => {
    expect(resolveSelectedFoundDevice([], undefined)).toBeUndefined();
    expect(resolveSelectedFoundDevice([], 'c1')).toBeUndefined();
  });

  it('falls back to the first device when nothing was picked', () => {
    expect(resolveSelectedFoundDevice([first, second], undefined)).toBe(first);
  });

  it('keeps the picked device while it is still listed', () => {
    expect(resolveSelectedFoundDevice([first, second], 'c2')).toBe(second);
  });

  it('yields no selection when the picked device is no longer listed', () => {
    expect(resolveSelectedFoundDevice([first], 'c2')).toBeUndefined();
  });
});
