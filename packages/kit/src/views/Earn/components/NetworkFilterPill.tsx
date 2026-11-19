import { useMemo } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  Image,
  Popover,
  SizableText,
  Stack,
  Tooltip,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IStackProps } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatarBase } from '@onekeyhq/kit/src/components/NetworkAvatar/NetworkAvatar';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { buildKeyboardPressProps } from './desktopHome/earnDesktopPressable';
import { getQuickNetworkIds } from './networkFilter.utils';

// Market's network list stops growing here; the popover scrolls the rest
const LIST_MAX_HEIGHT = 420;

function PillSegment({
  testID,
  label,
  isSelected,
  selectedBg,
  selectedHoverBg,
  onPress,
  children,
  ...rest
}: {
  testID: string;
  label: string;
  isSelected: boolean;
  selectedBg: '$bgActive' | '$neutral6';
  /** A pick that a press takes back answers the pointer too */
  selectedHoverBg?: '$neutral7';
  onPress: () => void;
  children: ReactNode;
} & Pick<IStackProps, 'p' | 'px' | 'py'>) {
  let hoverStyle: IStackProps['hoverStyle'] = { bg: '$bgStrongHover' };
  if (isSelected) {
    hoverStyle = selectedHoverBg ? { bg: selectedHoverBg } : undefined;
  }
  return (
    <Stack
      testID={testID}
      role="button"
      aria-label={label}
      aria-pressed={isSelected}
      borderRadius="$full"
      bg={isSelected ? selectedBg : '$transparent'}
      hoverStyle={hoverStyle}
      pressStyle={isSelected ? undefined : { bg: '$bgStrongActive' }}
      cursor="pointer"
      userSelect="none"
      onPress={onPress}
      {...buildKeyboardPressProps(onPress)}
      {...rest}
    >
      {children}
    </Stack>
  );
}

/**
 * The desktop network filter, drawn as Market's network selector: "All", the
 * networks with the most items as icons, and the full list behind a chevron.
 * Where Market picks one network, this picks several: an icon or a row turns
 * its network on or off, "All" clears the picks, and the list stays open
 * while networks are ticked in it
 */
