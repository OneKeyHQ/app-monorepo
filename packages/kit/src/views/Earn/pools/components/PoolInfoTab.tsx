import type { ReactNode } from 'react';

import {
  Divider,
  IconButton,
  SizableText,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar/NetworkAvatar';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { GridItem } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/GridItemV2';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { formatLocaleDate } from '@onekeyhq/shared/src/utils/dateUtils';
import type {
  IPoolAsset,
  IPoolDetail,
  IPoolListItem,
} from '@onekeyhq/shared/types/pools';

import { POOLS_COPY } from '../poolsCopy';
import {
  formatFeeTier,
  formatUsd,
  getPoolPair,
  getPoolProtocolLabel,
} from '../poolsFormat';
import { UNISWAP_PROTOCOL } from '../usePoolsPortfolio';

import { PoolSamePairList } from './PoolOverview';
import { usePoolNetworkName } from './PoolTags';
import { PoolTokenSplit } from './PoolTokenSplit';

// Flex shares of the token table's columns: the name needs the most room
const TOKEN_COLUMNS = { token: 1.5, price: 1, contract: 1.3 };

function shortAddress(address: string) {
  return accountUtils.shortenAddress({
    address,
    leadingLength: 6,
    trailingLength: 4,
  });
}

/** A titled block as an Earn asset page's Info tab draws one */
function InfoSection({
  title,
  testID,
  children,
}: {
  title: string;
  testID: string;
  children: ReactNode;
}) {
  return (
    <YStack gap="$6" testID={testID}>
      <SizableText size="$headingLg">{title}</SizableText>
      {children}
    </YStack>
  );
}

/** A grid cell's value with a logo before it, as the asset page draws one */
function LogoValue({ logo, text }: { logo: ReactNode; text: string }) {
  return (
    <XStack ai="center" gap="$1.5" flexShrink={1} minWidth={0}>
      {logo}
      <SizableText size="$bodyLgMedium" flexShrink={1} numberOfLines={1}>
        {text}
      </SizableText>
    </XStack>
  );
}

/** The pool itself: whose it is, what it charges, when it opened, its id */
function PoolFactsSection({ pool }: { pool: IPoolListItem }) {
  const networkName = usePoolNetworkName(pool.networkId);
  // A v4 pool is an id inside one contract, not a contract of its own
  const keyLabel =
    pool.version === 'v4' ? POOLS_COPY.poolIdLabel : POOLS_COPY.poolAddress;
  return (
    <InfoSection title={POOLS_COPY.poolInfo} testID="earn-pool-info-pool">
      <XStack flexWrap="wrap" m="$-5" p="$2">
        <GridItem
          title={{ text: POOLS_COPY.protocol }}
          descriptionComponent={
            <LogoValue
              logo={
                <Token
                  size="xs"
                  borderRadius="$2"
                  mr="$0.5"
                  tokenImageUri={UNISWAP_PROTOCOL.logoURI}
                />
              }
              text={getPoolProtocolLabel(pool)}
            />
          }
        />
        <GridItem
          title={{ text: POOLS_COPY.network }}
          descriptionComponent={
            <LogoValue
              logo={<NetworkAvatar networkId={pool.networkId} size="$5" />}
              text={networkName}
            />
          }
        />
        <GridItem
          title={{ text: POOLS_COPY.feeTier }}
          description={{
            text: pool.isDynamicFee
              ? POOLS_COPY.dynamicFee
              : formatFeeTier(pool.feeTier),
          }}
        />
        <GridItem
          title={{ text: POOLS_COPY.poolCreated }}
          description={{ text: formatLocaleDate(new Date(pool.createdAt)) }}
        />
        <GridItem
          title={{ text: keyLabel }}
          description={{ text: shortAddress(pool.poolKey) }}
          actionIcon={{ type: 'copy', data: { text: pool.poolKey } }}
        />
      </XStack>
      <YStack gap="$3">
        <SizableText size="$bodyMd" color="$textSubdued">
          {POOLS_COPY.inPool}
        </SizableText>
        <PoolTokenSplit
          pool={pool}
          amount0={pool.reserve0}
          amount1={pool.reserve1}
          compact
        />
      </YStack>
    </InfoSection>
  );
}

/** What a v4 pool's hook does, and its contract */
function PoolHookSection({ pool }: { pool: IPoolListItem }) {
  const { hook } = pool;
  if (!hook) {
    return null;
  }
  return (
    <InfoSection
      title={`${POOLS_COPY.hook}: ${hook.name}`}
      testID="earn-pool-info-hook"
    >
      <SizableText size="$bodyMd" color="$textSubdued">
        {hook.description}
      </SizableText>
      <XStack flexWrap="wrap" m="$-5" p="$2">
        <GridItem
          title={{ text: POOLS_COPY.hookAddress }}
          description={{ text: shortAddress(hook.address) }}
          actionIcon={{ type: 'copy', data: { text: hook.address } }}
        />
      </XStack>
    </InfoSection>
  );
}

function TokenContract({ token }: { token: IPoolAsset }) {
  const { copyText } = useClipboard();
  if (!token.address) {
    return (
      <SizableText size="$bodyMd" color="$textSubdued">
        {POOLS_COPY.nativeToken}
      </SizableText>
    );
  }
  return (
    <XStack ai="center" gap="$1" jc="flex-end">
      <SizableText size="$bodyMd" numberOfLines={1}>
        {shortAddress(token.address)}
      </SizableText>
      <IconButton
        testID={`earn-pool-token-copy-${token.id}`}
        size="small"
        variant="tertiary"
        icon="Copy3Outline"
        title={POOLS_COPY.copyAddress}
        aria-label={POOLS_COPY.copyAddress}
        onPress={() => copyText(token.address)}
      />
    </XStack>
  );
}

/** The pair's two tokens, base first: what each is, its price, its contract */
function PoolTokensSection({ pool }: { pool: IPoolListItem }) {
  const { base, quote } = getPoolPair(pool);
  return (
    <InfoSection title={POOLS_COPY.tokenInfo} testID="earn-pool-info-tokens">
      <YStack>
        <XStack gap="$3" pb="$2">
          <SizableText
            flex={TOKEN_COLUMNS.token}
            flexBasis={0}
            size="$bodySmMedium"
            color="$textSubdued"
          >
            {POOLS_COPY.token}
          </SizableText>
          <SizableText
            flex={TOKEN_COLUMNS.price}
            flexBasis={0}
            size="$bodySmMedium"
            color="$textSubdued"
            textAlign="right"
          >
            {POOLS_COPY.price}
          </SizableText>
          <SizableText
            flex={TOKEN_COLUMNS.contract}
            flexBasis={0}
            size="$bodySmMedium"
            color="$textSubdued"
            textAlign="right"
          >
            {POOLS_COPY.contract}
          </SizableText>
        </XStack>
        {[base, quote].map((token) => (
          <XStack
            key={token.id}
            testID={`earn-pool-token-${token.id}`}
            ai="center"
            gap="$3"
            py="$3"
            borderTopWidth={1}
            borderTopColor="$borderSubdued"
          >
            <XStack
              flex={TOKEN_COLUMNS.token}
              flexBasis={0}
              ai="center"
              gap="$2"
              minWidth={0}
            >
              <Token size="sm" tokenImageUri={token.logoURI} />
              <YStack flexShrink={1} minWidth={0}>
                <SizableText size="$bodyLgMedium" numberOfLines={1}>
                  {token.symbol}
                </SizableText>
                <SizableText
                  size="$bodySm"
                  color="$textSubdued"
                  numberOfLines={1}
                >
                  {token.name}
                </SizableText>
              </YStack>
            </XStack>
            <SizableText
              flex={TOKEN_COLUMNS.price}
              flexBasis={0}
              size="$bodyLgMedium"
              textAlign="right"
              numberOfLines={1}
            >
              {formatUsd(token.priceUsd)}
            </SizableText>
            <YStack flex={TOKEN_COLUMNS.contract} flexBasis={0} ai="flex-end">
              <TokenContract token={token} />
            </YStack>
          </XStack>
        ))}
      </YStack>
    </InfoSection>
  );
}

/**
 * A pool page's Info tab, built like an Earn asset page's: the pool first,
 * then its two tokens, then the pair's other pools.
 */
export function PoolInfoTab({
  pool,
  detail,
}: {
  pool: IPoolListItem;
  detail: IPoolDetail | undefined;
}) {
  const pairPools = detail?.pairPools ?? [];
  const sections: { key: string; node: ReactNode }[] = [
    { key: 'pool', node: <PoolFactsSection pool={pool} /> },
    ...(pool.hook
      ? [{ key: 'hook', node: <PoolHookSection pool={pool} /> }]
      : []),
    { key: 'tokens', node: <PoolTokensSection pool={pool} /> },
    ...(pairPools.length
      ? [
          {
            key: 'pair',
            node: (
              <InfoSection
                title={POOLS_COPY.samePair}
                testID="earn-pool-same-pair"
              >
                <PoolSamePairList pools={pairPools} />
              </InfoSection>
            ),
          },
        ]
      : []),
  ];
  return (
    <YStack gap="$8">
      {sections.map(({ key, node }, index) => (
        <YStack key={key} gap="$8">
          {index ? <Divider /> : null}
          {node}
        </YStack>
      ))}
    </YStack>
  );
}
