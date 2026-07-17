import { memo, useCallback, useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Alert,
  Icon,
  SizableText,
  Stack,
  Tabs,
  Toast,
  Tooltip,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { ReviewControl } from '@onekeyhq/kit/src/components/ReviewControl';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useBotWalletDeactivatedStatus } from '@onekeyhq/kit/src/hooks/useBotWalletDeactivatedStatus';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
import { showBotWalletDisabledToast } from '@onekeyhq/kit/src/utils/botWalletDisabledToast';
import { shouldBlockBotWalletReceive } from '@onekeyhq/kit/src/utils/botWalletStatusUtils';
import { formatPortfolioPercent } from '@onekeyhq/kit/src/views/Home/components/DeFiListBlock/formatPortfolioPercent';
import { RawActions } from '@onekeyhq/kit/src/views/Home/components/WalletActions/RawActions';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/shared/src/consts/dbConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EAssetSelectorRoutes,
  EModalReceiveRoutes,
  EModalRoutes,
  EModalSignatureConfirmRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils, {
  isEnabledNetworksInAllNetworks,
} from '@onekeyhq/shared/src/utils/networkUtils';
import {
  displayFiatValueOrUnavailable,
  displayOrUnavailable,
  isValidNumberValue,
} from '@onekeyhq/shared/src/utils/tokenValueUtils';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import { openFiatCryptoWidget } from './ActionBuy';
import TokenDetailsBalanceHero from './TokenDetailsBalanceHero';
import { useTokenDetailsContext } from './TokenDetailsContext';
import { TokenDetailsDeFiBlock } from './TokenDetailsDeFiBlock';
import { pushSwapFromTokenDetails } from './TokenDetailsHeader';
import { useAggregateTokenDetails } from './useAggregateTokenDetails';

type IProps = {
  accountId: string;
  networkId: string;
  walletId: string;
  indexedAccountId?: string;
  tokenInfo: IAccountToken;
  tokens: IAccountToken[];
  tokenMap?: Record<string, ITokenFiat>;
  isAllNetworks?: boolean;
  onSelectToken: (token: IAccountToken) => void;
};

