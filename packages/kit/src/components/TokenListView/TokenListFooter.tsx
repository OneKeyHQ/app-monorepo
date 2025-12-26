import { useCallback, useEffect, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { groupBy, keyBy, mapValues } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  IconButton,
  NumberSizeableText,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import {
  useSettingsPersistAtom,
  useSettingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { SEARCH_KEY_MIN_LENGTH } from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalAssetListRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';
import {
  useAggregateTokensListMapAtom,
  useAggregateTokensMapAtom,
  useRiskyTokenListAtom,
  useRiskyTokenListMapAtom,
  useSearchKeyAtom,
  useSmallBalanceTokenListAtom,
  useSmallBalanceTokenListMapAtom,
  useSmallBalanceTokensFiatValueAtom,
} from '../../states/jotai/contexts/tokenList';

import { useTokenListViewContext } from './TokenListViewContext';

type IProps = {
  tableLayout?: boolean;
  hideZeroBalanceTokens?: boolean;
  hideDeFiMarkedTokens?: boolean;
  hasTokens?: boolean;
  manageTokenEnabled?: boolean;
  plainMode?: boolean;
};

function TokenListFooter(props: IProps) {
  const intl = useIntl();
  const {
    tableLayout,
    hideZeroBalanceTokens,
    hideDeFiMarkedTokens,
    hasTokens,
    manageTokenEnabled,
    plainMode,
  } = props;
  const navigation = useAppNavigation();
  const {
    activeAccount: {
      account,
      network,
      wallet,
      deriveType,
      deriveInfo,
      indexedAccount,
    },
  } = useActiveAccount({ num: 0 });

  const [settings] = useSettingsPersistAtom();

  const [{ hideValue }] = useSettingsValuePersistAtom();

  const { allAggregateTokenMap } = useTokenListViewContext();

  const [smallBalanceTokenList] = useSmallBalanceTokenListAtom();

  const [smallBalanceTokenListMap] = useSmallBalanceTokenListMapAtom();

  const [smallBalanceTokensFiatValue] = useSmallBalanceTokensFiatValueAtom();

  const [riskyTokenList] = useRiskyTokenListAtom();

  const [riskyTokenListMap] = useRiskyTokenListMapAtom();

  const [searchKey] = useSearchKeyAtom();

  const [aggregateTokensListMap] = useAggregateTokensListMapAtom();

  const [aggregateTokensMap] = useAggregateTokensMapAtom();

  const { smallBalanceTokens, keys: smallBalanceTokenKeys } =
    smallBalanceTokenList;

  const { riskyTokens, keys: riskyTokenKeys } = riskyTokenList;

  const isSearchMode = searchKey.length >= SEARCH_KEY_MIN_LENGTH;
  const helpText = useMemo(
    () => [
      intl.formatMessage({
        id: ETranslations.low_value_assets_desc_out_of_range,
      }),
      intl.formatMessage({
        id: ETranslations.low_value_assets_desc,
      }),
    ],
    [intl],
  );

  const filteredSmallBalanceTokens = useMemo(() => {
    let resultTokens = smallBalanceTokens;

    if (hideZeroBalanceTokens) {
      resultTokens = resultTokens.filter((token) => {
        const tokenBalance = new BigNumber(
          smallBalanceTokenListMap[token.$key]?.balance ??
            aggregateTokensMap[token.$key]?.balance ??
            0,
        );

        if (tokenBalance.gt(0)) {
          return true;
        }

        return false;
      });
    }

    if (hideDeFiMarkedTokens) {
      resultTokens = resultTokens.filter((token) => !token.defiMarked);
    }

    return resultTokens;
  }, [
    smallBalanceTokens,
    hideZeroBalanceTokens,
    hideDeFiMarkedTokens,
    smallBalanceTokenListMap,
    aggregateTokensMap,
  ]);

  const filteredRiskyTokens = useMemo(() => {
    if (hideZeroBalanceTokens) {
      return riskyTokens.filter((token) => {
        const tokenBalance = new BigNumber(
          riskyTokenListMap[token.$key]?.balance ??
            aggregateTokensMap[token.$key]?.balance ??
            0,
        );

        if (tokenBalance.gt(0)) {
          return true;
        }

        return false;
      });
    }
    return riskyTokens;
  }, [
    riskyTokens,
    hideZeroBalanceTokens,
    riskyTokenListMap,
    aggregateTokensMap,
  ]);

  const handleOnPressLowValueTokens = useCallback(() => {
    if (!account || !network || !wallet || smallBalanceTokens.length === 0)
      return;
    navigation.pushModal(EModalRoutes.MainModal, {
      screen: EModalAssetListRoutes.TokenList,
      params: {
        title: intl.formatMessage({ id: ETranslations.low_value_assets }),
        helpText,
        accountId: account.id,
        networkId: network.id,
        walletId: wallet.id,
        tokenList: {
          tokens: filteredSmallBalanceTokens,
          keys: smallBalanceTokenKeys,
          map: smallBalanceTokenListMap,
        },
        deriveType,
        deriveInfo,
        hideValue,
        isAllNetworks: network.isAllNetworks,
        aggregateTokensListMap,
        aggregateTokensMap,
        accountAddress: account.address,
        allAggregateTokenMap,
        searchKeyLengthThreshold: 1,
      },
    });
  }, [
    account,
    network,
    wallet,
    smallBalanceTokens.length,
    navigation,
    intl,
    helpText,
    filteredSmallBalanceTokens,
    smallBalanceTokenKeys,
    smallBalanceTokenListMap,
    deriveType,
    deriveInfo,
    hideValue,
    aggregateTokensListMap,
    aggregateTokensMap,
    allAggregateTokenMap,
  ]);

  const handleOnPressRiskyTokens = useCallback(() => {
    if (!account || !network || !wallet) return;
    navigation.pushModal(EModalRoutes.MainModal, {
      screen: EModalAssetListRoutes.RiskTokenManager,
      params: {
        accountId: account.id,
        networkId: network.id,
        walletId: wallet.id,
        indexedAccountId: indexedAccount?.id,
        tokenList: {
          tokens: filteredRiskyTokens,
          keys: riskyTokenKeys,
          map: riskyTokenListMap,
        },
        deriveType,
        deriveInfo,
        isAllNetworks: network.isAllNetworks,
        hideValue,
        accountAddress: account.address,
      },
    });
  }, [
    account,
    network,
    wallet,
    navigation,
    indexedAccount?.id,
    filteredRiskyTokens,
    riskyTokenKeys,
    riskyTokenListMap,
    deriveType,
    deriveInfo,
    hideValue,
  ]);

  const handleOnPressManageTokens = useCallback(() => {
    if (!account || !network || !wallet) return;
    navigation.pushModal(EModalRoutes.MainModal, {
      screen: EModalAssetListRoutes.TokenManagerModal,
      params: {
        accountId: account.id,
        networkId: network.id,
        walletId: wallet.id,
        indexedAccountId: indexedAccount?.id,
        deriveType,
        isAllNetworks: network.isAllNetworks,
      },
    });
  }, [account, network, wallet, navigation, indexedAccount?.id, deriveType]);

  const { result: blockedTokensLength, run } = usePromiseResult(
    async () => {
      if (!network) return filteredRiskyTokens?.length ?? 0;

      const [unblockedTokensMap, blockedTokensMap, customTokens] =
        await Promise.all([
          backgroundApiProxy.serviceToken.getUnblockedTokensMap({
            networkId: network.id,
          }),
          backgroundApiProxy.serviceToken.getBlockedTokensMap({
            networkId: network.id,
          }),
          backgroundApiProxy.serviceCustomToken.getAllCustomTokens(),
        ]);

      const customTokensMap = mapValues(
        groupBy(customTokens, 'networkId'),
        (tokenArray) => keyBy(tokenArray, 'address'),
      );

      const blockedTokens = [];

      for (const token of filteredRiskyTokens) {
        const tokenNetworkId = token.networkId ?? network.id;

        if (
          blockedTokensMap?.[tokenNetworkId]?.[token.address] ||
          (!unblockedTokensMap?.[tokenNetworkId]?.[token.address] &&
            !customTokensMap?.[tokenNetworkId]?.[token.address])
        ) {
          blockedTokens.push({
            ...token,
            isBlocked: true,
          });
        }
      }

      return blockedTokens.length;
    },
    [network, filteredRiskyTokens],
    {
      initResult: 0,
    },
  );

  useEffect(() => {
    const refresh = () => {
      void run();
    };

    appEventBus.on(EAppEventBusNames.RefreshTokenList, refresh);
    return () => {
      appEventBus.off(EAppEventBusNames.RefreshTokenList, refresh);
    };
  }, [run]);

  return (
    <Stack>
      {!isSearchMode && filteredSmallBalanceTokens.length > 0 ? (
        <ListItem
          onPress={handleOnPressLowValueTokens}
          userSelect="none"
          {...(tableLayout && plainMode
            ? undefined
            : {
                px: '$0',
                mx: '$0',
              })}
        >
          <XStack flexGrow={1} flexBasis={0} alignItems="center" gap="$3">
            <Stack p="$2" borderRadius="$full" bg="$bgStrong">
              <Icon
                name="ControllerRoundUpSolid"
                color="$iconSubdued"
                size="$6"
              />
            </Stack>
            <ListItem.Text
              primary={`${
                filteredSmallBalanceTokens.length
              } ${intl.formatMessage({
                id: ETranslations.low_value_assets,
              })}`}
              {...(tableLayout && {
                primaryTextProps: { size: '$bodyMdMedium' },
              })}
            />
            {tableLayout ? (
              <Popover
                placement="top-start"
                title={intl.formatMessage({
                  id: ETranslations.low_value_assets,
                })}
                renderTrigger={
                  <IconButton
                    size="small"
                    variant="tertiary"
                    icon="QuestionmarkOutline"
                  />
                }
                renderContent={
                  <YStack p="$5" gap="$2">
                    {helpText.map((text, index) => (
                      <XStack key={index} gap="$2">
                        <Stack
                          w="$1.5"
                          h="$1.5"
                          bg="$textSubdued"
                          borderRadius="$full"
                          mt="$2"
                        />
                        <SizableText size="$bodyMd">{text}</SizableText>
                      </XStack>
                    ))}
                  </YStack>
                }
              />
            ) : null}
          </XStack>
          <Stack flexGrow={1} flexBasis={0} justifyContent="flex-end">
            <NumberSizeableText
              size={tableLayout ? '$bodyMdMedium' : '$bodyLgMedium'}
              formatter="value"
              formatterOptions={{ currency: settings.currencyInfo.symbol }}
              flex={1}
              textAlign="right"
            >
              {smallBalanceTokensFiatValue}
            </NumberSizeableText>
          </Stack>
        </ListItem>
      ) : null}
      {!isSearchMode && filteredRiskyTokens.length > 0 ? (
        <ListItem
          onPress={handleOnPressRiskyTokens}
          userSelect="none"
          {...(tableLayout && plainMode
            ? undefined
            : {
                px: '$0',
                mx: '$0',
              })}
        >
          <XStack alignItems="center" gap="$3" flex={1}>
            <Stack p="$2" borderRadius="$full" bg="$bgStrong">
              <Icon name="ErrorSolid" color="$iconSubdued" size="$6" />
            </Stack>
            <ListItem.Text
              primary={intl.formatMessage(
                {
                  id: ETranslations.wallet_collapsed_risk_assets_number,
                },
                { number: blockedTokensLength },
              )}
              {...(tableLayout && {
                primaryTextProps: { size: '$bodyMdMedium' },
              })}
            />
          </XStack>
        </ListItem>
      ) : null}
      {hasTokens && manageTokenEnabled ? (
        <XStack py="$4" justifyContent="center" gap="$2.5">
          <SizableText size="$bodyMd" color="$textDisabled">
            {intl.formatMessage({ id: ETranslations.add_token_instruction })}
          </SizableText>
          <Button
            size="small"
            variant="tertiary"
            onPress={handleOnPressManageTokens}
            iconAfter="ArrowRightOutline"
            iconColor="$iconSubdued"
          >
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.add_token_label })}
            </SizableText>
          </Button>
        </XStack>
      ) : null}
    </Stack>
  );
}

export { TokenListFooter };
