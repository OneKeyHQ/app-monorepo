import { Icon } from '@onekeyhq/components';
import type { IIconProps } from '@onekeyhq/components';

import { collateralBadgeVariant } from '../collateralControls.utils';

// Three-state "Can be collateral" indicator. "Cannot be collateral" is a
// neutral asset property, not an error — dash, never a cross.
export function CollateralBadge({
  canBeCollateral,
  ml,
}: {
  canBeCollateral?: boolean;
  ml?: IIconProps['ml'];
}) {
  const variant = collateralBadgeVariant(canBeCollateral);
  if (!variant) return null;
  const can = variant === 'can';
  return (
    <Icon
      br="$1"
      bg={can ? '$bgSuccess' : '$bgSubdued'}
      ml={ml}
      name={can ? 'Checkmark2SmallOutline' : 'MinusSmallOutline'}
      size="$5"
      w="$5"
      h="$5"
      flexShrink={0}
      color={can ? '$iconSuccess' : '$iconSubdued'}
    />
  );
}
