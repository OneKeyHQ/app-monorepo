import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  Dialog,
  Illustration,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
import { EarnNavigation } from '@onekeyhq/kit/src/views/Earn/earnUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { listItemPressStyle } from '@onekeyhq/shared/src/style';
import cacheUtils from '@onekeyhq/shared/src/utils/cacheUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

interface ITokenDetailsDeFiBlockProps {
  networkId: string;
  tokenAddress: string;
  walletType?: string;
  tokenLogoURI?: string;
}

type ITokenDetailsDeFiBlockResult = {
  symbolInfo: Awaited<
    ReturnType<
      typeof backgroundApiProxy.serviceStaking.findSymbolByTokenAddress
    >
  >;
  maxApr: number;
  protocolList: Awaited<
    ReturnType<typeof backgroundApiProxy.serviceStaking.getProtocolList>
  >;
  blockData: Awaited<
    ReturnType<typeof backgroundApiProxy.serviceStaking.getBlockRegion>
  >;
} | null;

type ITokenDetailsDeFiBlockCacheValue = {
  result: ITokenDetailsDeFiBlockResult;
};

// Module-level cache: prevents skeleton flash on remount when scrolling
const earnResultCache = new cacheUtils.LRUCache<
  string,
  ITokenDetailsDeFiBlockCacheValue
>({
  max: 50,
  ttl: timerUtils.getTimeDurationMs({ minute: 10 }),
  ttlAutopurge: true,
});

export function TokenDetailsDeFiBlock({
  networkId,
  tokenAddress,
  walletType,
  tokenLogoURI,
}: ITokenDetailsDeFiBlockProps) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();
  const requestIdRef = useRef(generateUUID());
  const isUnmountedRef = useRef(false);

  const cacheKey = `${networkId}_${tokenAddress}`;
  // `undefined` means cache miss; `null` means cached "no DeFi banner".
  // The cache wraps values in `{ result }` so we can distinguish the two cases.
  const cachedEntry = useMemo(() => earnResultCache.get(cacheKey), [cacheKey]);
  const hasCachedResult = cachedEntry !== undefined;
  const cachedResult = cachedEntry?.result;

  const { result: earnResult, isLoading } = usePromiseResult(
    async () => {
      if (hasCachedResult) {
        return cachedResult;
      }

      const symbolInfo =
        await backgroundApiProxy.serviceStaking.findSymbolByTokenAddress({
          networkId,
          tokenAddress,
        });
      if (isUnmountedRef.current) {
        return undefined;
      }
      if (!symbolInfo) {
        earnResultCache.set(cacheKey, { result: null });
        return null;
      }
      let protocolList;
      try {
        protocolList = await backgroundApiProxy.serviceStaking.getProtocolList({
          symbol: symbolInfo.symbol,
          filterNetworkId: networkId,
          includeWithdrawOnly: true,
          requestId: requestIdRef.current,
        });
      } catch {
        // Transient error — don't cache so retry happens on next mount
        return null;
      }
      if (isUnmountedRef.current) {
        return undefined;
      }
      if (!Array.isArray(protocolList) || !protocolList.length) {
        earnResultCache.set(cacheKey, { result: null });
        return null;
      }
      const aprItems = protocolList
        .map((o) => Number(o.provider.aprWithoutFee))
        .filter((n) => n > 0);
      const maxApr = Math.max(0, ...aprItems);
      if (maxApr === 0) {
        earnResultCache.set(cacheKey, { result: null });
        return null;
      }
      const blockData = await backgroundApiProxy.serviceStaking.getBlockRegion({
        requestId: requestIdRef.current,
      });
      if (isUnmountedRef.current) {
        return undefined;
      }
      const data = { symbolInfo, maxApr, protocolList, blockData };
      earnResultCache.set(cacheKey, { result: data });
      return data;
    },
    [networkId, tokenAddress, cacheKey, hasCachedResult, cachedResult],
    {
      watchLoading: true,
      ...(hasCachedResult ? { initResult: cachedResult } : {}),
    },
  );

  const renderState = useMemo(() => {
    if (isLoading && earnResult === undefined) {
      return 'loading';
    }
    if (!earnResult) {
      return 'hidden';
    }
    return 'content';
  }, [earnResult, isLoading]);

  useEffect(
    () => () => {
      isUnmountedRef.current = true;
      void backgroundApiProxy.serviceStaking.abortPendingRequestsByRequestId({
        requestId: requestIdRef.current,
      });
    },
    [],
  );

  const handlePress = useCallback(async () => {
    if (!earnResult) return;

    if (earnResult.blockData) {
      Dialog.show({
        icon: earnResult.blockData.icon.icon,
        title: earnResult.blockData.title.text,
        description: earnResult.blockData.description.text,
        showCancelButton: false,
        onConfirmText: intl.formatMessage({
          id: ETranslations.global_got_it,
        }),
        onConfirm: async ({ close }) => {
          await close?.();
        },
      });
      return;
    }

    const symbol = earnResult.symbolInfo?.symbol ?? '';
    const protocolList = earnResult.protocolList ?? [];

    if (!networkId || !symbol || protocolList.length === 0) {
      return;
    }

    defaultLogger.wallet.walletActions.actionEarn({
      walletType: walletType ?? '',
      networkId,
      source: 'tokenDetails',
      isSoftwareWalletOnlyUser,
    });

    if (protocolList.length === 1) {
      const protocol = protocolList[0];
      await EarnNavigation.pushToEarnProtocolDetails(navigation, {
        networkId,
        symbol,
        provider: protocol.provider.name,
        vault: protocol.provider.vault,
      });
    } else {
      EarnNavigation.pushToEarnProtocols(navigation, {
        symbol,
        filterNetworkId: networkId,
        logoURI: tokenLogoURI ? encodeURIComponent(tokenLogoURI) : undefined,
      });
    }
  }, [
    earnResult,
    intl,
    networkId,
    walletType,
    isSoftwareWalletOnlyUser,
    navigation,
    tokenLogoURI,
  ]);

  // Show skeleton only on first load (no cache). Cache also stores null for
  // "no DeFi banner", so remounts do not flash skeleton again.
  if (renderState === 'loading') {
    return (
      <XStack
        bg="$bgSubdued"
        borderRadius="$4"
        borderCurve="continuous"
        px="$5"
        py="$3"
        mx="$5"
        mb="$5"
        alignItems="center"
        gap="$3"
      >
        <Skeleton w={48} h={48} borderRadius="$2" />
        <YStack flex={1} gap="$1">
          <Skeleton.BodyMd />
          <Skeleton.BodySm />
        </YStack>
      </XStack>
    );
  }

  // No earn data available
  if (renderState === 'hidden' || !earnResult) {
    return null;
  }

  return (
    <XStack
      bg="$bgSubdued"
      borderRadius="$4"
      borderCurve="continuous"
      px="$2"
      mx="$5"
      mb="$5"
      alignItems="center"
      userSelect="none"
      gap="$1"
      onPress={handlePress}
      {...listItemPressStyle}
    >
      <Illustration name="BlockCoins" size={72} />
      <YStack flex={1} gap="$1">
        <SizableText size="$bodyMdMedium">
          {intl.formatMessage(
            { id: ETranslations.wallet_banner_defi_title },
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            { number: `${earnResult.maxApr.toFixed(1)}%` },
          )}
        </SizableText>
        <SizableText color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.wallet_banner_defi_desc })}
        </SizableText>
      </YStack>
    </XStack>
  );
}
