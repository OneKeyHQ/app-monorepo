import { memo, useCallback, useMemo } from 'react';

import { type IProps } from '.';

import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import {
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
import { useDisplayAccountAddress } from '@onekeyhq/kit/src/hooks/useDisplayAccountAddress';
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

import ActionBuy from './ActionBuy';
import { useTokenDetailsContext } from './TokenDetailsContext';
import { TokenDetailsDeFiBlock } from './TokenDetailsDeFiBlock';

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
          return undefined;
        }

        if (isNil(data.fiatValue)) {
          data.fiatValue = '0';
        }

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
      ],
      {
        watchLoading: true,
        overrideIsFocused: (isPageFocused) =>
          isPageFocused && (isTabView ? isFocused : true),
        debounced: POLLING_DEBOUNCE_INTERVAL,
      },
    );

  const tokenDetails =
    tokenDetailsResult ?? tokenDetailsContext[tokenDetailsKey]?.data;

  const showLoadingState = useMemo(() => {
    if (tokenDetailsContext[tokenDetailsKey]?.init) {
      return false;
    }
    return isLoadingTokenDetails;
  }, [tokenDetailsContext, tokenDetailsKey, isLoadingTokenDetails]);

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

  const isReceiveDisabled = useMemo(
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

  return (
    <DebugRenderTracker position="top-right" name="TokenDetailsHeader">
      <>
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
                  flexShrink={1}
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
