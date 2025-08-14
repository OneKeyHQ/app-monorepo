import { Image, SizableText, XStack, useMedia } from '@onekeyhq/components';
import type { IXStackProps } from '@onekeyhq/components';

export type INetworksFilterItemProps = {
  networkImageUri?: string;
  networkName?: string;
  isSelected?: boolean;
  disabled?: boolean;
} & IXStackProps;

export function NetworksFilterItem({
  networkImageUri,
  networkName,
  isSelected,
  disabled,
  ...rest
}: INetworksFilterItemProps) {
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
      {...(!isSelected &&
        !disabled && {
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
      {...(disabled && {
        opacity: 0.5,
      })}
      {...rest}
    >
      {networkImageUri && (!md || isSelected) ? (
        <Image
          size={md ? '$5' : '$6'}
          width={md ? '$5' : '$6'}
          borderRadius="$full"
          $gtMd={
            {
              height: '$5',
              width: '$5',
            } as any
          }
          source={{
            uri: networkImageUri,
          }}
        />
      ) : null}
      {networkName ? (
        <SizableText
          numberOfLines={1}
          color={isSelected ? '$text' : '$textSubdued'}
          size="$bodyMdMedium"
        >
          {networkName}
        </SizableText>
      ) : null}
    </XStack>
  );
}
