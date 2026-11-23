import { useRef } from 'react';
import type { ReactElement, RefObject } from 'react';

import { Badge, Stack, Tooltip, XStack } from '@onekeyhq/components';
import type { IXStackProps } from '@onekeyhq/components';
import type { ITooltipRef } from '@onekeyhq/components/src/actions/Tooltip';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar/NetworkAvatar';
import { Token } from '@onekeyhq/kit/src/components/Token';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IPool } from '@onekeyhq/shared/types/pools';

import { POOLS_COPY } from '../poolsCopy';
import {
  formatFeeTier,
  getPoolRisk,
  getPoolVersionLabel,
  isStockPool,
} from '../poolsFormat';
import { PoolsQueries, usePoolsQuery } from '../poolsQueries';
import { UNISWAP_PROTOCOL } from '../usePoolsPortfolio';

import type { IPoolRisk } from '../poolsFormat';

/**
 * A badge with its name on hover. Hover has no touch counterpart, so phones
 * show the badge alone.
 *
 * The badge is not the tooltip's trigger: a trigger takes a click handler,
 * and a view with one keeps the click to itself, so a click on a badge in a
 * pool row never reached the row (it neither opened nor expanded). The badge
 * opens and closes the tooltip from its own hover instead; the trigger is a
 * layer over it that takes no pointer events.
 */
function WithHint({ badge, hint }: { badge: ReactElement; hint?: string }) {
  const tooltipRef = useRef<ITooltipRef>(null);
  if (platformEnv.isNative || !hint) {
    return badge;
  }
  return (
    <Stack
      // Mouse handlers: the web build attaches hover listeners only for them
      onMouseEnter={() => void tooltipRef.current?.openTooltip()}
      onMouseLeave={() => void tooltipRef.current?.closeTooltip()}
    >
      {badge}
      <Tooltip
        ref={tooltipRef as RefObject<ITooltipRef>}
        placement="top"
        triggerAsChild
        renderTrigger={
          <Stack
            position="absolute"
            top={0}
            right={0}
            bottom={0}
            left={0}
            pointerEvents="none"
          />
        }
        renderContent={hint}
      />
    </Stack>
  );
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

function RiskBadge({ risk }: { risk: IPoolRisk }) {
  const copy = POOLS_COPY.poolRisk[risk];
  return (
    <WithHint
      hint={copy.hint}
      badge={
        <Badge
          testID={`pool-risk-badge-${risk}`}
          badgeSize="sm"
          badgeType="warning"
          userSelect="none"
        >
          <Badge.Text>{copy.badge}</Badge.Text>
        </Badge>
      }
    />
  );
}

/**
 * Only what sets a pool apart, each in its own color: stock tokens, a hook,
 * or why adding to it asks for a risk confirm (doc §2.3).
 */
export function PoolBadges({
  pool,
  ...rest
}: { pool: IPool } & Omit<IXStackProps, 'children'>) {
  const risk = getPoolRisk(pool);
  if (!pool.hook && !isStockPool(pool) && !risk) {
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
      {risk ? <RiskBadge risk={risk} /> : null}
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
 * The line under a pool's name wherever the network shows elsewhere, as a
 * label or the pair icon's badge: the badge row without the chain.
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
