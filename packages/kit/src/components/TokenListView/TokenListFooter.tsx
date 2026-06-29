import { useCallback, useEffect, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { groupBy, keyBy, mapValues } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  IconButton,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useSettingsValuePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { isAgg } from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/pure';
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
import { isTokenSelectorDappToken } from '@onekeyhq/shared/src/utils/tokenSelectorFilterUtils';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';
import {
  useListStructureAtom,
  useRiskyListFrameAtom,
  useSearchKeyAtom,
} from '../../states/jotai/contexts/tokenList';
import { useTokenListContextData } from '../../states/jotai/contexts/tokenList/atoms';
import { useHomeTokenListOwnerKey } from '../../states/jotai/contexts/tokenList/cells';
import {
  aggCell,
  cell,
  meta,
  subcell,
} from '../../states/jotai/contexts/tokenList/cells/projection';
import { Currency } from '../Currency';

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

  const [{ hideValue }] = useSettingsValuePersistAtom();

  const { allAggregateTokenMap, ownedAggregateTokenListMap } =
    useTokenListViewContext();

  // cells home pipeline: the footer runs under the HOME tokenList provider whose
  // per-store cells are live + BG-fed after the Phase-2 cutover. The small-
  // balance rows/total/modal params are rebuilt from `listStructure` + the
  // per-key cells instead of the legacy whole-map atoms (full-delete PR-4).
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const store = useTokenListContextData().store!;

  const [listStructure] = useListStructureAtom();
  const currentOwnerKey = useHomeTokenListOwnerKey();

  // Risky tokens ride the dedicated BG risky frame (design §R0/§R1): the home
  // structure/valuation frames are risk-blind, so the footer reads the FULL
  // idempotent snapshot ({ riskyTokens, riskyMap }) landed by the receive shell.
  const [
    { riskyTokens, riskyMap: riskyTokenListMap, ownerKey: riskyOwnerKey },
  ] = useRiskyListFrameAtom();

  const [searchKey] = useSearchKeyAtom();

  const {
    smallBalanceIds,
    nonZeroIds,
    smallBalanceFiatValue: smallBalanceTokensFiatValue,
    generation: listStructureGeneration,
  } = listStructure;

  // Reconstruct the small-balance rows from the home meta cells. Each row is an
  // `IAccountToken` ({ $key, ...meta }); same shape the legacy
  // `smallBalanceTokenListAtom.smallBalanceTokens` carried. Memoized on the
  // structure generation so a pure fiat tick does not rebuild the rows.
  const smallBalanceTokens = useMemo<IAccountToken[]>(() => {
    const rows: IAccountToken[] = [];
    for (const id of smallBalanceIds) {
      const metaValue = store.get(meta(store, id));
      if (metaValue) {
        rows.push({ $key: id, ...metaValue });
      }
    }
    return rows;
    // listStructureGeneration is the structure identity; smallBalanceIds is
    // captured at the same generation. store is stable for the provider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, listStructureGeneration]);

  // `keys` is only a change/identity token downstream (used as the modal's
  // list-version string), so the joined small-balance ids are sufficient.
  const smallBalanceTokenKeys = useMemo(
    () => smallBalanceIds.join('_'),
    [smallBalanceIds],
  );

  // nonZeroIds membership replaces the per-token `balance > 0` filter (the
  // producer computed nonZeroIds agg-aware, so the aggregate balance fallback
  // for the small-balance/main hideZero filter is subsumed).
  const nonZeroIdsSet = useMemo(() => new Set(nonZeroIds), [nonZeroIds]);

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
      // hideZero = membership in the producer-computed nonZeroIds (agg-aware).
      resultTokens = resultTokens.filter((token) =>
        nonZeroIdsSet.has(token.$key),
      );
    }

    if (hideDeFiMarkedTokens) {
      // `dappName` lives on the meta cell (reconstructed onto the row above).
      resultTokens = resultTokens.filter(
        (token) => !isTokenSelectorDappToken(token),
      );
    }

    return resultTokens;
  }, [
    smallBalanceTokens,
    hideZeroBalanceTokens,
    hideDeFiMarkedTokens,
    nonZeroIdsSet,
  ]);

  const filteredRiskyTokens = useMemo(() => {
    if (riskyOwnerKey !== currentOwnerKey) {
      return [];
    }

    if (hideZeroBalanceTokens) {
      return riskyTokens.filter((token) => {
        // Risky tokens are NOT in the home cells structure/cells (the producer
        // never pushes them), so the flatten-aggregate balance fallback is dead
        // for risky ids — resolve balance from riskyTokenListMap only.
        const tokenBalance = new BigNumber(
          riskyTokenListMap[token.$key]?.balance ?? 0,
        );

        if (tokenBalance.gt(0)) {
          return true;
        }

        return false;
      });
    }
    return riskyTokens;
  }, [
    riskyOwnerKey,
    currentOwnerKey,
    riskyTokens,
    hideZeroBalanceTokens,
    riskyTokenListMap,
  ]);

  const handleOnPressLowValueTokens = useCallback(() => {
    if (!account || !network || !wallet || smallBalanceTokens.length === 0)
      return;

    // Reconstruct the modal Records lazily from the home cells AT TAP TIME
    // (full-delete PR-4). These MUST be shape-exact: the modal feeds them into
    // its own isolated store via refresh*, and a wrong shape renders blank
    // balances.

    // map: Record<$key, ITokenFiat> for the small-balance ids — aggregate ids
    // resolve through the derived aggCell, normal ids through cell.
    const smallBalanceTokenListMap: Record<string, ITokenFiat> = {};
    for (const id of smallBalanceIds) {
      const aggregate = isAgg(id, store.get(meta(store, id)));
      const fiat = store.get(aggregate ? aggCell(store, id) : cell(store, id));
      if (fiat) {
        smallBalanceTokenListMap[id] = fiat;
      }
    }

    // nested aggregate fiat map: Record<aggKey, Record<networkId, ITokenFiat>>
    // for the aggregate small-balance ids, read from the per-network sub-cells
    // by their structure membership.
    const nestedAggregateTokensMap: Record<
      string,
      Record<string, ITokenFiat>
    > = {};
    for (const id of smallBalanceIds) {
      if (isAgg(id, store.get(meta(store, id)))) {
        const members = listStructure.aggMembership[id] ?? [];
        const byNet: Record<string, ITokenFiat> = {};
        for (const net of members) {
          const fiat = store.get(subcell(store, id, net));
          if (fiat) {
            byNet[net] = fiat;
          }
        }
        nestedAggregateTokensMap[id] = byNet;
      }
    }

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
        // owner-scoped aggregate sub-token metadata (home-filled context),
        // NOT the global allAggregateTokenMap.
        aggregateTokensListMap: ownedAggregateTokenListMap,
        aggregateTokensMap: nestedAggregateTokensMap,
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
    smallBalanceIds,
    store,
    listStructure.aggMembership,
    navigation,
    intl,
    helpText,
    filteredSmallBalanceTokens,
    smallBalanceTokenKeys,
    deriveType,
    deriveInfo,
    hideValue,
    ownedAggregateTokenListMap,
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
          // `keys` is dead on the risky path — RiskTokenManager only consumes
          // { tokens, map } (design §R1 red-team C-F5). Any stable non-empty
          // value suffices; the precise keys-string is not required.
          keys: 'risky',
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
    <Stack mx={tableLayout ? undefined : '$2'}>
      {!isSearchMode && filteredSmallBalanceTokens.length > 0 ? (
        <ListItem
          onPress={handleOnPressLowValueTokens}
          userSelect="none"
          {...(tableLayout && plainMode
            ? undefined
            : {
                px: '$3',
                mx: 0,
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
                    testID="token-list-footer-help-btn"
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
          <Stack
            flexGrow={1}
            flexBasis={0}
            justifyContent="center"
            alignItems="flex-end"
          >
            <Currency
              size={tableLayout ? '$bodyMdMedium' : '$bodyLgMedium'}
              formatter="value"
              sourceCurrency="usd"
              textAlign="right"
            >
              {smallBalanceTokensFiatValue}
            </Currency>
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
                px: '$3',
                mx: 0,
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
        <XStack
          py="$4"
          px="$4"
          justifyContent="center"
          alignItems="center"
          gap="$2.5"
          flexWrap="wrap"
        >
          <SizableText size="$bodyMd" color="$textDisabled" textAlign="center">
            {intl.formatMessage({ id: ETranslations.add_token_instruction })}
          </SizableText>
          <Button
            testID="token-list-footer-add-token-btn"
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
