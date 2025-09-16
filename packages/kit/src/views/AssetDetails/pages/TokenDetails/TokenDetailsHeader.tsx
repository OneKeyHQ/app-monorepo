import { memo, useCallback, useMemo } from 'react';

import { type IProps } from '.';

import { useIntl } from 'react-intl';

import {
  Alert,
  DebugRenderTracker,
  Divider,
  Icon,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useTabIsRefreshingFocused,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { ReviewControl } from '@onekeyhq/kit/src/components/ReviewControl';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useCopyAccountAddress } from '@onekeyhq/kit/src/hooks/useCopyAccountAddress';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useReceiveToken } from '@onekeyhq/kit/src/hooks/useReceiveToken';
import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
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
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import {
  ESwapSource,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { WalletActionEarn } from '../../../Home/components/WalletActions/WalletActionEarn';

import ActionBuy from './ActionBuy';
import ActionSell from './ActionSell';
import { useTokenDetailsContext } from './TokenDetailsContext';

function TokenDetailsHeader(props: IProps) {
  const {
    accountId,
    networkId,
    walletId,
    tokenInfo,
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

  const { handleOnReceive } = useReceiveToken({
    accountId,
    networkId,
    walletId,
    indexedAccountId: indexedAccountId ?? '',
  });

  const { isFocused } = useTabIsRefreshingFocused();
  const { result: tokenDetailsResult } = usePromiseResult(
    async () => {
      const tokensDetails =
        await backgroundApiProxy.serviceToken.fetchTokensDetails({
          accountId,
          networkId,
          contractList: [tokenInfo.address],
        });
      updateTokenMetadata({
        price: tokensDetails[0]?.price ?? 0,
        priceChange24h: tokensDetails[0]?.price24h ?? 0,
        coingeckoId: tokensDetails[0]?.info?.coingeckoId ?? '',
      });
      updateTokenDetails({
        accountId,
        networkId,
        isInit: true,
        data: tokensDetails[0],
      });
      return tokensDetails[0];
    },
    [
      accountId,
      networkId,
      tokenInfo.address,
      updateTokenMetadata,
      updateTokenDetails,
    ],
    {
      overrideIsFocused: (isPageFocused) =>
        isPageFocused && (isTabView ? isFocused : true),
      debounced: POLLING_DEBOUNCE_INTERVAL,
    },
  );

  const tokenDetails =
    tokenDetailsResult ?? tokenDetailsContext[tokenDetailsKey]?.data;

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
  const handleOnBridge = createSwapActionHandler(ESwapTabSwitchType.BRIDGE);

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
      },
    });
  }, [
    accountId,
    isAllNetworks,
    navigation,
    network?.id,
    networkId,
    tokenDetails?.info,
    tokenInfo,
    wallet?.type,
    isSoftwareWalletOnlyUser,
  ]);

  const isReceiveDisabled = useMemo(
    () => wallet?.type === WALLET_TYPE_WATCHING,
    [wallet?.type],
  );

  const disableSwapAction = useMemo(
    () => accountUtils.isUrlAccountFn({ accountId }),
    [accountId],
  );

  const shouldShowAddressBlock = useMemo(() => {
    if (networkUtils.isLightningNetworkByNetworkId(networkId)) return false;

    if (wallet?.type === WALLET_TYPE_HD && !wallet?.backuped) return false;

    return true;
  }, [wallet?.type, networkId, wallet?.backuped]);

  return (
    <DebugRenderTracker timesBadgePosition="top-right">
      <>
        {isAllNetworks &&
        !tokenInfo.isAggregateToken &&
        tokenInfo.isSameSymbolWithAggregateToken ? (
          <Alert
            icon="InfoCircleOutline"
            type="critical"
            title={intl.formatMessage({
              id: ETranslations.identical_name_asset_alert,
            })}
            fullBleed
          />
        ) : null}
        {/* Overview */}
        <Stack px="$5" py="$5">
          {/* Balance */}
          <XStack alignItems="center" mb="$5">
            <Stack flex={1}>
              <NumberSizeableTextWrapper
                hideValue
                size="$heading4xl"
                formatter="balance"
                fontWeight="bold"
              >
                {tokenDetails?.balanceParsed ?? '0'}
              </NumberSizeableTextWrapper>
              <NumberSizeableTextWrapper
                hideValue
                formatter="value"
                formatterOptions={{
                  currency: settings.currencyInfo.symbol,
                }}
                color="$textSubdued"
                size="$bodyLg"
              >
                {tokenDetails?.fiatValue ?? '0'}
              </NumberSizeableTextWrapper>
            </Stack>
          </XStack>
          {/* Actions */}
          <RawActions gap="$8" flexWrap="wrap" flexDirection="row">
            <RawActions.Send
              onPress={handleSendPress}
              trackID="wallet-token-details-send"
            />
            <RawActions.Receive
              disabled={isReceiveDisabled}
              onPress={async () => {
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
            <RawActions.Bridge
              onPress={handleOnBridge}
              disabled={disableSwapAction}
              trackID="wallet-token-details-bridge"
            />
            <WalletActionEarn
              accountId={accountId}
              tokenAddress={tokenInfo.address}
              networkId={networkId}
              indexedAccountId={indexedAccountId}
              walletType={wallet?.type}
              source="tokenDetails"
              trackID="wallet-token-details-stake"
            />
            <ReviewControl>
              <ActionBuy
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

            <ReviewControl>
              <ActionSell
                isTabView={isTabView}
                walletId={wallet?.id ?? ''}
                networkId={networkId}
                accountId={accountId}
                walletType={wallet?.type}
                tokenAddress={tokenInfo.address}
                tokenSymbol={tokenInfo.symbol}
                source="tokenDetails"
                trackID="wallet-token-details-sell"
              />
            </ReviewControl>

            <Stack w={50} />
          </RawActions>
        </Stack>
        {shouldShowAddressBlock ? (
          <>
            <Divider />
            <YStack
              userSelect="none"
              onPress={() =>
                copyAccountAddress({
                  accountId,
                  networkId,
                  token: tokenInfo,
                  deriveInfo,
                })
              }
              px="$5"
              py="$3"
              gap="$1"
              {...listItemPressStyle}
            >
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.global_my_address,
                })}
              </SizableText>
              <XStack gap="$4">
                <SizableText
                  size="$bodyMd"
                  color="$text"
                  $platform-web={{
                    wordBreak: 'break-word',
                  }}
                >
                  {accountUtils.isHwWallet({ walletId }) ||
                  accountUtils.isQrWallet({ walletId })
                    ? accountUtils.shortenAddress({
                        address: account?.address ?? '',
                      })
                    : account?.address}
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
        ) : null}
        {/* History */}
        <Divider mb="$3" />
      </>
    </DebugRenderTracker>
  );
}

export default memo(TokenDetailsHeader);
