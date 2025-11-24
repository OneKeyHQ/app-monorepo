import type { PropsWithChildren } from 'react';
import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IYStackProps } from '@onekeyhq/components';
import {
  Icon,
  Image,
  ScrollView,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IRecommendAsset } from '@onekeyhq/shared/types/staking';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  useEarnActions,
  useEarnAtom,
} from '../../../states/jotai/contexts/earn';
import { EarnNavigation } from '../earnUtils';

import { AprText } from './AprText';

function RecommendedSkeletonItem({ ...rest }: IYStackProps) {
  return (
    <YStack
      gap="$4"
      px="$5"
      py="$3.5"
      borderRadius="$3"
      bg="$bg"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      borderCurve="continuous"
      alignItems="flex-start"
      {...rest}
    >
      <YStack alignItems="flex-start" gap="$4">
        <XStack gap="$3" ai="center" width="100%">
          <Skeleton width="$8" height="$8" radius="round" />
          <YStack py="$1">
            <Skeleton w={56} h={24} borderRadius="$2" />
          </YStack>
        </XStack>
        <Skeleton w={118} h={28} borderRadius="$2" pt="$4" pb="$1" />
      </YStack>
    </YStack>
  );
}

const RecommendedItem = memo(
  ({
    token,
    accountId,
    indexedAccountId,
    noWalletConnected,
    ...rest
  }: {
    token?: IRecommendAsset;
    accountId?: string;
    indexedAccountId?: string;
    noWalletConnected: boolean;
  } & IYStackProps) => {
    const navigation = useAppNavigation();

    const onPress = useCallback(async () => {
      if (token) {
        defaultLogger.staking.page.selectAsset({ tokenSymbol: token.symbol });

        const earnAccount =
          await backgroundApiProxy.serviceStaking.getEarnAccount({
            indexedAccountId,
            accountId: accountId ?? '',
            networkId: token.protocols[0]?.networkId,
          });

        const accountIdValue = earnAccount?.accountId || accountId || '';
        const indexedAccountIdValue =
          earnAccount?.account.indexedAccountId || indexedAccountId;

        if (token.protocols.length === 1) {
          const protocol = token.protocols[0];
          await EarnNavigation.pushToEarnProtocolDetails(navigation, {
            networkId: protocol.networkId,
            accountId: accountIdValue,
            indexedAccountId: indexedAccountIdValue,
            symbol: token.symbol,
            provider: protocol.provider,
            vault: protocol.vault,
          });
        } else {
          EarnNavigation.pushToEarnProtocols(navigation, {
            symbol: token.symbol,
            filterNetworkId: undefined,
            logoURI: token.logoURI
              ? encodeURIComponent(token.logoURI)
              : undefined,
          });
        }
      }
    }, [accountId, indexedAccountId, navigation, token]);

    if (!token) {
      return <YStack width="$40" flexGrow={1} />;
    }

    return (
      <YStack
        role="button"
        flex={1}
        p="$4"
        borderRadius="$3"
        borderCurve="continuous"
        bg={token.bgColor}
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        animation="quick"
        hoverStyle={{
          scale: 1.05,
        }}
        pressStyle={{
          scale: 0.95,
        }}
        onPress={onPress}
        userSelect="none"
        alignItems="flex-start"
        overflow="hidden"
        {...rest}
      >
        <YStack alignItems="flex-start" width="100%">
          <XStack gap="$2" ai="center" width="100%">
            <YStack>
              <Image
                size="$6"
                source={{ uri: token.logoURI }}
                fallback={
                  <Image.Fallback
                    w="$6"
                    h="$6"
                    alignItems="center"
                    justifyContent="center"
                    bg="$bgStrong"
                  >
                    <Icon size="$6" name="CoinOutline" color="$iconDisabled" />
                  </Image.Fallback>
                }
              />
            </YStack>
            <SizableText size="$bodyLgMedium">{token.symbol}</SizableText>
          </XStack>
          <YStack alignItems="flex-start" width="100%">
            <SizableText size="$headingXl" pt="$3.5">
              <AprText
                asset={{
                  aprWithoutFee: token?.aprWithoutFee ?? '',
                  aprInfo: token?.aprInfo,
                }}
              />
            </SizableText>
            {!noWalletConnected ? (
              <SizableText
                pt="$1"
                size="$bodyMd"
                color={token.available.color ?? '$textSubdued'}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {token?.available?.text}
              </SizableText>
            ) : null}
          </YStack>
        </YStack>
      </YStack>
    );
  },
);

