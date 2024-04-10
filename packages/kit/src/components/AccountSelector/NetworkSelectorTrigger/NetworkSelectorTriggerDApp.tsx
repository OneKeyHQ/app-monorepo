import { useCallback } from 'react';

import {
  Icon,
  SizableText,
  Skeleton,
  XStack,
  useMedia,
} from '@onekeyhq/components';

import { NetworkAvatar } from '../../NetworkAvatar';
import { useMockAccountSelectorLoading } from '../hooks/useAccountSelectorTrigger';
import { useNetworkSelectorTrigger } from '../hooks/useNetworkSelectorTrigger';

export const NetworkSelectorTriggerDappConnection = XStack.styleable<{
  num: number;
  beforeShowTrigger?: () => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
}>(({ num, disabled, beforeShowTrigger, ...rest }, _: any) => {
  const { isLoading } = useMockAccountSelectorLoading();
  const {
    activeAccount: { network },
    showChainSelector,
  } = useNetworkSelectorTrigger({ num });

  const handlePress = useCallback(async () => {
    await beforeShowTrigger?.();
    showChainSelector();
  }, [beforeShowTrigger, showChainSelector]);

  return (
    <XStack
      alignItems="center"
      onPress={handlePress}
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
      borderCurve="continuous"
      disabled={disabled}
      {...rest}
    >
      {isLoading ? (
        <Skeleton w="$6" h="$6" />
      ) : (
        <NetworkAvatar networkId={network?.id} size="$6" />
      )}
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

  const media = useMedia();

  const handlePress = useCallback(async () => {
    showChainSelector();
  }, [showChainSelector]);

  return (
    <XStack
      role="button"
      alignItems="center"
      p="$1.5"
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
      onPress={handlePress}
    >
      <NetworkAvatar networkId={network?.id} size="$6" />
      {media.gtMd ? (
        <>
          <SizableText pl="$2" size="$bodyMdMedium" numberOfLines={1}>
            {network?.name}
          </SizableText>
          <Icon name="ChevronDownSmallOutline" color="$iconSubdued" size="$5" />
        </>
      ) : null}
    </XStack>
  );
}
