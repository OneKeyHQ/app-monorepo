import { memo, useCallback, useEffect, useMemo } from 'react';

import { type IProps } from '.';

import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Alert,
  DebugRenderTracker,
  Divider,
  Icon,
  SizableText,
  Skeleton,
  Stack,
  Toast,
  XStack,
  YStack,
  useTabIsRefreshingFocused,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { ReviewControl } from '@onekeyhq/kit/src/components/ReviewControl';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useBotWalletDeactivatedStatus } from '@onekeyhq/kit/src/hooks/useBotWalletDeactivatedStatus';
import { useCopyAccountAddress } from '@onekeyhq/kit/src/hooks/useCopyAccountAddress';
import { useDisplayAccountAddress } from '@onekeyhq/kit/src/hooks/useDisplayAccountAddress';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useReceiveToken } from '@onekeyhq/kit/src/hooks/useReceiveToken';
import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
import {
  shouldBlockBotWalletCopyAddress,
  shouldBlockBotWalletReceive,
} from '@onekeyhq/kit/src/utils/botWalletStatusUtils';
import { RawActions } from '@onekeyhq/kit/src/views/Home/components/WalletActions/RawActions';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  WALLET_TYPE_HD,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/shared/src/consts/dbConsts';
import { POLLING_DEBOUNCE_INTERVAL } from '@onekeyhq/shared/src/consts/walletConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  EModalRoutes,
  EModalSignatureConfirmRoutes,
  EModalSwapRoutes,
} from '@onekeyhq/shared/src/routes';
import { listItemPressStyle } from '@onekeyhq/shared/src/style';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import cacheUtils from '@onekeyhq/shared/src/utils/cacheUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  ESwapSource,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';
import type {
  IAccountToken,
  IFetchTokenDetailItem,
} from '@onekeyhq/shared/types/token';

import ActionBuy from './ActionBuy';
import { useTokenDetailsContext } from './TokenDetailsContext';
import { TokenDetailsDeFiBlock } from './TokenDetailsDeFiBlock';

const tokenDetailsCache = new cacheUtils.LRUCache<
  string,
  IFetchTokenDetailItem
>({
  max: 100,
  ttl: timerUtils.getTimeDurationMs({ minute: 10 }),
  ttlAutopurge: true,
});

type ITokenDetailsAddressBlockProps = {
  shouldShow: boolean;
  label: string;
  address: string;
  onPress: () => void;
};

const TokenDetailsAddressBlock = memo(
  ({ shouldShow, label, address, onPress }: ITokenDetailsAddressBlockProps) => {
    if (!shouldShow) {
      return null;
    }

    return (
      <>
        <Divider />
        <YStack
          userSelect="none"
          onPress={onPress}
          px="$5"
          py="$3"
          gap="$1"
          {...listItemPressStyle}
        >
          <SizableText size="$bodyMd" color="$textSubdued">
            {label}
          </SizableText>
          <XStack gap="$4">
            <SizableText
              size="$bodyMd"
              color="$text"
              flexShrink={1}
              $platform-web={{
                wordBreak: 'break-word',
              }}
            >
              {address}
            </SizableText>
            <Icon
              name="Copy3Outline"
              color="$iconSubdued"
              size="$5"
              flexShrink={0}
              marginLeft="auto"
            />
          </XStack>
        </YStack>
      </>
    );
  },
);
TokenDetailsAddressBlock.displayName = 'TokenDetailsAddressBlock';

