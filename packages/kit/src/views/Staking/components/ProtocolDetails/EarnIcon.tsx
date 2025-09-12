import type { IIconProps } from '@onekeyhq/components';
import { Icon, Image } from '@onekeyhq/components';
import type { IEarnIcon } from '@onekeyhq/shared/types/staking';

export function EarnIcon({
  icon,
  color,
  size,
  ...props
}: { icon?: IEarnIcon } & Omit<IIconProps, 'name'>) {
  if (icon?.icon.startsWith('http')) {
    return (
      <Image
        source={{ uri: icon.icon }}
        width={size || icon.size}
        height={size || icon.size}
        borderRadius="$1"
        {...(props as any)}
      />
    );
  }
  return icon ? (
    <Icon
      color={color || icon.color}
      size={size || icon.size}
      name={icon.icon}
      {...props}
    />
  ) : null;
}
