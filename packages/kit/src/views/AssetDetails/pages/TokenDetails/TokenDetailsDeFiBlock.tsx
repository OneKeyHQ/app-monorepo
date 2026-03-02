import { useCallback, useMemo } from 'react';

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

interface ITokenDetailsDeFiBlockProps {
  networkId: string;
  tokenAddress: string;
  walletType?: string;
  tokenLogoURI?: string;
}

// Module-level cache: prevents skeleton flash on remount when scrolling
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const earnResultCache = new Map<string, any>();

export function TokenDetailsDeFiBlock({
  networkId,
  tokenAddress,
  walletType,
  tokenLogoURI,
}: ITokenDetailsDeFiBlockProps) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();

  const cacheKey = `${networkId}_${tokenAddress}`;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  const cachedResult = useMemo(() => earnResultCache.get(cacheKey), [cacheKey]);

  const { result: earnResult, isLoading } = usePromiseResult(
    async () => {
      const symbolInfo =
        await backgroundApiProxy.serviceStaking.findSymbolByTokenAddress({
          networkId,
          tokenAddress,
        });
      if (!symbolInfo) {
        earnResultCache.delete(cacheKey);
        return undefined;
      }
      const protocolList =
        await backgroundApiProxy.serviceStaking.getProtocolList({
          symbol: symbolInfo.symbol,
          filterNetworkId: networkId,
        });
      if (!Array.isArray(protocolList) || !protocolList.length) {
        earnResultCache.delete(cacheKey);
        return undefined;
      }
      const aprItems = protocolList
        .map((o) => Number(o.provider.aprWithoutFee))
        .filter((n) => n > 0);
      const maxApr = Math.max(0, ...aprItems);
      const blockData =
        await backgroundApiProxy.serviceStaking.getBlockRegion();
      const data = { symbolInfo, maxApr, protocolList, blockData };
      earnResultCache.set(cacheKey, data);
      return data;
    },
    [networkId, tokenAddress, cacheKey],
    {
      watchLoading: true,
      ...(cachedResult ? { initResult: cachedResult } : {}),
    },
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

  // Show skeleton only on first load (no cache). On remount after scroll,
  // initResult provides cached data so we skip straight to the real content.
  if (isLoading && !earnResult) {
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
  if (!earnResult) {
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
