import { Badge, SizableText, Tooltip, XStack } from '@onekeyhq/components';
import type { IXStackProps } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EPoolListingStatus } from '@onekeyhq/shared/types/pools';
import type { IPool } from '@onekeyhq/shared/types/pools';

import { POOLS_COPY } from '../poolsCopy';
import {
  formatFeeTier,
  getPoolVersionLabel,
  isStockPool,
} from '../poolsFormat';

/** "V3 0.05%", "V4 Dynamic fee"; the fee alone when the version is named elsewhere */
export function getPoolVersionFee(pool: IPool, hideVersion = false) {
  const fee = pool.isDynamicFee
    ? POOLS_COPY.dynamicFee
    : formatFeeTier(pool.feeTier);
  return hideVersion ? fee : `${getPoolVersionLabel(pool)} ${fee}`;
}

function UnlistedBadge() {
  const badge = (
    <Badge badgeSize="sm" badgeType="warning" userSelect="none">
      <Badge.Text>{POOLS_COPY.notListed}</Badge.Text>
    </Badge>
  );
  // Hover has no touch counterpart; the pool and position pages say it in full
  if (platformEnv.isNative) {
    return badge;
  }
  return (
    <Tooltip
      placement="top"
      renderTrigger={badge}
      renderContent={POOLS_COPY.unlistedHint}
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
        <Badge badgeSize="sm" badgeType="info" userSelect="none">
          <Badge.Text>{POOLS_COPY.hook}</Badge.Text>
        </Badge>
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
 * The line under a pool's name: version and fee as plain text, then the
 * badges that mean something.
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
  return (
    <XStack gap="$2" ai="center" flexWrap="wrap" {...rest}>
      <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
        {getPoolVersionFee(pool, hideVersion)}
      </SizableText>
      <PoolBadges pool={pool} />
    </XStack>
  );
}
