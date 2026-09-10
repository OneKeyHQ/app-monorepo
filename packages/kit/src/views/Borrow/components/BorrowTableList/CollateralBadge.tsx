import { Icon } from '@onekeyhq/components';
import type { IIconProps } from '@onekeyhq/components';

import { collateralBadgeVariant } from '../collateralControls.utils';

// Three-state "Can be collateral" indicator. "Cannot be collateral" is a
// neutral asset property, not an error — dash, never a cross.
export function CollateralBadge({
  canBeCollateral,
  ml,
  // The neutral chip reads as a chip only against a lighter surface. On a card
  // that is itself $bgSubdued the default renders at 1.00:1 — the container
  // disappears and only the glyph survives — so those callers pass their own.
  bg = '$bgSubdued',
}: {
  canBeCollateral?: boolean;
  ml?: IIconProps['ml'];
  bg?: IIconProps['bg'];
}) {
  const variant = collateralBadgeVariant(canBeCollateral);
  if (!variant) return null;
  const can = variant === 'can';
  return (
    <Icon
      br="$1"
      bg={can ? '$bgSuccess' : bg}
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
