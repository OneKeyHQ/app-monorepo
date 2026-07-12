import { ANDROID_DEVICE_CPU_TIER_BY_KEY } from './deviceCpuTierData/android';
import { IOS_DEVICE_CPU_TIER_BY_MODEL } from './deviceCpuTierData/ios';
import {
  DEVICE_CPU_TIER_KEY_SEPARATOR,
  buildAndroidDeviceCpuTierKey,
  normalizeDeviceCpuTierKeyPart,
} from './deviceCpuTierUtils';
import { EDeviceCpuTier } from './devicePerformanceTierTypes';

describe('deviceCpuTierData', () => {
  it('contains the Motorola One 5G UW ace regression fixture', () => {
    const key = buildAndroidDeviceCpuTierKey({
      manufacturer: 'Motorola',
      model: 'motorola one 5G UW ace',
    });

    expect(ANDROID_DEVICE_CPU_TIER_BY_KEY[key]).toBe(EDeviceCpuTier.low);
  });

  it('contains the iPhone 17 Pro regression fixture', () => {
    const key = normalizeDeviceCpuTierKeyPart('iPhone 17 Pro');

    expect(IOS_DEVICE_CPU_TIER_BY_MODEL[key]).toBe(EDeviceCpuTier.high);
  });

  it('contains only manufacturer and model identifiers', () => {
    const directIdentifierPattern =
      /@|https?:\/\/|www\.|(?:\d{1,3}\.){3}\d{1,3}|[0-9a-f]{8}-[0-9a-f-]{27,}/i;

    for (const key of Object.keys(ANDROID_DEVICE_CPU_TIER_BY_KEY)) {
      const [manufacturer, model, ...extraParts] = key.split(
        DEVICE_CPU_TIER_KEY_SEPARATOR,
      );
      expect(manufacturer).toBeTruthy();
      expect(model).toBeTruthy();
      expect(extraParts).toHaveLength(0);
      expect(key).not.toMatch(directIdentifierPattern);
    }
  });
});
