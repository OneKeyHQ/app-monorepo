import type { ComponentProps } from 'react';
import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  SizableText,
  Skeleton,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { useShortcutsOnRouteFocused } from '../../../hooks/useShortcutsOnRouteFocused';
import { useAccountSelectorSyncLoadingAtom } from '../../../states/jotai/contexts/accountSelector';
import { NetworkAvatar } from '../../NetworkAvatar';
import { useMockAccountSelectorLoading } from '../hooks/useAccountSelectorTrigger';
import { useNetworkSelectorTrigger } from '../hooks/useNetworkSelectorTrigger';

const InterNetworkIcon = ({
  network,
  isLoading,
}: {
  network?: IServerNetwork;
  isLoading?: boolean;
}) => {
  if (isLoading) {
    return <Skeleton w="$5" h="$5" />;
  }
  if (network?.id) {
    return <NetworkAvatar networkId={network?.id} size="$5" />;
  }

  return <Icon size="$5" name="QuestionmarkOutline" color="$iconSubdued" />;
};

const InterNetworkName = ({
  network,
  isLoading,
}: {
  network?: IServerNetwork;
  isLoading?: boolean;
}) => {
  if (isLoading) {
    return <Skeleton w="$14" h="$5" />;
  }
  return <SizableText size="$bodyMd">{network?.name}</SizableText>;
};

export const NetworkSelectorTriggerDappConnectionCmp = ({
  network,
  isLoading,
  triggerDisabled,
  handlePress,
  ...rest
}: {
  network?: IServerNetwork;
  isLoading?: boolean;
  triggerDisabled?: boolean;
  handlePress?: () => void;
} & ComponentProps<typeof XStack>) => (
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
    focusVisibleStyle={
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
    gap="$2"
    userSelect="none"
    {...rest}
  >
    <InterNetworkIcon network={network} isLoading={isLoading} />
    <InterNetworkName network={network} isLoading={isLoading} />
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

export const NetworkSelectorTriggerDappConnection = XStack.styleable<{
  num: number;
  beforeShowTrigger?: () => Promise<void>;
  loadingDuration?: number;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
}>(({ num, disabled, beforeShowTrigger, loadingDuration, ...rest }, _: any) => {
  const { isLoading: mockIsLoading } =
    useMockAccountSelectorLoading(loadingDuration);
  const [syncLoading] = useAccountSelectorSyncLoadingAtom();
  const isLoading = syncLoading?.[num]?.isLoading || mockIsLoading;

  const {
    activeAccount: { network },
    showChainSelector,
    networkIds,
  } = useNetworkSelectorTrigger({ num });

  const triggerDisabled =
    isLoading || disabled || (networkIds ?? []).length <= 1;

  const handlePress = useCallback(async () => {
    await beforeShowTrigger?.();
    showChainSelector();
  }, [beforeShowTrigger, showChainSelector]);

  return (
    <NetworkSelectorTriggerDappConnectionCmp
      handlePress={handlePress}
      network={network}
      isLoading={isLoading}
      triggerDisabled={triggerDisabled}
    />
  );
});

export function NetworkSelectorTriggerBrowserSingle({ num }: { num: number }) {
  const intl = useIntl();
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

  useShortcutsOnRouteFocused(EShortcutEvents.NetworkSelector, handlePress);
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
      focusVisibleStyle={
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