RecommendedItem.displayName = 'RecommendedItem';

function RecommendedContainer({ children }: PropsWithChildren) {
  const intl = useIntl();
  return (
    <YStack
      gap="$3"
      px="$5"
      $md={
        platformEnv.isNative
          ? {
              mx: -20,
            }
          : undefined
      }
    >
      {/* since the children have been used negative margin, so we should use zIndex to make sure the trigger of popover is on top of the children */}
      <YStack
        gap="$1"
        pointerEvents="box-none"
        zIndex={10}
        $md={
          platformEnv.isNative
            ? {
                px: '$5',
              }
            : undefined
        }
      >
        <SizableText size="$headingLg" pointerEvents="box-none">
          {intl.formatMessage({ id: ETranslations.market_trending })}
        </SizableText>
      </YStack>
      {children}
    </YStack>
  );
}

export function Recommended() {
  const { md } = useMedia();
  const allNetworkId = getNetworkIdsMap().onekeyall;
  const {
    activeAccount: { account, indexedAccount },
  } = useActiveAccount({ num: 0 });
  const [{ refreshTrigger = 0, recommendedTokens = [] }] = useEarnAtom();
  const actions = useEarnActions();

  const noWalletConnected = useMemo(
    () => !account && !indexedAccount,
    [account, indexedAccount],
  );

  // Fetch new tokens in background and update cache
  usePromiseResult(
    async () => {
      const recommendedAssets =
        await backgroundApiProxy.serviceStaking.fetchAllNetworkAssetsV2({
          accountId: account?.id ?? '',
          networkId: allNetworkId,
          indexedAccountId: account?.indexedAccountId || indexedAccount?.id,
        });

      const newTokens = recommendedAssets?.tokens || [];

      // Update cache with new tokens
      actions.current.updateRecommendedTokens(newTokens);

      return newTokens;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      account?.id,
      allNetworkId,
      account?.indexedAccountId,
      indexedAccount?.id,
      refreshTrigger,
    ],
    {
      watchLoading: true,
    },
  );

  // Render skeleton when loading and no data
  const shouldShowSkeleton = recommendedTokens.length === 0;
  if (shouldShowSkeleton) {
    return (
      <RecommendedContainer>
        {/* Desktop/Extension with larger screen: 4 items per row */}
        {platformEnv.isNative ? (
          // Mobile: horizontal scrolling skeleton
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 20,
            }}
          >
            <XStack gap="$3">
              {Array.from({ length: 4 }).map((_, index) => (
                <YStack key={index} width="$40">
                  <RecommendedSkeletonItem />
                </YStack>
              ))}
            </XStack>
          </ScrollView>
        ) : (
          // Desktop/Extension: grid layout
          <XStack m="$-5" p="$3.5" flexWrap="wrap">
            {Array.from({ length: 4 }).map((_, index) => (
              <YStack
                key={index}
                p="$1.5"
                flexBasis={
                  md
                    ? '50%' // Extension small screen: 2 per row
                    : '25%' // Desktop: 4 per row
                }
              >
                <RecommendedSkeletonItem />
              </YStack>
            ))}
          </XStack>
        )}
      </RecommendedContainer>
    );
  }

  // Render actual tokens
  if (recommendedTokens.length) {
    return (
      <RecommendedContainer>
        {platformEnv.isNative ? (
          // Mobile: horizontal scrolling
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 20,
            }}
          >
            <XStack gap="$3">
              {recommendedTokens.map((token) => (
                <YStack key={token.symbol} minWidth="$52">
                  <RecommendedItem
                    token={token}
                    accountId={account?.id}
                    indexedAccountId={indexedAccount?.id}
                    noWalletConnected={noWalletConnected}
                  />
                </YStack>
              ))}
            </XStack>
          </ScrollView>
        ) : (
          // Desktop/Extension: grid layout
          <XStack m="$-5" p="$3.5" flexWrap="wrap">
            {recommendedTokens.map((token) => (
              <YStack
                key={token.symbol}
                p="$1.5"
                flexBasis={
                  md
                    ? '50%' // Extension small screen: 2 per row
                    : '25%' // Desktop: 4 per row
                }
              >
                <RecommendedItem
                  token={token}
                  accountId={account?.id}
                  indexedAccountId={indexedAccount?.id}
                  noWalletConnected={noWalletConnected}
                />
              </YStack>
            ))}
          </XStack>
        )}
      </RecommendedContainer>
    );
  }
  return null;
}
