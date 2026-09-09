export const DEFAULT_TPSL_ROE_PERCENT = '10';

export interface ITpSlPercentValues {
  tpType: 'price' | 'percentage';
  tpValue: string;
  slType: 'price' | 'percentage';
  slValue: string;
}

export function buildDefaultTpSlPercent(
  values: Partial<ITpSlPercentValues> = {},
): ITpSlPercentValues {
  const tpValue = values.tpValue?.trim() ?? '';
  const slValue = values.slValue?.trim() ?? '';
  return {
    tpType: tpValue ? (values.tpType ?? 'price') : 'percentage',
    tpValue: tpValue || DEFAULT_TPSL_ROE_PERCENT,
    slType: slValue ? (values.slType ?? 'price') : 'percentage',
    slValue: slValue || DEFAULT_TPSL_ROE_PERCENT,
  };
}

export function shouldSeedPositionTpSlLeg({
  hasExistingOrder,
  hasPreset,
  currentValue,
  userEdited,
  seeded,
}: {
  hasExistingOrder: boolean;
  hasPreset: boolean;
  currentValue: string;
  userEdited: boolean;
  seeded: boolean;
}) {
  return Boolean(
    !hasExistingOrder &&
    !hasPreset &&
    !currentValue.trim() &&
    !userEdited &&
    !seeded,
  );
}
