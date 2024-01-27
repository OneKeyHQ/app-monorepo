import { Icon, Image, SizableText, XStack } from '@onekeyhq/components';

import { useNetworkSelectorTrigger } from '../hooks/useNetworkSelectorTrigger';

export const NetworkSelectorTriggerDappConnection = XStack.styleable<{
  num: number;
}>(({ num, disabled, ...rest }) => {
  const {
    activeAccount: { network },
    showChainSelector,
  } = useNetworkSelectorTrigger({ num });

  return (
    <XStack
      alignItems="center"
      onPress={showChainSelector}
      pl="$3"
      pr="$1.5"
      bg="$bgSubdued"
      w="$16"
      hoverStyle={
        disabled
          ? undefined
          : {
              bg: '$bgHover',
            }
      }
      pressStyle={
        disabled
          ? undefined
          : {
              bg: '$bgActive',
            }
      }
      focusable={!disabled}
      focusStyle={
        disabled
          ? undefined
          : {
              outlineWidth: 2,
              outlineColor: '$focusRing',
              outlineStyle: 'solid',
            }
      }
      disabled={disabled}
      {...rest}
    >
      <Image
        w="$6"
        h="$6"
        source={{
          uri: network?.logoURI ? network?.logoURI : '',
        }}
      />
      {disabled ? null : (
        <Icon name="ChevronDownSmallOutline" color="$iconSubdued" size="$5" />
      )}
    </XStack>
  );
});

export function NetworkSelectorTriggerBrowserSingle({ num }: { num: number }) {
  const {
    activeAccount: { network },
    showChainSelector,
  } = useNetworkSelectorTrigger({ num });

  return (
    <XStack
      role="button"
      alignItems="center"
      p="$1.5"
      mx="$-1.5"
      borderRadius="$2"
      hoverStyle={{
        bg: '$bgHover',
      }}
      pressStyle={{
        bg: '$bgActive',
      }}
      focusable
      focusStyle={{
        outlineWidth: 2,
        outlineColor: '$focusRing',
        outlineStyle: 'solid',
      }}
      onPress={showChainSelector}
    >
      <Image
        w="$6"
        h="$6"
        source={{
          uri: network?.logoURI ? network?.logoURI : '',
        }}
      />
      <SizableText
        userSelect="none"
        pl="$2"
        size="$bodyMdMedium"
        numberOfLines={1}
      >
        {network?.name}
      </SizableText>
      <Icon name="ChevronDownSmallOutline" color="$iconSubdued" size="$5" />
    </XStack>
  );
}
