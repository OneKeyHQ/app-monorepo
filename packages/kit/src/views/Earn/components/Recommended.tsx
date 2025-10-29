import type { PropsWithChildren } from 'react';
import { useCallback, useMemo } from 'react';

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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IRecommendAsset } from '@onekeyhq/shared/types/staking';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { useEarnAtom } from '../../../states/jotai/contexts/earn';
import { EarnNavigation } from '../earnUtils';
import { useAllNetworkId } from '../hooks/useAllNetworkId';

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

function RecommendedItem({
  token,
  ...rest
}: { token?: IRecommendAsset } & IYStackProps) {
  const accountInfo = useActiveAccount({ num: 0 });
  const navigation = useAppNavigation();
  const {
    activeAccount: { account, indexedAccount },
  } = accountInfo;

  const noWalletConnected = useMemo(
    () => !account && !indexedAccount,
    [account, indexedAccount],
  );

  const onPress = useCallback(async () => {
    if (token) {
      const earnAccount =
        await backgroundApiProxy.serviceStaking.getEarnAccount({
          indexedAccountId: indexedAccount?.id,
          accountId: account?.id ?? '',
          networkId: token.protocols[0]?.networkId,
        });
      await EarnNavigation.toTokenProviderListPage(navigation, {
        indexedAccountId:
          earnAccount?.account.indexedAccountId || indexedAccount?.id,
        accountId: earnAccount?.accountId || account?.id || '',
        networkId: token.protocols[0]?.networkId,
        symbol: token.symbol,
        protocols: token.protocols,
        logoURI: token.logoURI,
      });
    }
  }, [account?.id, indexedAccount?.id, navigation, token]);

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
}

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
  const allNetworkId = useAllNetworkId();
  const {
    activeAccount: { account, indexedAccount },
  } = useActiveAccount({ num: 0 });
  const [{ refreshTrigger = 0 }] = useEarnAtom();

  const { result: tokens } = usePromiseResult(
    async () => {
      const recommendedAssets =
        await backgroundApiProxy.serviceStaking.fetchAllNetworkAssetsV2({
          accountId: account?.id ?? '',
          networkId: allNetworkId,
          indexedAccountId: account?.indexedAccountId || indexedAccount?.id,
        });
      return recommendedAssets?.tokens || [];
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
      initResult: [],
    },
  );

  // Render skeleton when loading and no data
  const shouldShowSkeleton = tokens.length === 0;
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
  if (tokens.length) {
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
              {tokens.map((token) => (
                <YStack key={token.symbol} minWidth="$52">
                  <RecommendedItem token={token} />
                </YStack>
              ))}
            </XStack>
          </ScrollView>
        ) : (
          // Desktop/Extension: grid layout
          <XStack m="$-5" p="$3.5" flexWrap="wrap">
            {tokens.map((token) => (
              <YStack
                key={token.symbol}
                p="$1.5"
                flexBasis={
                  md
                    ? '50%' // Extension small screen: 2 per row
                    : '25%' // Desktop: 4 per row
                }
              >
                <RecommendedItem token={token} />
              </YStack>
            ))}
          </XStack>
        )}
      </RecommendedContainer>
    );
  }
  return null;
}
