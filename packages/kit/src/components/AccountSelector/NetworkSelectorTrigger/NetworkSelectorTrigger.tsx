import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IXStackProps } from '@onekeyhq/components';
import {
  Icon,
  NATIVE_HIT_SLOP,
  Select,
  SizableText,
  XStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';
import { useDebugComponentRemountLog } from '@onekeyhq/shared/src/utils/debug/debugUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useShortcutsOnRouteFocused } from '../../../hooks/useShortcutsOnRouteFocused';
import {
  useAccountSelectorActions,
  useAccountSelectorStorageReadyAtom,
  useSelectedAccount,
} from '../../../states/jotai/contexts/accountSelector';
import useConfigurableChainSelector from '../../../views/ChainSelector/hooks/useChainSelector';
import { ChainSelectorInput } from '../../ChainSelectorInput';
import { NetworkAvatar } from '../../NetworkAvatar';
import { useNetworkSelectorTrigger } from '../hooks/useNetworkSelectorTrigger';

import type { IChainSelectorInputProps } from '../../ChainSelectorInput';

function useNetworkSelectorItems() {
  const { serviceNetwork } = backgroundApiProxy;

  const allNetworksRes = usePromiseResult(
    () => serviceNetwork.getAllNetworks(),
    [serviceNetwork],
  );
  const items = useMemo(
    () =>
      allNetworksRes.result?.networks.map((item) => ({
        value: item.id,
        label: item.name,
      })) || [],
    [allNetworksRes.result?.networks],
  );

  return items;
}

export function NetworkSelectorTriggerLegacyCmp({ num }: { num: number }) {
  const items = useNetworkSelectorItems();

  const { selectedAccount } = useSelectedAccount({ num });
  const actions = useAccountSelectorActions();
  const [isReady] = useAccountSelectorStorageReadyAtom();

  useDebugComponentRemountLog({ name: 'NetworkSelectorTriggerLegacy' });

  if (!isReady) {
    return null;
  }

  return (
    <>
      <SizableText size="$headingXl">
        网络选择器 {selectedAccount.networkId}
      </SizableText>
      <Select
        items={items}
        value={selectedAccount.networkId}
        onChange={(id) =>
          actions.current.updateSelectedAccountNetwork({
            num,
            networkId: id,
          })
        }
        title="网络"
      />
    </>
  );
}

export const NetworkSelectorTriggerLegacy = memo(
  NetworkSelectorTriggerLegacyCmp,
);

function NetworkSelectorTriggerHomeCmp({
  num,
  recordNetworkHistoryEnabled,
  hideOnNoAccount = false,
  size = 'large',
}: {
  num: number;
  recordNetworkHistoryEnabled?: boolean;
  hideOnNoAccount?: boolean;
  size?: 'small' | 'large';
}) {
  const {
    activeAccount: { network, accountName },
    showChainSelector,
  } = useNetworkSelectorTrigger({ num });

  const intl = useIntl();

  useDebugComponentRemountLog({ name: 'NetworkSelectorTriggerHome' });

  useShortcutsOnRouteFocused(
    EShortcutEvents.NetworkSelector,
    showChainSelector,
  );

  const networkTriggerText = useMemo(() => {
    if (network?.isAllNetworks) {
      return `${intl.formatMessage({
        id: ETranslations.global_all_networks,
      })}`;
    }

    return network?.name;
  }, [intl, network?.isAllNetworks, network?.name]);

  const isLarge = size === 'large';

  if (hideOnNoAccount && !accountName) {
    return null;
  }

  return (
    <XStack
      testID="account-network-trigger-button"
      role="button"
      flexShrink={1}
      alignItems="center"
      p="$1"
      m="$-1"
      borderRadius="$2"
      hoverStyle={{
        bg: '$bgHover',
      }}
      pressStyle={{
        bg: '$bgActive',
      }}
      focusable
      focusVisibleStyle={{
        outlineWidth: 2,
        outlineColor: '$focusRing',
        outlineStyle: 'solid',
      }}
      hitSlop={NATIVE_HIT_SLOP}
      userSelect="none"
      onPress={() => showChainSelector({ recordNetworkHistoryEnabled })}
    >
      <NetworkAvatar networkId={network?.id} size={isLarge ? '$5' : '$6'} />
      {isLarge ? (
        <>
          <SizableText
            testID="account-network-trigger-button-text"
            pl="$2"
            size="$bodyMd"
            maxWidth="$28"
            $gtXl={{
              maxWidth: '$32',
            }}
            flexShrink={1}
            numberOfLines={1}
          >
            {networkTriggerText}
          </SizableText>
          <Icon
            name="ChevronDownSmallOutline"
            color="$iconSubdued"
            size="$5"
            flexShrink={0}
          />
        </>
      ) : null}
    </XStack>
  );
}

export const NetworkSelectorTriggerHome = memo(NetworkSelectorTriggerHomeCmp);

export function ControlledNetworkSelectorTrigger({
  forceDisabled,
  disabled,
  networkIds,
  ...rest
}: IChainSelectorInputProps & {
  forceDisabled?: boolean;
  disabled?: boolean; // TODO not working in form
  networkIds?: string[];
}) {
  const intl = useIntl();
  return (
    <ChainSelectorInput
      testID="network-selector-input"
      title={intl.formatMessage({ id: ETranslations.global_networks })}
      borderRadius="$3"
      borderWidth={1}
      borderCurve="continuous"
      borderColor="$borderStrong"
      userSelect="none"
      px="$3"
      py="$2.5"
      $gtMd={{
        borderRadius: '$2',
        py: '$2',
      }}
      {...rest}
      disabled={forceDisabled || disabled}
      networkIds={networkIds}
    />
  );
}

export function ControlledNetworkSelectorIconTrigger({
  disabled,
  networkIds,
  value,
  excludeAllNetworkItem,
  title,
  onChange,
  ...rest
}: IChainSelectorInputProps & {
  forceDisabled?: boolean;
  disabled?: boolean; // TODO not working in form
  networkIds?: string[];
}) {
  const openChainSelector = useConfigurableChainSelector();

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
    { initResult: [] },
  );

  const current = useMemo(() => {
    const item = selectorNetworks.find((o) => o.id === value);
    return item;
  }, [selectorNetworks, value]);

  const onPress = useCallback(() => {
    if (disabled) {
      return;
    }
    openChainSelector({
      title,
      networkIds: selectorNetworks.map((o) => o.id),
      defaultNetworkId: current?.id,
      onSelect: (network) => onChange?.(network.id),
    });
  }, [
    disabled,
    openChainSelector,
    title,
    selectorNetworks,
    current?.id,
    onChange,
  ]);
  return (
    <XStack
      testID="account-network-trigger-button"
      role="button"
      flexShrink={1}
      alignItems="center"
      p="$1"
      m="$-1"
      borderRadius="$2"
      hoverStyle={
        {
          bg: '$bgHover',
        } as any
      }
      pressStyle={
        {
          bg: '$bgActive',
        } as any
      }
      focusable
      focusVisibleStyle={
        {
          outlineWidth: 2,
          outlineColor: '$focusRing',
          outlineStyle: 'solid',
        } as any
      }
      hitSlop={NATIVE_HIT_SLOP}
      userSelect="none"
      onPress={onPress}
      {...(rest as IXStackProps)}
    >
      <NetworkAvatar networkId={current?.id} size="$6" />
    </XStack>
  );
}
