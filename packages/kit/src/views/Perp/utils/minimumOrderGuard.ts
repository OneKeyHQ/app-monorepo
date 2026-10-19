export function shouldApplyMinimumOrderGuard({
  isSpot,
  orderMode,
  orderType,
  hasBboPriceMode,
}: {
  isSpot: boolean;
  orderMode?: 'standard' | 'trigger' | 'scale' | 'twap';
  orderType?: 'market' | 'limit';
  hasBboPriceMode?: boolean;
}) {
  if (orderMode === 'twap') {
    return false;
  }
  return !(
    isSpot &&
    orderMode === 'standard' &&
    orderType === 'limit' &&
    !hasBboPriceMode
  );
}
