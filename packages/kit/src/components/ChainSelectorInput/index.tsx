import type { ComponentProps, FC } from 'react';
import { useCallback, useEffect, useMemo } from 'react';

import type { Input } from '@onekeyhq/components';
import { Icon, SizableText, Skeleton, Stack } from '@onekeyhq/components';
import { getSharedInputStyles } from '@onekeyhq/components/src/forms/Input/sharedStyles';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import useConfigurableChainSelector from '@onekeyhq/kit/src/views/ChainSelector/hooks/useChainSelector';
import { swrKeys } from '@onekeyhq/shared/src/utils/swrCacheUtils';

import { NetworkAvatar } from '../NetworkAvatar';

export type IChainSelectorInputProps = Pick<
  ComponentProps<typeof Input>,
  'value' | 'disabled' | 'error' | 'editable' | 'size'
> & {
  networkIds?: string[];
  testID?: string;
  onChange?: (value: string) => void;
  title?: string;
  excludeAllNetworkItem?: boolean;
  miniMode?: boolean;
} & Omit<ComponentProps<typeof Stack>, 'onChange'>;

export const ChainSelectorInput: FC<IChainSelectorInputProps> = ({
  value,
  disabled,
  error,
  editable,
  size,
  onChange,
  title,
  networkIds,
  excludeAllNetworkItem,
  miniMode,
  ...rest
}) => {
  const { result: selectorNetworks } = usePromiseResult(
    async () => {
      const { networks } =
        await backgroundApiProxy.serviceNetwork.getAllNetworks({
          excludeAllNetworkItem,
        });
      if (networkIds && networkIds.length > 0) {
        return networks.filter((o) => networkIds.includes(o.id));
      }
      return networks;
    },
    [excludeAllNetworkItem, networkIds],
    {
      initResult: [],
      // Snapshot the list so the selected network name paints on the first
      // frame of later visits instead of an empty box (OK-61586).
      swrKey: swrKeys.chainSelectorInputNetworks({
        excludeAllNetworkItem,
        networkIds,
      }),
    },
  );

  const current = useMemo(() => {
    const item = selectorNetworks.find((o) => o.id === value);
    return item;
  }, [selectorNetworks, value]);
  // A value is set but the list has not resolved yet: show a size-stable
  // placeholder rather than an empty selector.
  const isResolvingCurrent = Boolean(value) && selectorNetworks.length === 0;

  useEffect(() => {
    if (selectorNetworks.length && !current) {
      const fallbackValue = selectorNetworks?.[0]?.id;
      if (fallbackValue) {
        onChange?.(fallbackValue);
      }
    }
  }, [selectorNetworks, current, onChange]);

  const sharedStyles = getSharedInputStyles({
    disabled,
    error,
    editable,
    size,
  });

  const openChainSelector = useConfigurableChainSelector();

  const isReadOnly = disabled || editable === false;

  const onPress = useCallback(() => {
    if (isReadOnly) {
      return;
    }
    openChainSelector({
      title,
      networkIds: selectorNetworks.map((o) => o.id),
      defaultNetworkId: current?.id,
      onSelect: (network) => onChange?.(network.id),
    });
  }, [
    isReadOnly,
    openChainSelector,
    title,
    selectorNetworks,
    current?.id,
    onChange,
  ]);

  if (miniMode) {
    return (
      <Stack onPress={onPress} px="$3" py="$2.5" {...rest}>
        <NetworkAvatar networkId={current?.id} size="$6" />
      </Stack>
    );
  }

  return (
    <Stack
      userSelect="none"
      onPress={onPress}
      flexDirection="row"
      alignItems="center"
      borderRadius="$3"
      borderWidth={1}
      borderCurve="continuous"
      borderColor={sharedStyles.borderColor}
      backgroundColor={sharedStyles.backgroundColor}
      // ChainSelectorInput is a button-like selector, not a text field, so
      // override sharedStyles.cursor (which would default to 'text' for the
      // Input use case) with selector semantics.
      cursor={isReadOnly ? 'default' : 'pointer'}
      px="$3"
      py="$2.5"
      $gtMd={{
        borderRadius: '$2',
        py: '$2',
      }}
      testID="network-selector-input"
      {...(!isReadOnly && {
        hoverStyle: {
          bg: '$bgHover',
        },
        pressStyle: {
          bg: '$bgActive',
        },
      })}
      {...rest}
    >
      {isResolvingCurrent ? (
        <Skeleton w="$6" h="$6" radius="round" />
      ) : (
        <NetworkAvatar networkId={current?.id} size="$6" />
      )}
      {isResolvingCurrent ? (
        <Stack px={sharedStyles.px} flex={1}>
          <Skeleton.BodyLg width="$24" />
        </Stack>
      ) : (
        <SizableText
          testID="network-selector-input-text"
          px={sharedStyles.px}
          flex={1}
          size={size === 'small' ? '$bodyMd' : '$bodyLg'}
          color={sharedStyles.color}
        >
          {current?.name ?? ''}
        </SizableText>
      )}
      {!isReadOnly ? (
        <Icon name="ChevronDownSmallOutline" mr="$-0.5" color="$iconSubdued" />
      ) : null}
    </Stack>
  );
};
