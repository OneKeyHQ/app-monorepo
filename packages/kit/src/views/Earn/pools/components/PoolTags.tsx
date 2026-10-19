import { Badge, XStack } from '@onekeyhq/components';
import type { IXStackProps } from '@onekeyhq/components';
import { EPoolListingStatus } from '@onekeyhq/shared/types/pools';
import type { IPool } from '@onekeyhq/shared/types/pools';

import { POOLS_COPY } from '../poolsCopy';
import {
  formatFeeTier,
  getPoolVersionLabel,
  isStockPool,
} from '../poolsFormat';

/**
 * Version and fee, then what sets the pool apart: a hook, a dynamic fee,
 * stock tokens, or that it is off the supported list (doc §2.3).
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
    <XStack gap="$1" ai="center" flexWrap="wrap" {...rest}>
      {hideVersion ? null : (
        <Badge badgeSize="sm" userSelect="none">
          <Badge.Text>{getPoolVersionLabel(pool)}</Badge.Text>
        </Badge>
      )}
      <Badge badgeSize="sm" userSelect="none">
        <Badge.Text>
          {pool.isDynamicFee
            ? POOLS_COPY.dynamicFee
            : formatFeeTier(pool.feeTier)}
        </Badge.Text>
      </Badge>
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
      {pool.listingStatus === EPoolListingStatus.Unlisted ? (
        <Badge badgeSize="sm" badgeType="warning" userSelect="none">
          <Badge.Text>{POOLS_COPY.notListed}</Badge.Text>
        </Badge>
      ) : null}
    </XStack>
  );
}
