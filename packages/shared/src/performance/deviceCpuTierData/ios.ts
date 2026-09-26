/* cspell:disable -- device catalog identifiers */
import {
  type TKnownDeviceCpuTier,
  isKnownDeviceCpuTier,
} from '../devicePerformanceTierTypes';

// Business tiers use Geekbench 6 single-core thresholds: low < 1000,
// medium 1000-1799, and high >= 1800. These are not Geekbench classifications.
export const IOS_DEVICE_CPU_TIER_BY_MODEL_ID: Readonly<
  Record<string, TKnownDeviceCpuTier>
> = {
  'ipad11,1': 'medium',
  'ipad11,2': 'medium',
  'ipad11,3': 'medium',
  'ipad11,4': 'medium',
  'ipad11,6': 'medium',
  'ipad11,7': 'medium',
  'ipad12,1': 'medium',
  'ipad12,2': 'medium',
  'ipad13,1': 'high',
  'ipad13,10': 'high',
  'ipad13,11': 'high',
  'ipad13,16': 'high',
  'ipad13,17': 'high',
  'ipad13,18': 'high',
  'ipad13,19': 'high',
  'ipad13,2': 'high',
  'ipad13,4': 'high',
  'ipad13,5': 'high',
  'ipad13,6': 'high',
  'ipad13,7': 'high',
  'ipad13,8': 'high',
  'ipad13,9': 'high',
  'ipad14,1': 'high',
  'ipad14,10': 'high',
  'ipad14,11': 'high',
  'ipad14,2': 'high',
  'ipad14,3': 'high',
  'ipad14,4': 'high',
  'ipad14,5': 'high',
  'ipad14,6': 'high',
  'ipad14,8': 'high',
  'ipad14,9': 'high',
  'ipad15,3': 'high',
  'ipad15,4': 'high',
  'ipad15,5': 'high',
  'ipad15,6': 'high',
  'ipad15,7': 'high',
  'ipad15,8': 'high',
  'ipad16,1': 'high',
  'ipad16,10': 'high',
  'ipad16,11': 'high',
  'ipad16,2': 'high',
  'ipad16,3': 'high',
  'ipad16,4': 'high',
  'ipad16,5': 'high',
  'ipad16,6': 'high',
  'ipad16,8': 'high',
  'ipad16,9': 'high',
  'ipad5,1': 'low',
  'ipad5,2': 'low',
  'ipad5,3': 'low',
  'ipad5,4': 'low',
  'ipad6,11': 'low',
  'ipad6,12': 'low',
  'ipad6,3': 'low',
  'ipad6,4': 'low',
  'ipad7,1': 'low',
  'ipad7,11': 'low',
  'ipad7,12': 'low',
  'ipad7,2': 'low',
  'ipad7,3': 'low',
  'ipad7,4': 'low',
  'ipad7,5': 'low',
  'ipad7,6': 'low',
  'ipad8,10': 'medium',
  'ipad8,11': 'medium',
  'ipad8,12': 'medium',
  'ipad8,5': 'medium',
  'ipad8,6': 'medium',
  'ipad8,7': 'medium',
  'ipad8,8': 'medium',
  'ipad8,9': 'medium',
  'iphone10,1': 'medium',
  'iphone10,2': 'medium',
  'iphone10,3': 'medium',
  'iphone10,4': 'medium',
  'iphone10,5': 'medium',
  'iphone10,6': 'medium',
  'iphone11,2': 'medium',
  'iphone11,4': 'medium',
  'iphone11,6': 'medium',
  'iphone11,8': 'medium',
  'iphone12,1': 'medium',
  'iphone12,3': 'medium',
  'iphone12,5': 'medium',
  'iphone12,8': 'medium',
  'iphone13,1': 'high',
  'iphone13,2': 'high',
  'iphone13,3': 'high',
  'iphone13,4': 'high',
  'iphone14,2': 'high',
  'iphone14,3': 'high',
  'iphone14,4': 'high',
  'iphone14,5': 'high',
  'iphone14,6': 'high',
  'iphone14,7': 'high',
  'iphone14,8': 'high',
  'iphone15,2': 'high',
  'iphone15,3': 'high',
  'iphone15,4': 'high',
  'iphone15,5': 'high',
  'iphone16,1': 'high',
  'iphone16,2': 'high',
  'iphone17,1': 'high',
  'iphone17,2': 'high',
  'iphone17,3': 'high',
  'iphone17,4': 'high',
  'iphone17,5': 'high',
  'iphone18,1': 'high',
  'iphone18,2': 'high',
  'iphone18,3': 'high',
  'iphone18,4': 'high',
  'iphone18,5': 'high',
  'iphone8,1': 'low',
  'iphone8,2': 'low',
  'iphone8,4': 'low',
  'iphone9,1': 'low',
  'iphone9,2': 'low',
  'iphone9,3': 'low',
  'iphone9,4': 'low',
};

const IOS_MODEL_ID_PATTERN = /^([a-z]+)(\d+),(\d+)$/;

function parseIosModelId(
  modelId: string,
): { prefix: string; family: number; model: number } | null {
  const matched = IOS_MODEL_ID_PATTERN.exec(modelId);
  if (!matched) {
    return null;
  }
  return {
    prefix: matched[1],
    family: Number(matched[2]),
    model: Number(matched[3]),
  };
}

const CATALOG_MAX_BY_PREFIX: Readonly<Record<string, [number, number]>> =
  Object.keys(IOS_DEVICE_CPU_TIER_BY_MODEL_ID).reduce<
    Record<string, [number, number]>
  >((max, key) => {
    const parsed = parseIosModelId(key);
    if (!parsed) {
      return max;
    }
    const current = max[parsed.prefix];
    const isNewer =
      !current ||
      parsed.family > current[0] ||
      (parsed.family === current[0] && parsed.model > current[1]);
    if (isNewer) {
      max[parsed.prefix] = [parsed.family, parsed.model];
    }
    return max;
  }, {});

// The catalog is a snapshot, and Apple does not ship slower silicon than the
// generation before it. So a model id above everything the catalog knows is a
// device released after this build, not a weak one. Ranking it `unknown` made
// the newest hardware fall to the most conservative policy — an unreleased-at
// -build-time iPad Pro would preload less than an iPhone 13. A gap at or below
// the catalog's range is different: that is a device we chose not to rank, so
// it stays unknown.
export function isIosModelIdNewerThanCatalog(modelId: string): boolean {
  const parsed = parseIosModelId(modelId);
  if (!parsed) {
    return false;
  }
  const max = CATALOG_MAX_BY_PREFIX[parsed.prefix];
  if (!max) {
    return false;
  }
  return (
    parsed.family > max[0] ||
    (parsed.family === max[0] && parsed.model > max[1])
  );
}

export function getIosDeviceCpuTier(
  modelId: string,
): TKnownDeviceCpuTier | undefined {
  if (
    !Object.prototype.hasOwnProperty.call(
      IOS_DEVICE_CPU_TIER_BY_MODEL_ID,
      modelId,
    )
  ) {
    return undefined;
  }
  const tier = IOS_DEVICE_CPU_TIER_BY_MODEL_ID[modelId];
  return isKnownDeviceCpuTier(tier) ? tier : undefined;
}
