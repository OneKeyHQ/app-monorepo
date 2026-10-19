import type { ReactElement } from 'react';

import { Badge, Tooltip, XStack } from '@onekeyhq/components';
import type { IXStackProps } from '@onekeyhq/components';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar/NetworkAvatar';
import { Token } from '@onekeyhq/kit/src/components/Token';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EPoolListingStatus } from '@onekeyhq/shared/types/pools';
import type { IPool } from '@onekeyhq/shared/types/pools';

import { POOLS_COPY } from '../poolsCopy';
import {
  formatFeeTier,
  getPoolVersionLabel,
  isStockPool,
} from '../poolsFormat';
import { PoolsQueries, usePoolsQuery } from '../poolsQueries';
import { UNISWAP_PROTOCOL } from '../usePoolsPortfolio';

/** Hover has no touch counterpart, so phones show the badge alone */
function WithHint({ badge, hint }: { badge: ReactElement; hint?: string }) {
  if (platformEnv.isNative || !hint) {
    return badge;
  }
  return <Tooltip placement="top" renderTrigger={badge} renderContent={hint} />;
}

export function usePoolNetworkName(networkId: string) {
  return usePoolsQuery(PoolsQueries.networkName(networkId)).result ?? '';
}

/** The fee tier, or "Dynamic fee" when a hook sets it */
export function PoolFeeBadge({ pool }: { pool: IPool }) {
  return (
    <Badge badgeSize="sm" badgeType="default" userSelect="none">
      <Badge.Text>
        {pool.isDynamicFee
          ? POOLS_COPY.dynamicFee
          : formatFeeTier(pool.feeTier)}
      </Badge.Text>
    </Badge>
  );
}

/** The chain's logo; its name on hover */
export function PoolNetworkBadge({ networkId }: { networkId: string }) {
  const name = usePoolNetworkName(networkId);
  return (
    <WithHint
      hint={name}
      badge={
        <Badge
          testID={`pool-network-badge-${networkId}`}
          badgeSize="sm"
          badgeType="default"
          px="$1"
          userSelect="none"
          aria-label={name}
        >
          <NetworkAvatar networkId={networkId} size="$4" />
        </Badge>
      }
    />
  );
}

/** The DEX's logo and the protocol version, as Revert and Uniswap print it */
export function PoolDexBadge({ pool }: { pool: IPool }) {
  return (
    <WithHint
      hint={`${UNISWAP_PROTOCOL.name} ${getPoolVersionLabel(pool)}`}
      badge={
        <Badge
          badgeSize="sm"
          badgeType="default"
          pl="$1"
          gap="$1"
          userSelect="none"
        >
          <Token
            size="xxs"
            tokenImageUri={UNISWAP_PROTOCOL.logoURI}
            borderRadius="$full"
          />
          <Badge.Text>{getPoolVersionLabel(pool)}</Badge.Text>
        </Badge>
      }
    />
  );
}

function UnlistedBadge() {
  return (
    <WithHint
      hint={POOLS_COPY.unlistedHint}
      badge={
        <Badge badgeSize="sm" badgeType="warning" userSelect="none">
          <Badge.Text>{POOLS_COPY.notListed}</Badge.Text>
        </Badge>
      }
    />
  );
}

/**
 * Only what sets a pool apart, each in its own color: stock tokens, a hook,
 * or that it is off the supported list (doc §2.3).
 */
export function PoolBadges({
  pool,
  ...rest
}: { pool: IPool } & Omit<IXStackProps, 'children'>) {
  const isUnlisted = pool.listingStatus === EPoolListingStatus.Unlisted;
  if (!pool.hook && !isStockPool(pool) && !isUnlisted) {
    return null;
  }
  return (
    <XStack gap="$1" ai="center" flexShrink={0} {...rest}>
      {pool.hook ? (
        <WithHint
          hint={pool.hook.name}
          badge={
            <Badge badgeSize="sm" badgeType="info" userSelect="none">
              <Badge.Text>{POOLS_COPY.hook}</Badge.Text>
            </Badge>
          }
        />
      ) : null}
      {isStockPool(pool) ? (
        <Badge badgeSize="sm" badgeType="success" userSelect="none">
          <Badge.Text>{POOLS_COPY.stock}</Badge.Text>
        </Badge>
      ) : null}
      {isUnlisted ? <UnlistedBadge /> : null}
    </XStack>
  );
}

/**
 * Revert's badge set under a pool's name: fee tier, chain, DEX and
 * version, then the badges that set the pool apart.
 */
export function PoolBadgeRow({
  pool,
  showNetwork = true,
  ...rest
}: {
  pool: IPool;
  showNetwork?: boolean;
} & Omit<IXStackProps, 'children'>) {
  return (
    <XStack gap="$1" ai="center" flexWrap="wrap" {...rest}>
      <PoolFeeBadge pool={pool} />
      {showNetwork ? <PoolNetworkBadge networkId={pool.networkId} /> : null}
      <PoolDexBadge pool={pool} />
      <PoolBadges pool={pool} />
    </XStack>
  );
}

/**
 * The line under a pool's name on pages that name the network elsewhere:
 * the badge row without the chain.
 */
export function PoolTags({
  pool,
  hideVersion = false,
  ...rest
}: {
  pool: IPool;
  /** When the protocol label next to the tags already names the version */
  hideVersion?: boolean;
} & Omit<IXStackProps, 'children'>) {
  if (hideVersion) {
    return (
      <XStack gap="$1" ai="center" flexWrap="wrap" {...rest}>
        <PoolFeeBadge pool={pool} />
        <PoolBadges pool={pool} />
      </XStack>
    );
  }
  return <PoolBadgeRow pool={pool} showNetwork={false} {...rest} />;
}
