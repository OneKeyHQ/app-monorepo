import {
  ANDROID_DEVICE_CPU_TIER_BY_MANUFACTURER,
  getAndroidDeviceCpuTier,
} from './deviceCpuTierData/android';
import { getIosDeviceCpuTier } from './deviceCpuTierData/ios';
import { normalizeDeviceCpuTierKeyPart } from './deviceCpuTierUtils';
import {
  EDeviceCpuTier,
  isKnownDeviceCpuTier,
} from './devicePerformanceTierTypes';

const AUDITED_ANDROID_SINGLE_CORE_FIXTURES = [
  {
    manufacturer: 'Motorola',
    model: 'moto g power 5g - 2024',
    singleCoreScore: 917,
  },
  {
    manufacturer: 'Motorola',
    model: 'moto g power 5g - 2024',
    singleCoreScore: 903,
  },
  {
    manufacturer: 'Motorola',
    model: 'moto g64 5g',
    singleCoreScore: 1022,
  },
  {
    manufacturer: 'Tecno',
    model: 'tecno cl7',
    singleCoreScore: 920,
  },
] as const;

const getExpectedTierForSingleCoreScore = (singleCoreScore: number) => {
  if (singleCoreScore < 1000) {
    return EDeviceCpuTier.low;
  }
  if (singleCoreScore < 1800) {
    return EDeviceCpuTier.medium;
  }
  return EDeviceCpuTier.high;
};

describe('deviceCpuTierData', () => {
  it('contains the Motorola One 5G UW ace regression fixture', () => {
    const manufacturer = normalizeDeviceCpuTierKeyPart('Motorola');
    const model = normalizeDeviceCpuTierKeyPart('motorola one 5G UW ace');

    expect(ANDROID_DEVICE_CPU_TIER_BY_MANUFACTURER[manufacturer]?.[model]).toBe(
      EDeviceCpuTier.low,
    );
  });

  it.each(AUDITED_ANDROID_SINGLE_CORE_FIXTURES)(
    'classifies $manufacturer $model from audited single-core score $singleCoreScore',
    ({ manufacturer, model, singleCoreScore }) => {
      expect(
        getAndroidDeviceCpuTier({
          manufacturer: normalizeDeviceCpuTierKeyPart(manufacturer),
          model: normalizeDeviceCpuTierKeyPart(model),
        }),
      ).toBe(getExpectedTierForSingleCoreScore(singleCoreScore));
    },
  );

  it.each([
    ['iPhone18,1', EDeviceCpuTier.high],
    ['iPad7,1', EDeviceCpuTier.low],
  ])('contains the iOS model ID %s', (modelId, expectedTier) => {
    const key = normalizeDeviceCpuTierKeyPart(modelId);

    expect(getIosDeviceCpuTier(key)).toBe(expectedTier);
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
    expect(getIosDeviceCpuTier('__proto__')).toBeUndefined();
    expect(getIosDeviceCpuTier('constructor')).toBeUndefined();
  });
});
