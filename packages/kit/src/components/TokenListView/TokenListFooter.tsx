import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Divider, Icon, NumberSizeableText, Stack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { SEARCH_KEY_MIN_LENGTH } from '@onekeyhq/shared/src/consts/walletConsts';
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
    activeAccount: {
      account,
      network,
      wallet,
      isOthersWallet,
      indexedAccount,
      deriveType,
      deriveInfo,
    },
  } = useActiveAccount({ num: 0 });

  const [settings] = useSettingsPersistAtom();

  const [smallBalanceTokenList] = useSmallBalanceTokenListAtom();

  const [smallBalanceTokenListMap] = useSmallBalanceTokenListMapAtom();

  const [smallBalanceTokensFiatValue] = useSmallBalanceTokensFiatValueAtom();

  const [riskyTokenList] = useRiskyTokenListAtom();
  const [riskyTokenListMap] = useRiskyTokenListMapAtom();

  const [searchKey] = useSearchKeyAtom();

  const { riskyTokens, keys: riskyTokenKeys } = riskyTokenList;

  const { smallBalanceTokens, keys: smallBalanceTokenKeys } =
    smallBalanceTokenList;
  const { result: vaultSettings } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceNetwork.getVaultSettings({
        networkId: network?.id ?? '',
      }),
    [network?.id],
  );

  const isSearchMode = searchKey.length >= SEARCH_KEY_MIN_LENGTH;

  const handleOnPressLowValueTokens = useCallback(() => {
    if (!account || !network || !wallet || smallBalanceTokens.length === 0)
      return;
    navigation.pushModal(EModalRoutes.MainModal, {
      screen: EModalAssetListRoutes.TokenList,
      params: {
        title: intl.formatMessage({ id: ETranslations.low_value_assets }),
        helpText: intl.formatMessage({
          id: ETranslations.low_value_assets_desc,
        }),
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
  ]);

  const handleOnPressBlockedTokens = useCallback(() => {
    if (!account || !network || !wallet || riskyTokens.length === 0) return;
    navigation.pushModal(EModalRoutes.MainModal, {
      screen: EModalAssetListRoutes.TokenList,
      params: {
        title: intl.formatMessage({ id: ETranslations.hidden_assets }),
        accountId: account.id,
        networkId: network.id,
        walletId: wallet.id,
        tokenList: {
          tokens: riskyTokens,
          keys: riskyTokenKeys,
          map: riskyTokenListMap,
        },
        isBlocked: true,
        deriveType,
        deriveInfo,
      },
    });
  }, [
    account,
    deriveInfo,
    deriveType,
    intl,
    navigation,
    network,
    riskyTokenKeys,
    riskyTokenListMap,
    riskyTokens,
    wallet,
  ]);

  const handleOnPressManageToken = useCallback(() => {
    navigation.pushModal(EModalRoutes.MainModal, {
      screen: EModalAssetListRoutes.TokenManagerModal,
      params: {
        walletId: wallet?.id ?? '',
        isOthersWallet,
        indexedAccountId: indexedAccount?.id,
        networkId: network?.id ?? '',
        accountId: account?.id ?? '',
        deriveType,
      },
    });
  }, [
    navigation,
    wallet?.id,
    isOthersWallet,
    indexedAccount?.id,
    network?.id,
    account?.id,
    deriveType,
  ]);

  return (
    <Stack>
      {!isSearchMode && smallBalanceTokens.length > 0 ? (
        <ListItem onPress={handleOnPressLowValueTokens} userSelect="none">
          <Stack
            p={tableLayout ? '$1' : '$1.5'}
            borderRadius="$full"
            bg="$bgStrong"
          >
            <Icon
              name="ControllerRoundUpSolid"
              color="$iconSubdued"
              size={tableLayout ? '$6' : '$7'}
            />
          </Stack>
          <ListItem.Text
            flex={1}
            primary={`${smallBalanceTokens.length} ${intl.formatMessage({
              id: ETranslations.low_value_assets,
            })}`}
            {...(tableLayout && {
              primaryTextProps: { size: '$bodyMdMedium' },
            })}
          />
          <NumberSizeableText
            size={tableLayout ? '$bodyMd' : '$bodyLgMedium'}
            formatter="value"
            formatterOptions={{ currency: settings.currencyInfo.symbol }}
          >
            {smallBalanceTokensFiatValue}
          </NumberSizeableText>
        </ListItem>
      ) : null}

      {smallBalanceTokens.length > 0 ||
      riskyTokens.length > 0 ||
      !vaultSettings?.isSingleToken ? (
        <Divider mx="$5" my="$2" />
      ) : null}
      {!isSearchMode && riskyTokens.length > 0 ? (
        <ListItem onPress={handleOnPressBlockedTokens} userSelect="none">
          <Stack
            p={tableLayout ? '$1' : '$1.5'}
            borderRadius="$full"
            bg="$bgStrong"
          >
            <Icon
              name="BlockOutline"
              color="$iconSubdued"
              size={tableLayout ? '$6' : '$7'}
            />
          </Stack>
          <ListItem.Text
            flex={1}
            primary={intl.formatMessage(
              { id: ETranslations.count_hidden_assets },
              {
                count: riskyTokens.length,
              },
            )}
            {...(tableLayout && {
              primaryTextProps: { size: '$bodyMdMedium' },
            })}
          />
        </ListItem>
      ) : null}
      {vaultSettings?.isSingleToken ? null : (
        <ListItem onPress={handleOnPressManageToken} userSelect="none">
          <Stack
            p={tableLayout ? '$1' : '$1.5'}
            borderRadius="$full"
            bg="$bgStrong"
          >
            <Icon
              name="SettingsOutline"
              color="$iconSubdued"
              size={tableLayout ? '$6' : '$7'}
            />
          </Stack>
          <ListItem.Text
            flex={1}
            primary={intl.formatMessage({
              id: ETranslations.manage_token_title,
            })}
            {...(tableLayout && {
              primaryTextProps: { size: '$bodyMdMedium' },
            })}
          />
        </ListItem>
      )}
    </Stack>
  );
}

export { TokenListFooter };