function NetworkFilterPill({
  testID = 'earn-network-pill',
  networks,
  selectedNetworkIds,
  networkAssetCounts,
  countLabel,
  isOpen,
  onOpenChange,
  onToggle,
  onReset,
}: {
  testID?: string;
  /** Every network on offer, the most items first */
  networks: IServerNetwork[];
  selectedNetworkIds: string[];
  networkAssetCounts: Record<string, number>;
  /** What the list's numbers count ("Tokens"), over their column */
  countLabel?: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onToggle: (networkId: string) => void;
  onReset: () => void;
}) {
  const intl = useIntl();
  const isAllSelected = selectedNetworkIds.length === 0;
  const allNetworksLabel = intl.formatMessage({
    id: ETranslations.global_all_networks,
  });

  const quickNetworks = useMemo(() => {
    const byId = new Map(networks.map((network) => [network.id, network]));
    return getQuickNetworkIds({
      orderedIds: networks.map((network) => network.id),
      selectedIds: selectedNetworkIds,
    })
      .map((networkId) => byId.get(networkId))
      .filter((network): network is IServerNetwork => Boolean(network));
  }, [networks, selectedNetworkIds]);

  const list = (
    <YStack py="$2">
      {/* The numbers' column named once, ending where the numbers do: bare,
          a "29" beside a network said nothing of what it counted (11-10) */}
      {countLabel ? (
        <XStack
          testID={`${testID}-count-label`}
          h="$6"
          mx="$2"
          px="$3"
          gap="$3"
          ai="center"
          jc="flex-end"
        >
          <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
            {countLabel}
          </SizableText>
          <Stack w="$5" />
        </XStack>
      ) : null}
      <ListItem
        testID={`${testID}-option-all`}
        h={48}
        mx="$2"
        px="$3"
        gap="$3"
        borderRadius="$3"
        renderAvatar={
          <NetworkAvatarBase
            // Drawn as the all-networks glyph; no logo to load
            logoURI=""
            isAllNetworks
            allNetworksIconProps={{ color: '$iconActive' }}
            size="$8"
          />
        }
        title={allNetworksLabel}
        onPress={onReset}
      >
        {isAllSelected ? <ListItem.CheckMark /> : <Stack w="$5" />}
      </ListItem>
      {networks.map((network) => {
        const isSelected = selectedNetworkIds.includes(network.id);
        const count = networkAssetCounts[network.id] ?? 0;
        return (
          <ListItem
            key={network.id}
            testID={`${testID}-option-${network.id}`}
            h={48}
            mx="$2"
            px="$3"
            gap="$3"
            borderRadius="$3"
            renderAvatar={
              <NetworkAvatarBase
                logoURI={network.logoURI}
                networkName={network.name}
                size="$8"
              />
            }
            title={network.name}
            onPress={() => onToggle(network.id)}
          >
            {count > 0 ? (
              <SizableText
                size="$bodyMd"
                color="$textSubdued"
                fontVariant={['tabular-nums']}
              >
                {String(count)}
              </SizableText>
            ) : null}
            {isSelected ? <ListItem.CheckMark /> : <Stack w="$5" />}
          </ListItem>
        );
      })}
    </YStack>
  );

  return (
    <XStack
      testID={testID}
      bg="$bgStrong"
      borderRadius="$full"
      p="$0.5"
      gap="$1"
      ai="center"
      flexShrink={0}
    >
      <PillSegment
        testID={`${testID}-all`}
        label={allNetworksLabel}
        isSelected={isAllSelected}
        selectedBg="$bgActive"
        onPress={onReset}
        px="$2"
        py="$1"
      >
        <SizableText
          size="$bodySm"
          color={isAllSelected ? '$text' : '$textSubdued'}
        >
          {intl.formatMessage({ id: ETranslations.global_all })}
        </SizableText>
      </PillSegment>
      {quickNetworks.map((network) => (
        <Tooltip
          key={network.id}
          placement="top"
          renderContent={network.name}
          renderTrigger={
            <PillSegment
              testID={`${testID}-${network.id}`}
              label={network.name}
              isSelected={selectedNetworkIds.includes(network.id)}
              selectedBg="$neutral6"
              selectedHoverBg="$neutral7"
              onPress={() => onToggle(network.id)}
              p="$1"
            >
              <Image
                width={17}
                height={17}
                borderRadius="$full"
                source={{ uri: network.logoURI }}
              />
            </PillSegment>
          }
        />
      ))}
      <Popover
        title={intl.formatMessage({ id: ETranslations.global_select_network })}
        showHeader={false}
        open={isOpen}
        onOpenChange={onOpenChange}
        placement="bottom-end"
        floatingPanelProps={{ width: 320, maxHeight: LIST_MAX_HEIGHT }}
        renderTrigger={
          <Stack
            testID={`${testID}-more`}
            role="button"
            aria-label={intl.formatMessage({
              id: ETranslations.global_select_network,
            })}
            aria-expanded={isOpen}
            p="$1"
            borderRadius="$full"
            hoverStyle={{ bg: '$bgStrongHover' }}
            pressStyle={{ bg: '$bgStrongActive' }}
            cursor="pointer"
            userSelect="none"
            // The popover's trigger opens the list after this press unless it
            // returns false, so a press on the open list closes it and stops
            onPress={() => {
              if (isOpen) {
                onOpenChange(false);
                return false;
              }
              return true;
            }}
            {...buildKeyboardPressProps(() => onOpenChange(!isOpen))}
          >
            <Icon
              name={
                isOpen ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'
              }
              size="$4"
              color="$iconSubdued"
            />
          </Stack>
        }
        renderContent={list}
      />
    </XStack>
  );
}

export { NetworkFilterPill };
