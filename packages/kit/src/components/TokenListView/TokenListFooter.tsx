import { useCallback, useEffect, useMemo } from 'react';

import { groupBy, keyBy, mapValues } from 'lodash';
import { useIntl } from 'react-intl';

import {
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
  useRiskyTokenListAtom,
  useRiskyTokenListMapAtom,
  useSearchKeyAtom,
  useSmallBalanceTokenListAtom,
  useSmallBalanceTokenListMapAtom,
  useSmallBalanceTokensFiatValueAtom,
} from '../../states/jotai/contexts/tokenList';

type IProps = {
  tableLayout?: boolean;
};

function TokenListFooter(props: IProps) {
  const intl = useIntl();
  const { tableLayout } = props;
  const navigation = useAppNavigation();
  const {
    activeAccount: { account, network, wallet, deriveType, deriveInfo },
  } = useActiveAccount({ num: 0 });

  const [settings] = useSettingsPersistAtom();

  const [{ hideValue }] = useSettingsValuePersistAtom();

  const [smallBalanceTokenList] = useSmallBalanceTokenListAtom();

  const [smallBalanceTokenListMap] = useSmallBalanceTokenListMapAtom();

  const [smallBalanceTokensFiatValue] = useSmallBalanceTokensFiatValueAtom();

  const [riskyTokenList] = useRiskyTokenListAtom();

  const [riskyTokenListMap] = useRiskyTokenListMapAtom();

  const [searchKey] = useSearchKeyAtom();

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
          tokens: smallBalanceTokens,
          keys: smallBalanceTokenKeys,
          map: smallBalanceTokenListMap,
        },
        deriveType,
        deriveInfo,
        hideValue,
        isAllNetworks: network.isAllNetworks,
      },
    });
  }, [
    account,
    deriveInfo,
    deriveType,
    intl,
    navigation,
    network,
    smallBalanceTokenKeys,
    smallBalanceTokenListMap,
    smallBalanceTokens,
    wallet,
    helpText,
    hideValue,
  ]);

  const handleOnPressRiskyTokens = useCallback(() => {
    if (!account || !network || !wallet) return;
    navigation.pushModal(EModalRoutes.MainModal, {
      screen: EModalAssetListRoutes.RiskTokenManager,
      params: {
        accountId: account.id,
        networkId: network.id,
        walletId: wallet.id,
        tokenList: {
          tokens: riskyTokens,
          keys: riskyTokenKeys,
          map: riskyTokenListMap,
        },
        deriveType,
        deriveInfo,
        isAllNetworks: network.isAllNetworks,
        hideValue,
      },
    });
  }, [
    account,
    deriveInfo,
    deriveType,
    navigation,
    network,
    riskyTokenKeys,
    riskyTokenListMap,
    riskyTokens,
    wallet,
    hideValue,
  ]);

  const { result: blockedTokensLength, run } = usePromiseResult(
    async () => {
      if (!network) return riskyTokens?.length ?? 0;

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

      for (const token of riskyTokens) {
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
    [network, riskyTokens],
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
      {!isSearchMode && smallBalanceTokens.length > 0 ? (
        <ListItem onPress={handleOnPressLowValueTokens} userSelect="none">
          <XStack flexGrow={1} flexBasis={0} alignItems="center" gap="$3">
            <Stack p="$2" borderRadius="$full" bg="$bgStrong">
              <Icon
                name="ControllerRoundUpSolid"
                color="$iconSubdued"
                size="$6"
              />
            </Stack>
            <ListItem.Text
              primary={`${smallBalanceTokens.length} ${intl.formatMessage({
                id: ETranslations.low_value_assets,
              })}`}
              {...(tableLayout && {
                primaryTextProps: { size: '$bodyMdMedium' },
              })}
            />
            {tableLayout ? (
              <Popover
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
          {tableLayout ? (
            <Stack flexGrow={1} flexBasis={0} maxWidth="$36" />
          ) : null}
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
          {tableLayout ? <Stack flexGrow={1} flexBasis={0} /> : null}
        </ListItem>
      ) : null}
      {!isSearchMode && riskyTokens.length > 0 ? (
        <ListItem onPress={handleOnPressRiskyTokens} userSelect="none">
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
    </Stack>
  );
}

export { TokenListFooter };