function TokenDetailsHeader(props: IProps) {
  const {
    accountId,
    networkId,
    walletId,
    tokenInfo,
    tokenMap,
    allowTokenMapAsInitialDetails = true,
    isAllNetworks,
    indexedAccountId,
    isTabView,
    deriveInfo,
    deriveType,
  } = props;
  const navigation = useAppNavigation();
  const intl = useIntl();
  const copyAccountAddress = useCopyAccountAddress();
  const {
    updateTokenMetadata,
    tokenDetails: tokenDetailsContext,
    updateTokenDetails,
  } = useTokenDetailsContext();

  const [settings] = useSettingsPersistAtom();

  const { network, wallet, account } = useAccountData({
    accountId,
    networkId,
    walletId,
  });

  const tokenDetailsKey = `${accountId}_${networkId}`;
  const tokenDetailsCacheKey = `${accountId}_${networkId}_${
    tokenInfo.address ?? ''
  }_${settings.currencyInfo.id}`;
  const tokenMapKey = (tokenInfo as IAccountToken).$key;

  const cachedTokenDetails = useMemo(() => {
    const contextTokenDetails = tokenDetailsContext[tokenDetailsKey]?.data;
    if (contextTokenDetails) {
      return contextTokenDetails;
    }

    const memoryCachedTokenDetails =
      tokenDetailsCache.get(tokenDetailsCacheKey);
    if (memoryCachedTokenDetails) {
      return memoryCachedTokenDetails;
    }

    const tokenFiat =
      allowTokenMapAsInitialDetails && tokenMapKey
        ? tokenMap?.[tokenMapKey]
        : undefined;
    if (!tokenFiat) {
      return undefined;
    }

    return {
      info: tokenInfo,
      ...tokenFiat,
    };
  }, [
    tokenDetailsContext,
    tokenDetailsKey,
    tokenDetailsCacheKey,
    allowTokenMapAsInitialDetails,
    tokenMap,
    tokenMapKey,
    tokenInfo,
  ]);

  const { handleOnReceive } = useReceiveToken({
    accountId,
    networkId,
    walletId,
    indexedAccountId: indexedAccountId ?? '',
  });

  const { isBotWallet, isBotWalletDeactivated } = useBotWalletDeactivatedStatus(
    {
      walletId,
    },
  );
  const isBotWalletReceiveBlocked = shouldBlockBotWalletReceive({
    isBotWallet,
    isBotWalletDeactivated,
  });
  const isBotWalletCopyBlocked = shouldBlockBotWalletCopyAddress({
    isBotWallet,
    isBotWalletDeactivated,
  });

  const { isFocused } = useTabIsRefreshingFocused();
  const tokenDetailsPromiseOptions = useMemo(
    () => ({
      watchLoading: true,
      overrideIsFocused: (isPageFocused: boolean) =>
        isPageFocused && (isTabView ? isFocused : true),
      debounced: POLLING_DEBOUNCE_INTERVAL,
      ...(cachedTokenDetails !== undefined
        ? { initResult: cachedTokenDetails }
        : {}),
    }),
    [cachedTokenDetails, isFocused, isTabView],
  );
  const { result: tokenDetailsResult, isLoading: isLoadingTokenDetails } =
    usePromiseResult(
      async () => {
        const tokensDetails =
          await backgroundApiProxy.serviceToken.fetchTokensDetails({
            accountId,
            networkId,
            contractList: [tokenInfo.address],
          });

        const data = tokensDetails?.[0];

        updateTokenMetadata({
          price: data?.price ?? 0,
          priceChange24h: data?.price24h ?? 0,
          coingeckoId: data?.info?.coingeckoId ?? '',
        });

        if (!data) {
          tokenDetailsCache.delete(tokenDetailsCacheKey);
          return undefined;
        }

        if (isNil(data.fiatValue)) {
          data.fiatValue = '0';
        }

        tokenDetailsCache.set(tokenDetailsCacheKey, data);
        updateTokenDetails({
          accountId,
          networkId,
          isInit: true,
          data,
        });
        return data;
      },
      [
        accountId,
        networkId,
        tokenInfo.address,
        updateTokenMetadata,
        updateTokenDetails,
        tokenDetailsCacheKey,
      ],
      tokenDetailsPromiseOptions,
    );

  const tokenDetails = tokenDetailsResult ?? cachedTokenDetails;

  useEffect(() => {
    if (!cachedTokenDetails || tokenDetailsResult) {
      return;
    }

    updateTokenMetadata({
      price: cachedTokenDetails.price ?? 0,
      priceChange24h: cachedTokenDetails.price24h ?? 0,
      coingeckoId:
        cachedTokenDetails.info?.coingeckoId ?? tokenInfo.coingeckoId ?? '',
    });
  }, [
    cachedTokenDetails,
    tokenDetailsResult,
    tokenInfo.coingeckoId,
    updateTokenMetadata,
  ]);

  const showLoadingState = useMemo(() => {
    if (tokenDetails) {
      return false;
    }
    if (tokenDetailsContext[tokenDetailsKey]?.init) {
      return false;
    }
    return isLoadingTokenDetails ?? true;
  }, [
    tokenDetails,
    tokenDetailsContext,
    tokenDetailsKey,
    isLoadingTokenDetails,
  ]);

  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();

  const createSwapActionHandler = useCallback(
    (actionType: ESwapTabSwitchType) => async () => {
      defaultLogger.wallet.walletActions.actionTrade({
        walletType: wallet?.type ?? '',
        networkId: network?.id ?? '',
        source: 'tokenDetails',
        tradeType: actionType,
        isSoftwareWalletOnlyUser,
      });
      navigation.pushModal(EModalRoutes.SwapModal, {
        screen: EModalSwapRoutes.SwapMainLand,
        params: {
          importNetworkId: networkId,
          importFromToken: {
            contractAddress: tokenInfo.address,
            symbol: tokenInfo.symbol,
            networkId,
            isNative: tokenInfo.isNative,
            decimals: tokenInfo.decimals,
            name: tokenInfo.name,
            logoURI: tokenInfo.logoURI,
            networkLogoURI: network?.logoURI,
          },
          importDeriveType: deriveType,
          ...(actionType && {
            swapTabSwitchType: actionType,
          }),
          swapSource: ESwapSource.TOKEN_DETAIL,
        },
      });
    },
    [
      wallet?.type,
      network?.id,
      network?.logoURI,
      navigation,
      networkId,
      tokenInfo.address,
      tokenInfo.symbol,
      tokenInfo.isNative,
      tokenInfo.decimals,
      tokenInfo.name,
      tokenInfo.logoURI,
      deriveType,
      isSoftwareWalletOnlyUser,
    ],
  );

  const handleOnSwap = createSwapActionHandler(ESwapTabSwitchType.SWAP);

  const disableSwapAction = useMemo(
    () => accountUtils.isUrlAccountFn({ accountId }),
    [accountId],
  );

  const handleSendPress = useCallback(() => {
    defaultLogger.wallet.walletActions.actionSend({
      walletType: wallet?.type ?? '',
      networkId: network?.id ?? '',
      source: 'tokenDetails',
      isSoftwareWalletOnlyUser,
    });
    navigation.pushModal(EModalRoutes.SignatureConfirmModal, {
      screen: EModalSignatureConfirmRoutes.TxDataInput,
      params: {
        networkId,
        accountId,
        isNFT: false,
        token: tokenDetails?.info ?? tokenInfo,
        isAllNetworks,
        disableAddressTypeSelector: true,
        showAddressTypeSelectorWhenDisabled: !accountUtils.isOthersWallet({
          walletId,
        }),
      },
    });
  }, [
    wallet?.type,
    network?.id,
    isSoftwareWalletOnlyUser,
    navigation,
    networkId,
    accountId,
    tokenDetails?.info,
    tokenInfo,
    isAllNetworks,
    walletId,
  ]);

  const isWatchOnly = useMemo(
    () => wallet?.type === WALLET_TYPE_WATCHING,
    [wallet?.type],
  );

  const { hideAccountAddress } = useDisplayAccountAddress({ networkId });
  const shouldShowAddressBlock = useMemo(() => {
    if (networkUtils.isLightningNetworkByNetworkId(networkId)) return false;

    if (wallet?.type === WALLET_TYPE_HD && !wallet?.backuped) return false;

    if (hideAccountAddress) return false;

    return true;
  }, [wallet?.type, networkId, wallet?.backuped, hideAccountAddress]);

  const addressBlockLabel = useMemo(
    () =>
      intl.formatMessage({
        id: ETranslations.global_my_address,
      }),
    [intl],
  );

  const addressBlockValue = useMemo(() => {
    const address = account?.address ?? '';

    if (
      accountUtils.isHwWallet({ walletId }) ||
      accountUtils.isQrWallet({ walletId })
    ) {
      return accountUtils.shortenAddress({ address });
    }

    return address;
  }, [account?.address, walletId]);

  const handleCopyAddressPress = useCallback(() => {
    if (isBotWalletCopyBlocked) {
      Toast.error({
        title: '该钱包已停用，无法复制地址',
      });
      return;
    }
    void copyAccountAddress({
      accountId,
      networkId,
      token: tokenInfo,
      deriveInfo,
    });
  }, [
    copyAccountAddress,
    accountId,
    networkId,
    tokenInfo,
    deriveInfo,
    isBotWalletCopyBlocked,
  ]);

  return (
    <DebugRenderTracker position="top-right" name="TokenDetailsHeader">
      <>
        {isWatchOnly ? (
          <Stack pt="$2" px="$5">
            <Alert
              type="warning"
              icon="ErrorOutline"
              title={intl.formatMessage({
                id: ETranslations.watch_only_alert_do_not_send,
              })}
            />
          </Stack>
        ) : null}
        {/* Overview */}
        <Stack px="$5" py="$5">
          {/* Balance */}
          <YStack gap="$2" mb="$5">
            {showLoadingState ? (
              <Skeleton.Group show>
                <Skeleton.Heading5Xl />
                <Skeleton.BodyLg />
              </Skeleton.Group>
            ) : (
              <>
                <NumberSizeableTextWrapper
                  hideValue
                  splitDecimal
                  formatter="value"
                  formatterOptions={{
                    currency: settings.currencyInfo.symbol,
                  }}
                  fontSize={48}
                  lineHeight={48}
                  fontWeight={500}
                >
                  {tokenDetails?.fiatValue ?? '0'}
                </NumberSizeableTextWrapper>
                <NumberSizeableTextWrapper
                  hideValue
                  formatter="balance"
                  color="$textSubdued"
                  size="$bodyLg"
                >
                  {tokenDetails?.balanceParsed ?? '0'}
                </NumberSizeableTextWrapper>
              </>
            )}
          </YStack>
          {/* Actions */}
          <RawActions>
            <RawActions.Send
              onPress={handleSendPress}
              trackID="wallet-token-details-send"
            />
            <RawActions.Receive
              disabled={isWatchOnly || isBotWalletReceiveBlocked}
              allowPressWhenDisabled={isBotWalletReceiveBlocked}
              onPress={async () => {
                if (isBotWalletReceiveBlocked) {
                  Toast.error({
                    title: '该钱包已停用，无法接收资产',
                  });
                  return;
                }
                if (
                  await backgroundApiProxy.serviceAccount.checkIsWalletNotBackedUp(
                    {
                      walletId: wallet?.id ?? '',
                    },
                  )
                ) {
                  return;
                }
                defaultLogger.wallet.walletActions.actionReceive({
                  walletType: wallet?.type ?? '',
                  networkId: network?.id ?? '',
                  source: 'tokenDetails',
                  isSoftwareWalletOnlyUser,
                });
                void handleOnReceive({
                  token: tokenInfo,
                });
              }}
              trackID="wallet-token-details-receive"
            />
            <RawActions.Swap
              onPress={handleOnSwap}
              disabled={disableSwapAction}
              trackID="wallet-token-details-swap"
            />
            <ReviewControl>
              <ActionBuy
                disabled={showLoadingState}
                isTabView={isTabView}
                walletId={wallet?.id ?? ''}
                networkId={networkId}
                accountId={accountId}
                walletType={wallet?.type}
                tokenAddress={tokenInfo.address}
                tokenSymbol={tokenInfo.symbol}
                source="tokenDetails"
                trackID="wallet-token-details-buy"
              />
            </ReviewControl>
          </RawActions>
        </Stack>

        {/* DeFi Entry Block */}
        <TokenDetailsDeFiBlock
          networkId={networkId}
          tokenAddress={tokenInfo.address}
          walletType={wallet?.type}
          tokenLogoURI={tokenInfo.logoURI}
        />
        <TokenDetailsAddressBlock
          shouldShow={shouldShowAddressBlock}
          label={addressBlockLabel}
          address={addressBlockValue}
          onPress={handleCopyAddressPress}
        />
        {/* History */}
        <Divider mb="$3" />
      </>
    </DebugRenderTracker>
  );
}

export default memo(TokenDetailsHeader);
