import {
  ANDROID_DEVICE_CPU_TIER_BY_MANUFACTURER,
  getAndroidDeviceCpuTier,
} from './deviceCpuTierData/android';
import {
  getIosDeviceCpuTier,
  isIosModelIdNewerThanCatalog,
} from './deviceCpuTierData/ios';
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

  it('ranks the iPhone and iPad models the catalog previously omitted', () => {
    // Every one of these resolved to `unknown` before, which dropped the
    // newest hardware to the most conservative preload policy.
    for (const modelId of [
      'iphone17,5', // iPhone 16e
      'iphone18,5', // iPhone 17e
      'ipad14,3', // iPad Pro 11" 4th gen (M2)
      'ipad14,11', // iPad Air 13" 6th gen (M2)
      'ipad15,3', // iPad Air 11" 7th gen (M3)
      'ipad15,7', // iPad 11th gen (A16)
      'ipad16,2', // iPad mini 7th gen (A17 Pro)
      'ipad16,5', // iPad Pro 13" (M4)
      'ipad16,11', // iPad Air 13" 8th gen
    ]) {
      expect(getIosDeviceCpuTier(modelId)).toBe(EDeviceCpuTier.high);
    }
  });

  it('treats a model id past the catalog as newer hardware', () => {
    // Released after this build: a higher family, or a higher model inside the
    // highest family.
    expect(isIosModelIdNewerThanCatalog('iphone19,1')).toBe(true);
    expect(isIosModelIdNewerThanCatalog('iphone18,6')).toBe(true);
    expect(isIosModelIdNewerThanCatalog('ipad17,1')).toBe(true);
    expect(isIosModelIdNewerThanCatalog('ipad16,12')).toBe(true);
  });

  it('leaves gaps at or below the catalog range unknown', () => {
    // A gap inside the ranked range is a device we chose not to rank, not a
    // new one, so it must not inherit the newest-hardware assumption.
    expect(isIosModelIdNewerThanCatalog('iphone13,5')).toBe(false);
    expect(isIosModelIdNewerThanCatalog('ipad9,1')).toBe(false);
    expect(isIosModelIdNewerThanCatalog('ipad16,7')).toBe(false);
    // Simulators and anything unparsable stay unknown too.
    expect(isIosModelIdNewerThanCatalog('arm64')).toBe(false);
    expect(isIosModelIdNewerThanCatalog('x86_64')).toBe(false);
    expect(isIosModelIdNewerThanCatalog('')).toBe(false);
    expect(isIosModelIdNewerThanCatalog('__proto__')).toBe(false);
    // A prefix the catalog never ranks has no range to compare against.
    expect(isIosModelIdNewerThanCatalog('ipod99,1')).toBe(false);
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
