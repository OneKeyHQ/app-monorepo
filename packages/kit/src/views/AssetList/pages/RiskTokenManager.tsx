import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { debounce, groupBy, keyBy, mapValues } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Alert,
  Button,
  Page,
  SectionList,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { SEARCH_DEBOUNCE_INTERVAL } from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalAssetDetailRoutes,
  type EModalAssetListRoutes,
  type IModalAssetListParamList,
} from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IAccountToken,
  ICloudSyncCustomToken,
} from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { EmptySearch } from '../../../components/Empty';
import { ListItem } from '../../../components/ListItem';
import TokenIconView from '../../../components/TokenListView/TokenIconView';
import TokenNameView from '../../../components/TokenListView/TokenNameView';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { withTokenListProvider } from '../../../states/jotai/contexts/tokenList';
import { AssetListTestIDs } from '../testIDs';

import type { RouteProp } from '@react-navigation/core';
import type {
  GestureResponderEvent,
  NativeSyntheticEvent,
  TextInputFocusEventData,
} from 'react-native';

function RiskTokenManager() {
  const intl = useIntl();

  const navigation = useAppNavigation();

  const route =
    useRoute<
      RouteProp<
        IModalAssetListParamList,
        EModalAssetListRoutes.RiskTokenManager
      >
    >();

  const {
    tokenList,
    isAllNetworks,
    networkId,
    walletId,
    accountId,
    deriveType,
    deriveInfo,
    accountAddress,
  } = route.params;

  const { tokens, map: tokenMap } = tokenList;

  const originalUnblockedTokens = useRef('');
  const originalBlockedTokens = useRef('');

  const [unblockedTokensMap, setUnblockedTokensMap] = useState<
    Record<string, Record<string, boolean>>
  >({});

  const [blockedTokensMap, setBlockedTokensMap] = useState<
    Record<string, Record<string, boolean>>
  >({});

  const [customTokensMap, setCustomTokensMap] = useState<
    Record<string, Record<string, ICloudSyncCustomToken>>
  >({});

  const [isEditing, setIsEditing] = useState(false);
  const [searchKey, setSearchKey] = useState('');

  const headerRight = useCallback(() => {
    return (
      <Button
        testID={AssetListTestIDs.riskTokenEditBtn}
        size="sm"
        variant="tertiary"
        onPress={() => {
          setIsEditing((prev) => !prev);
        }}
      >
        {intl.formatMessage({
          id: isEditing ? ETranslations.global_done : ETranslations.global_edit,
        })}
      </Button>
    );
  }, [intl, isEditing]);

  const { result: sectionListData } = usePromiseResult(
    async () => {
      if (!tokens) {
        return [];
      }

      const blockedTokens = [];
      const unblockedTokens = [];

      for (const token of tokens) {
        const tokenNetworkId = token.networkId ?? networkId;

        if (
          (unblockedTokensMap?.[tokenNetworkId]?.[token.address] ||
            !!customTokensMap?.[tokenNetworkId]?.[token.address]) &&
          !blockedTokensMap?.[tokenNetworkId]?.[token.address]
        ) {
          unblockedTokens.push({
            ...token,
            isBlocked: false,
          });
        } else {
          blockedTokens.push({
            ...token,
            isBlocked: true,
          });
        }
      }

      if (unblockedTokens.length === 0) {
        return [
          {
            title: intl.formatMessage({
              id: ETranslations.wallet_collapsed_risk_assets,
            }),
            data: blockedTokens,
          },
        ];
      }

      return [
        {
          title: intl.formatMessage({
            id: ETranslations.wallet_risk_assets_always_visible_on_home,
          }),
          data: unblockedTokens,
        },
        {
          title: intl.formatMessage({
            id: ETranslations.wallet_collapsed_risk_assets,
          }),
          data: blockedTokens,
        },
      ];
    },
    [
      intl,
      tokens,
      networkId,
      unblockedTokensMap,
      blockedTokensMap,
      customTokensMap,
    ],
    {
      initResult: [],
    },
  );

  const filteredSectionListData = useMemo(() => {
    if (!searchKey.trim()) {
      return sectionListData;
    }

    const result = sectionListData?.map((section) => {
      return {
        ...section,
        data: section.data.filter((token) => {
          return (
            token.symbol?.toLowerCase().includes(searchKey.toLowerCase()) ||
            token.name?.toLowerCase().includes(searchKey.toLowerCase()) ||
            token.address?.toLowerCase().includes(searchKey.toLowerCase())
          );
        }),
      };
    });

    if (result.every((section) => section.data.length === 0)) {
      return [];
    }

    return result;
  }, [sectionListData, searchKey]);

  const handleOnClose = useCallback(async () => {
    await backgroundApiProxy.serviceToken.updateRiskTokensState({
      unblockedTokens: unblockedTokensMap,
      blockedTokens: blockedTokensMap,
    });

    await backgroundApiProxy.serviceToken.clearRiskTokensManagementCache();

    const currentUnblockedTokens = JSON.stringify(unblockedTokensMap);
    const currentBlockedTokens = JSON.stringify(blockedTokensMap);
    if (
      currentUnblockedTokens !== originalUnblockedTokens.current ||
      currentBlockedTokens !== originalBlockedTokens.current
    ) {
      await timerUtils.wait(1000);
      appEventBus.emit(EAppEventBusNames.RefreshTokenList, undefined);
    }
  }, [unblockedTokensMap, blockedTokensMap]);

  useEffect(() => {
    const fetchRiskTokens = async () => {
      const [u, b, c] = await Promise.all([
        backgroundApiProxy.serviceToken.getUnblockedTokensMap({
          networkId,
        }),
        backgroundApiProxy.serviceToken.getBlockedTokensMap({
          networkId,
        }),
        backgroundApiProxy.serviceCustomToken.getAllCustomTokens(),
      ]);
      setUnblockedTokensMap(u);
      setBlockedTokensMap(b);

      const cMap = mapValues(groupBy(c, 'networkId'), (tokenArray) =>
        keyBy(tokenArray, 'address'),
      );

      setCustomTokensMap(cMap);

      originalUnblockedTokens.current = JSON.stringify(u);
      originalBlockedTokens.current = JSON.stringify(b);
    };

    void fetchRiskTokens();
  }, [networkId]);

  const handleToggleBlockedToken = useCallback(
    (token: IAccountToken & { isBlocked: boolean }) => {
      const tokenNetworkId = token.networkId ?? networkId;
      const tokenAddress = token.address;

      Toast.success({
        title: intl.formatMessage(
          {
            id: token.isBlocked
              ? ETranslations.wallet_risk_assets_hide_on_home_feedback_shown
              : ETranslations.wallet_risk_assets_hide_on_home_feedback_hidden,
          },
          {
            tokenSymbol: token.symbol,
          },
        ),
      });

      setUnblockedTokensMap((prev) => ({
        ...prev,
        [tokenNetworkId]: {
          ...prev[tokenNetworkId],
          [tokenAddress]: !!token.isBlocked,
        },
      }));
      setBlockedTokensMap((prev) => ({
        ...prev,
        [tokenNetworkId]: {
          ...prev[tokenNetworkId],
          [tokenAddress]: !token.isBlocked,
        },
      }));
    },
    [networkId, intl],
  );

  const handleOnPressToken = useCallback(
    (token: IAccountToken & { isBlocked: boolean }) => {
      navigation.push(EModalAssetDetailRoutes.TokenDetails, {
        accountId: token.accountId ?? accountId,
        networkId: token.networkId ?? networkId,
        walletId,
        tokenInfo: token,
        isBlocked: token.isBlocked,
        deriveInfo,
        deriveType,
        isAllNetworks,
        tokenMap,
        accountAddress,
      });
    },
    [
      navigation,
      accountId,
      networkId,
      walletId,
      deriveInfo,
      deriveType,
      isAllNetworks,
      tokenMap,
      accountAddress,
    ],
  );

  return (
    <Page onClose={handleOnClose}>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.wallet_risk_assets,
        })}
        headerRight={headerRight}
        headerSearchBarOptions={{
          onChangeText: debounce(
            (e: NativeSyntheticEvent<TextInputFocusEventData>) =>
              setSearchKey(e.nativeEvent.text),
            SEARCH_DEBOUNCE_INTERVAL,
          ),
          placeholder: intl.formatMessage({
            id: ETranslations.global_search,
          }),
        }}
      />
      <Page.Body>
        <Alert
          type="danger"
          icon="ErrorOutline"
          title={intl.formatMessage({
            id: ETranslations.wallet_risk_assets_description,
          })}
          fullBleed
        />
        <SectionList
          sections={filteredSectionListData}
          renderSectionHeader={({ section }) => (
            <SectionList.SectionHeader
              title={(section as { title: string }).title}
            />
          )}
          estimatedItemSize={60}
          ListEmptyComponent={<EmptySearch />}
          renderItem={({
            item: token,
          }: {
            item: IAccountToken & {
              isBlocked: boolean;
            };
          }) => (
            <ListItem
              testID={AssetListTestIDs.riskTokenListItem}
              key={token.$key ?? token.uniqueKey}
              onPress={() => handleOnPressToken(token)}
            >
              {/* Management UI: icon + symbol only. This screen has NO
                  TokenListViewContext.Provider / cell producer, so any fiat leaf
                  (price/value/balance) would render placeholder dashes and spin
                  up discarded useTokenFiat subscriptions — do NOT re-add them. */}
              <XStack alignItems="center" gap="$3" maxWidth="60%">
                <TokenIconView
                  $key={token.$key}
                  networkId={token.networkId}
                  icon={token.logoURI}
                  isAllNetworks={isAllNetworks}
                  showNetworkIcon={isAllNetworks}
                />
                <YStack flex={1}>
                  <TokenNameView
                    $key={token.$key}
                    name={token.symbol}
                    isAggregateToken={token.isAggregateToken}
                    isNative={token.isNative}
                    isAllNetworks={isAllNetworks}
                    networkId={token.networkId}
                    textProps={{
                      size: '$bodyLgMedium',
                      flexShrink: 0,
                    }}
                  />
                </YStack>
              </XStack>
              {isEditing ? (
                <YStack alignItems="flex-end" flex={1}>
                  <Button
                    testID={AssetListTestIDs.riskTokenToggleBtn}
                    size="small"
                    variant="secondary"
                    onPress={(e: GestureResponderEvent) => {
                      e.stopPropagation();
                      handleToggleBlockedToken(token);
                    }}
                  >
                    {intl.formatMessage({
                      id: token.isBlocked
                        ? ETranslations.wallet_risk_assets_show_on_home
                        : ETranslations.wallet_risk_assets_hide_on_home,
                    })}
                  </Button>
                </YStack>
              ) : null}
            </ListItem>
          )}
        />
      </Page.Body>
    </Page>
  );
}

const RiskTokenManagerWithProvider = memo(
  withTokenListProvider(RiskTokenManager),
);
RiskTokenManagerWithProvider.displayName = 'RiskTokenManagerWithProvider';

export default RiskTokenManagerWithProvider;