function TokenDetailsOverview(props: IProps) {
  const {
    accountId,
    walletId,
    indexedAccountId,
    tokenInfo,
    tokens,
    tokenMap,
    isAllNetworks,
    onSelectToken,
  } = props;

  const intl = useIntl();
  const navigation = useAppNavigation();
  const { wallet } = useAccountData({ accountId, walletId });
  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();
  const { updateTokenDetails } = useTokenDetailsContext();

  const {
    rows,
    totalFiatValueBN,
    totalFiatValue,
    totalBalanceParsed,
    currency,
    hasBalanceData,
  } = useAggregateTokenDetails({ tokens, tokenMap });

  const isWatchOnly = wallet?.type === WALLET_TYPE_WATCHING;

  const { isBotWallet, isBotWalletDeactivated } = useBotWalletDeactivatedStatus(
    {
      walletId,
    },
  );
  const isBotWalletReceiveBlocked = shouldBlockBotWalletReceive({
    isBotWallet,
    isBotWalletDeactivated,
  });

  // Entry points other than the wallet home (e.g. universal search) do not
  // carry the full home fiat snapshot, and member tabs only fetch on focus —
  // which never happens while the user stays on Overview. Backfill the members
  // that have an address but no data yet; the fetched-keys set keeps re-runs
  // (rows change on every context update) from refetching.
  const backfilledKeysRef = useRef(new Set<string>());
  const { isLoading: isBackfillingDetails } = usePromiseResult(
    async () => {
      const missingRows = rows.filter(
        (row) =>
          !row.tokenDetail &&
          row.token.accountId &&
          row.token.networkId &&
          !backfilledKeysRef.current.has(row.token.$key),
      );
      if (!missingRows.length) {
        return;
      }
      // The home aggregate row only sums members on enabled networks, so
      // fetching a disabled member here would push the Overview total above
      // the home figure. Those members keep their "enable network" placeholder
      // row and stay unmarked so a later enable can still fill them in.
      let fetchableRows = missingRows;
      if (isAllNetworks) {
        const allNetworksState =
          await backgroundApiProxy.serviceAllNetwork.getAllNetworksState();
        fetchableRows = missingRows.filter(({ token }) =>
          isEnabledNetworksInAllNetworks({
            networkId: token.networkId ?? '',
            disabledNetworks: allNetworksState.disabledNetworks,
            enabledNetworks: allNetworksState.enabledNetworks,
            isTestnet: false,
          }),
        );
      }
      if (!fetchableRows.length) {
        return;
      }
      fetchableRows.forEach((row) =>
        backfilledKeysRef.current.add(row.token.$key),
      );
      await Promise.all(
        fetchableRows.map(async ({ token }) => {
          try {
            const resp =
              await backgroundApiProxy.serviceToken.fetchTokensDetails({
                accountId: token.accountId ?? '',
                networkId: token.networkId ?? '',
                contractList: [token.address],
              });
            const data = resp?.[0];
            if (data) {
              updateTokenDetails({
                accountId: token.accountId ?? '',
                networkId: token.networkId ?? '',
                isInit: true,
                data,
              });
            } else {
              // No data came back — unmark so a later run can retry instead of
              // leaving the row on its placeholder forever (member tabs only
              // fetch on focus, which never happens while staying on Overview).
              backfilledKeysRef.current.delete(token.$key);
            }
          } catch {
            // Transient failure — same retry rationale as the empty response.
            backfilledKeysRef.current.delete(token.$key);
          }
        }),
      );
    },
    [rows, isAllNetworks, updateTokenDetails],
    {
      watchLoading: true,
    },
  );

  const showLoadingState = !hasBalanceData && (isBackfillingDetails ?? true);

  const earnMembers = useMemo(
    () =>
      tokens
        .map((token) => ({
          networkId: token.networkId ?? '',
          address: token.address ?? '',
        }))
        .filter((member) => member.networkId),
    [tokens],
  );

  const handleSendPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.SignatureConfirmModal, {
      screen: EModalSignatureConfirmRoutes.TxSelectAggregateToken,
      params: {
        accountId,
        indexedAccountId,
        aggregateToken: tokenInfo,
        aggregateSubTokenList: tokens,
        hideZeroBalanceTokens: true,
        enableNetworkAfterSelect: true,
        closeAfterSelect: false,
        onSelect: async (token: IAccountToken) => {
          defaultLogger.wallet.walletActions.actionSend({
            walletType: wallet?.type ?? '',
            networkId: token.networkId ?? '',
            source: 'tokenDetails',
            isSoftwareWalletOnlyUser,
          });

          const settings =
            await backgroundApiProxy.serviceNetwork.getVaultSettings({
              networkId: token.networkId ?? '',
            });

          let sendAccountId = token.accountId ?? '';
          if (
            settings.mergeDeriveAssetsEnabled &&
            isAllNetworks &&
            !accountUtils.isOthersWallet({ walletId })
          ) {
            const defaultDeriveType =
              await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork(
                {
                  networkId: token.networkId ?? '',
                },
              );
            const { accounts } =
              await backgroundApiProxy.serviceAccount.getAccountsByIndexedAccounts(
                {
                  indexedAccountIds: [indexedAccountId ?? ''],
                  networkId: token.networkId ?? '',
                  deriveType: defaultDeriveType,
                },
              );
            sendAccountId = accounts?.[0]?.id ?? sendAccountId;
          }

          navigation.push(EModalSignatureConfirmRoutes.TxDataInput, {
            accountId: sendAccountId,
            networkId: token.networkId ?? '',
            isNFT: false,
            token,
            isAllNetworks,
          });
        },
      },
    });
  }, [
    navigation,
    accountId,
    indexedAccountId,
    tokenInfo,
    tokens,
    wallet?.type,
    isSoftwareWalletOnlyUser,
    isAllNetworks,
    walletId,
  ]);

  const handleReceivePress = useCallback(async () => {
    if (isBotWalletReceiveBlocked) {
      showBotWalletDisabledToast('receive');
      return;
    }
    if (
      await backgroundApiProxy.serviceAccount.checkIsWalletNotBackedUp({
        walletId: wallet?.id ?? '',
      })
    ) {
      return;
    }
    defaultLogger.wallet.walletActions.actionReceive({
      walletType: wallet?.type ?? '',
      networkId: tokenInfo.networkId ?? '',
      source: 'tokenDetails',
      isSoftwareWalletOnlyUser,
    });
    navigation.pushModal(EModalRoutes.ReceiveModal, {
      screen: EModalReceiveRoutes.ReceiveSelectAggregateToken,
      params: {
        accountId,
        indexedAccountId,
        aggregateToken: tokenInfo,
        aggregateSubTokenList: tokens,
        enableNetworkAfterSelect: true,
        closeAfterSelect: false,
        onSelect: async (token: IAccountToken) => {
          if (networkUtils.isLightningNetworkByNetworkId(token.networkId)) {
            navigation.push(EModalReceiveRoutes.CreateInvoice, {
              networkId: token.networkId ?? '',
              accountId: token.accountId ?? '',
            });
            return;
          }

          const settings =
            await backgroundApiProxy.serviceNetwork.getVaultSettings({
              networkId: token.networkId ?? '',
            });

          // Merge-derive networks route through the derive-type selector,
          // which requires an empty accountId.
          const useDeriveSelector =
            settings.mergeDeriveAssetsEnabled &&
            isAllNetworks &&
            !accountUtils.isOthersWallet({ walletId });

          navigation.push(EModalReceiveRoutes.ReceiveToken, {
            networkId: token.networkId ?? '',
            accountId: useDeriveSelector ? '' : (token.accountId ?? ''),
            walletId,
            token,
            indexedAccountId,
          });
        },
      },
    });
  }, [
    isBotWalletReceiveBlocked,
    wallet?.id,
    wallet?.type,
    isSoftwareWalletOnlyUser,
    navigation,
    accountId,
    indexedAccountId,
    tokenInfo,
    tokens,
    isAllNetworks,
    walletId,
  ]);

  const handleSwapPress = useCallback(async () => {
    // Rows are sorted by fiat value, so the first member is the one the user
    // most plausibly wants to trade; the swap page allows changing it.
    const member = rows[0]?.token ?? tokens[0];
    if (!member?.networkId) {
      return;
    }
    const [memberNetwork, memberDeriveType] = await Promise.all([
      backgroundApiProxy.serviceNetwork.getNetworkSafe({
        networkId: member.networkId,
      }),
      backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
        networkId: member.networkId,
      }),
    ]);
    await pushSwapFromTokenDetails({
      navigation,
      token: {
        address: member.address,
        symbol: member.symbol,
        isNative: member.isNative,
        decimals: member.decimals,
        name: member.name,
        logoURI: member.logoURI ?? tokenInfo.logoURI,
      },
      networkId: member.networkId,
      networkLogoURI: memberNetwork?.logoURI,
      deriveType: memberDeriveType,
      walletType: wallet?.type,
      isSoftwareWalletOnlyUser,
    });
  }, [
    rows,
    tokens,
    tokenInfo.logoURI,
    wallet?.type,
    isSoftwareWalletOnlyUser,
    navigation,
  ]);

  const disableSwapAction = useMemo(
    () => accountUtils.isUrlAccountFn({ accountId }),
    [accountId],
  );

  const disableBuyAction = isWatchOnly && !platformEnv.isDev;

  const handleBuyPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.AssetSelectorModal, {
      screen: EAssetSelectorRoutes.AggregateTokenSelector,
      params: {
        accountId,
        indexedAccountId,
        aggregateToken: tokenInfo,
        aggregateSubTokenList: tokens,
        enableNetworkAfterSelect: true,
        closeAfterSelect: false,
        onSelect: async (token: IAccountToken) => {
          // The chain-tab Buy button disables itself via this same check; the
          // selector cannot know support upfront, so gate after selection
          // instead of letting the widget request fail with a generic error.
          const isBuySupported =
            await backgroundApiProxy.serviceFiatCrypto.isTokenSupported({
              networkId: token.networkId ?? '',
              tokenAddress: token.address,
              type: 'buy',
            });
          if (!isBuySupported) {
            Toast.error({
              title: intl.formatMessage(
                {
                  id: ETranslations.wallet_history_settings_hide_risk_transaction_desc_unsupported,
                },
                { networkName: token.networkName || token.symbol },
              ),
            });
            return;
          }
          await openFiatCryptoWidget({
            type: 'buy',
            networkId: token.networkId ?? '',
            tokenAddress: token.address,
            tokenSymbol: token.symbol,
            accountId: token.accountId ?? '',
            walletId,
            walletType: wallet?.type,
            source: 'tokenDetails',
            isSoftwareWalletOnlyUser,
          });
        },
      },
    });
  }, [
    navigation,
    accountId,
    indexedAccountId,
    tokenInfo,
    tokens,
    intl,
    walletId,
    wallet?.type,
    isSoftwareWalletOnlyUser,
  ]);

  const renderPercent = useCallback(
    (tokenDetail?: { fiatValue?: string }) => {
      if (
        !tokenDetail ||
        !totalFiatValueBN ||
        totalFiatValueBN.lte(0) ||
        !isValidNumberValue(tokenDetail.fiatValue)
      ) {
        return null;
      }
      const percent = new BigNumber(tokenDetail.fiatValue)
        .div(totalFiatValueBN)
        .times(100);
      if (percent.isNaN() || percent.lt(0)) {
        return null;
      }
      return formatPortfolioPercent(
        percent.decimalPlaces(1).toNumber(),
        tokenDetail.fiatValue,
      );
    },
    [totalFiatValueBN],
  );

  return (
    <Tabs.ScrollView showsVerticalScrollIndicator={false}>
      {isWatchOnly ? (
        <Stack pt="$5" px="$5">
          <Alert
            type="warning"
            icon="ErrorOutline"
            title={intl.formatMessage({
              id: ETranslations.watch_only_alert_do_not_send,
            })}
          />
        </Stack>
      ) : null}
      <Stack px="$5" py="$5">
        {/* Aggregate balance */}
        <TokenDetailsBalanceHero
          isLoading={showLoadingState}
          currency={currency}
          fiatValue={totalFiatValue}
          balanceParsed={totalBalanceParsed}
        />
        {/* Actions */}
        <RawActions>
          <RawActions.Send
            onPress={handleSendPress}
            trackID="wallet-token-details-overview-send"
          />
          <RawActions.Receive
            disabled={isWatchOnly || isBotWalletReceiveBlocked}
            allowPressWhenDisabled={isBotWalletReceiveBlocked}
            onPress={handleReceivePress}
            trackID="wallet-token-details-overview-receive"
          />
          <RawActions.Swap
            onPress={handleSwapPress}
            disabled={disableSwapAction}
            trackID="wallet-token-details-overview-swap"
          />
          <ReviewControl>
            <RawActions.Buy
              label={intl.formatMessage({ id: ETranslations.global_buy })}
              disabled={disableBuyAction}
              onPress={handleBuyPress}
              trackID="wallet-token-details-overview-buy"
            />
          </ReviewControl>
        </RawActions>
      </Stack>
      {/* Earn entry across all member networks */}
      <TokenDetailsDeFiBlock
        networkId={tokenInfo.networkId ?? ''}
        tokenAddress={tokenInfo.$key}
        walletType={wallet?.type}
        tokenLogoURI={tokenInfo.logoURI}
        aggregateTokens={earnMembers}
      />
      {/* Allocation */}
      <YStack pb="$5">
        <SizableText px="$5" pb="$1" size="$headingSm" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.defi_allocation })}
        </SizableText>
        {rows.map(({ token, tokenDetail }) => {
          const percentText = renderPercent(tokenDetail);
          return (
            <ListItem
              key={token.$key}
              userSelect="none"
              onPress={() => onSelectToken(token)}
            >
              <NetworkAvatar networkId={token.networkId} size="$8" />
              <ListItem.Text
                flex={1}
                primary={token.networkName || token.networkId}
                secondary={percentText ?? undefined}
              />
              {tokenDetail ? (
                <ListItem.Text
                  align="right"
                  primary={
                    <NumberSizeableTextWrapper
                      hideValue
                      formatter="balance"
                      size="$bodyLgMedium"
                      textAlign="right"
                    >
                      {displayOrUnavailable(tokenDetail.balanceParsed)}
                    </NumberSizeableTextWrapper>
                  }
                  secondary={
                    <Currency
                      hideValue
                      size="$bodyMd"
                      color="$textSubdued"
                      formatter="value"
                      sourceCurrency={tokenDetail.currency}
                      textAlign="right"
                    >
                      {displayFiatValueOrUnavailable(
                        tokenDetail.fiatValue,
                        tokenDetail.balanceParsed,
                      )}
                    </Currency>
                  }
                />
              ) : (
                <Tooltip
                  renderTrigger={
                    <Icon
                      name="RefreshCcwOutline"
                      size="$4"
                      color="$iconSubdued"
                    />
                  }
                  renderContent={intl.formatMessage({
                    id: ETranslations.network_enable_or_create_address,
                  })}
                />
              )}
              <Icon name="ChevronRightSmallOutline" color="$iconSubdued" />
            </ListItem>
          );
        })}
      </YStack>
    </Tabs.ScrollView>
  );
}

export default memo(TokenDetailsOverview);
