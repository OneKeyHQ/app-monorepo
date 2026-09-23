import { useCallback, useState } from 'react';

import { Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { PendingIndicator } from '@onekeyhq/kit/src/views/Staking/components/StakingActivityIndicator';

/**
 * Which groups are open. A group is open when the user opened it, or when it
 * is the first in its list and the user never touched it. Lists on this page
 * re-order while accounts load, so this is kept as overrides keyed by group
 * rather than as state inside each row: a row that was first when it mounted
 * must not stay open once a richer group lands above it.
 */
export function useGroupExpansion() {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const isExpanded = useCallback(
    (key: string, index: number) => overrides[key] ?? index === 0,
    [overrides],
  );
  const toggle = useCallback((key: string, index: number) => {
    setOverrides((prev) => ({ ...prev, [key]: !(prev[key] ?? index === 0) }));
  }, []);
  return { isExpanded, toggle };
}

export type IGroupExpansion = ReturnType<typeof useGroupExpansion>;

/**
 * A collapsible group on either tab (figma 29180-108096 / 29180-109152):
 * logo, name, the group's figure and a chevron on one row, the group's
 * cards below it while open. Both the protocol groups and the ledger groups
 * render through this so the two tabs read the same.
 */
export function GroupRow({
  name,
  logoURI,
  networkId,
  total,
  pendingCount = 0,
  expanded,
  onToggle,
  testID,
  children,
}: {
  name: string;
  logoURI?: string;
  /** shown as the network badge on the logo when the group is one network */
  networkId?: string;
  total: React.ReactNode;
  pendingCount?: number;
  expanded: boolean;
  onToggle: () => void;
  testID?: string;
  children: React.ReactNode;
}) {
  return (
    <YStack gap="$3">
      <XStack
        ai="center"
        jc="space-between"
        gap="$3"
        minHeight={44}
        px="$5"
        cursor="pointer"
        userSelect="none"
        onPress={onToggle}
        testID={testID}
      >
        <XStack ai="center" gap="$2" flex={1} minWidth={0}>
          <Token
            size="sm"
            borderRadius="$2"
            tokenImageUri={logoURI}
            showNetworkIcon={Boolean(networkId)}
            networkId={networkId}
          />
          <SizableText size="$bodyLgMedium" numberOfLines={1}>
            {name}
          </SizableText>
          {pendingCount > 0 ? <PendingIndicator num={pendingCount} /> : null}
        </XStack>
        <XStack ai="center" gap="$2" flexShrink={0}>
          {total}
          <Icon
            name={
              expanded ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'
            }
            size="$5"
            color="$iconSubdued"
          />
        </XStack>
      </XStack>
      {expanded ? (
        <YStack px="$5" gap="$3">
          {children}
        </YStack>
      ) : null}
    </YStack>
  );
}
