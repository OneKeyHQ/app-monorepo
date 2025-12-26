import { Icon, XStack, useMedia } from '@onekeyhq/components';
import type { IXStackProps } from '@onekeyhq/components';

export type IMarketNetworkStartFilterItemProps = {
  isSelected?: boolean;
} & IXStackProps;

export function MarketNetworkStartFilterItem({
  isSelected,
  ...rest
}: IMarketNetworkStartFilterItemProps) {
  const { md } = useMedia();
  return (
    <XStack
      alignItems="center"
      justifyContent="center"
      px="$2.5"
      py="$1.5"
      gap={md ? '$1' : '$2'}
      borderRadius={md ? '$full' : '$2.5'}
      userSelect="none"
      backgroundColor={isSelected ? '$bgActive' : '$transparent'}
      {...(!isSelected && {
        focusable: true,
        hoverStyle: {
          bg: '$bgStrongHover',
        },
        pressStyle: {
          bg: '$bgStrongActive',
        },
        focusVisibleStyle: {
          outlineWidth: 2,
          outlineStyle: 'solid',
          outlineColor: '$focusRing',
        },
      })}
      {...rest}
    >
      <Icon
        size="$4.5"
        width="$4.5"
        name={isSelected ? 'StarSolid' : 'StarOutline'}
      />
    </XStack>
  );
}
