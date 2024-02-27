import { Image, SizableText, Tooltip, XStack } from '@onekeyhq/components';
import type { IXStackProps } from '@onekeyhq/components';

export type INetworksFilterItemProps = {
  networkImageUri?: string;
  networkName?: string;
  isSelected?: boolean;
  tooltipContent?: string;
} & IXStackProps;

export function NetworksFilterItem({
  networkImageUri,
  networkName,
  isSelected,
  tooltipContent,
  ...rest
}: INetworksFilterItemProps) {
  const BaseComponent = (
    <XStack
      justifyContent="center"
      px="$3"
      py="$1.5"
      bg={isSelected ? '$bgPrimary' : '$bgStrong'}
      borderRadius="$2"
      userSelect="none"
      style={{
        borderCurve: 'continuous',
      }}
      {...(!isSelected && {
        focusable: true,
        hoverStyle: {
          bg: '$bgStrongHover',
        },
        pressStyle: {
          bg: '$bgStrongActive',
        },
        focusStyle: {
          outlineWidth: 2,
          outlineStyle: 'solid',
          outlineColor: '$focusRing',
        },
      })}
      {...rest}
    >
      {networkImageUri && (
        <Image
          height="$6"
          width="$6"
          borderRadius="$full"
          $gtMd={{
            height: '$5',
            width: '$5',
          }}
        >
          <Image.Source
            source={{
              uri: networkImageUri,
            }}
          />
        </Image>
      )}
      {networkName && (
        <SizableText
          color={isSelected ? '$textOnColor' : '$textSubdued'}
          size="$bodyLgMedium"
          $gtMd={{
            size: '$bodyMdMedium',
          }}
        >
          {networkName}
        </SizableText>
      )}
    </XStack>
  );

  if (!tooltipContent) return BaseComponent;

  return (
    <Tooltip
      renderContent={tooltipContent}
      placement="top"
      renderTrigger={BaseComponent}
    />
  );
}
