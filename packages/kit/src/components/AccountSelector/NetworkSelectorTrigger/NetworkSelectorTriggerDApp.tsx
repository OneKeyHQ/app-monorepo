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
  loadingDuration?: number;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
}>(({ num, disabled, beforeShowTrigger, loadingDuration, ...rest }, _: any) => {
  const { isLoading } = useMockAccountSelectorLoading(loadingDuration);
  const {
    activeAccount: { network },
    showChainSelector,
    networkIds,
  } = useNetworkSelectorTrigger({ num });

  const triggerDisabled = disabled || (networkIds ?? []).length <= 1;

  const handlePress = useCallback(async () => {
    await beforeShowTrigger?.();
    showChainSelector();
  }, [beforeShowTrigger, showChainSelector]);

  const renderNetworkIcon = useCallback(() => {
    if (isLoading) {
      return <Skeleton w="$5" h="$5" />;
    }
    if (network?.logoURI) {
      return <NetworkAvatar networkId={network?.id} size="$5" />;
    }

    return <Icon size="$5" name="QuestionmarkOutline" color="$iconSubdued" />;
  }, [isLoading, network?.logoURI, network?.id]);

  const renderNetworkName = useCallback(() => {
    if (isLoading) {
      return <Skeleton w="$14" h="$5" />;
    }
    return <SizableText size="$bodyMd">{network?.name}</SizableText>;
  }, [isLoading, network?.name]);

  return (
    <XStack
      alignItems="center"
      onPress={handlePress}
      h="$10"
      px="$3"
      hoverStyle={
        triggerDisabled
          ? undefined
          : {
              bg: '$bgHover',
            }
      }
      pressStyle={
        triggerDisabled
          ? undefined
          : {
              bg: '$bgActive',
            }
      }
      focusable={!triggerDisabled}
      focusStyle={
        triggerDisabled
          ? undefined
          : {
              outlineWidth: 2,
              outlineColor: '$focusRing',
              outlineStyle: 'solid',
            }
      }
      borderCurve="continuous"
      disabled={triggerDisabled}
      space="$2"
      {...rest}
    >
      {renderNetworkIcon()}
      {renderNetworkName()}
      {triggerDisabled ? null : (
        <Icon
          ml="$-2"
          name="ChevronDownSmallOutline"
          color="$iconSubdued"
          size="$5"
        />
      )}
    </XStack>
  );
});

export function NetworkSelectorTriggerBrowserSingle({ num }: { num: number }) {
  const {
    activeAccount: { network },
    showChainSelector,
    networkIds,
  } = useNetworkSelectorTrigger({ num });

  const media = useMedia();

  const triggerDisabled = (networkIds ?? []).length <= 1;
  const handlePress = useCallback(async () => {
    showChainSelector();
  }, [showChainSelector]);

  return (
    <XStack
      role="button"
      alignItems="center"
      p="$1.5"
      borderRadius="$2"
      hoverStyle={
        triggerDisabled
          ? undefined
          : {
              bg: '$bgHover',
            }
      }
      pressStyle={
        triggerDisabled
          ? undefined
          : {
              bg: '$bgActive',
            }
      }
      focusable={!triggerDisabled}
      focusStyle={
        triggerDisabled
          ? undefined
          : {
              outlineWidth: 2,
              outlineColor: '$focusRing',
              outlineStyle: 'solid',
            }
      }
      onPress={handlePress}
      disabled={triggerDisabled}
      maxWidth="$40"
      minWidth={0}
    >
      <NetworkAvatar networkId={network?.id} size="$6" />
      {media.gtMd ? (
        <>
          <SizableText pl="$2" size="$bodyMdMedium" numberOfLines={1}>
            {network?.name}
          </SizableText>
          {triggerDisabled ? null : (
            <Icon
              name="ChevronDownSmallOutline"
              color="$iconSubdued"
              size="$5"
            />
          )}
        </>
      ) : null}
    </XStack>
  );
}
