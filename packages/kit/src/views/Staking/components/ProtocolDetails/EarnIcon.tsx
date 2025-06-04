import type { IIconProps } from '@onekeyhq/components';
import { Icon } from '@onekeyhq/components';
import type { IEarnIcon } from '@onekeyhq/shared/types/staking';

export function EarnIcon({
  icon,
  color,
  size,
  ...props
}: { icon?: IEarnIcon } & Omit<IIconProps, 'name'>) {
  return icon ? (
    <Icon
      color={icon.color || color}
      size={icon.size || size}
      name={icon.icon}
      {...props}
    />
  ) : null;
}
