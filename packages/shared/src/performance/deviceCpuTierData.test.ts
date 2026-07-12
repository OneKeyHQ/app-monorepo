import {
  ANDROID_DEVICE_CPU_TIER_BY_MANUFACTURER,
  getAndroidDeviceCpuTier,
} from './deviceCpuTierData/android';
import { IOS_DEVICE_CPU_TIER_BY_MODEL_ID } from './deviceCpuTierData/ios';
import { normalizeDeviceCpuTierKeyPart } from './deviceCpuTierUtils';
import {
  EDeviceCpuTier,
  isKnownDeviceCpuTier,
} from './devicePerformanceTierTypes';

describe('deviceCpuTierData', () => {
  it('contains the Motorola One 5G UW ace regression fixture', () => {
    const manufacturer = normalizeDeviceCpuTierKeyPart('Motorola');
    const model = normalizeDeviceCpuTierKeyPart('motorola one 5G UW ace');

    expect(ANDROID_DEVICE_CPU_TIER_BY_MANUFACTURER[manufacturer]?.[model]).toBe(
      EDeviceCpuTier.low,
    );
  });

  it.each([
    ['iPhone18,1', EDeviceCpuTier.high],
    ['iPad7,1', EDeviceCpuTier.low],
  ])('contains the iOS model ID %s', (modelId, expectedTier) => {
    const key = normalizeDeviceCpuTierKeyPart(modelId);

    expect(IOS_DEVICE_CPU_TIER_BY_MODEL_ID[key]).toBe(expectedTier);
  });

  it('contains only manufacturer and model identifiers', () => {
    const directIdentifierPattern =
      /@|https?:\/\/|www\.|(?:\d{1,3}\.){3}\d{1,3}|[0-9a-f]{8}-[0-9a-f-]{27,}/i;

    for (const [manufacturer, models] of Object.entries(
      ANDROID_DEVICE_CPU_TIER_BY_MANUFACTURER,
    )) {
      expect(manufacturer).toBeTruthy();
      expect(manufacturer).not.toMatch(directIdentifierPattern);
      for (const [model, tier] of Object.entries(models)) {
        expect(model).toBeTruthy();
        expect(model).not.toMatch(directIdentifierPattern);
        expect(isKnownDeviceCpuTier(tier)).toBe(true);
      }
    }
  });

  it('rejects prototype values as CPU tiers', () => {
    expect(isKnownDeviceCpuTier(Object.prototype)).toBe(false);
    expect(isKnownDeviceCpuTier(Object.prototype.constructor)).toBe(false);
    expect(
      getAndroidDeviceCpuTier({
        manufacturer: '__proto__',
        model: 'constructor',
      }),
    ).toBeUndefined();
  });
});
