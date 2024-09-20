import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Icon, NumberSizeableText, Stack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { SEARCH_KEY_MIN_LENGTH } from '@onekeyhq/shared/src/consts/walletConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalAssetListRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../hooks/useAppNavigation';
import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';
import {
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

  const [smallBalanceTokenList] = useSmallBalanceTokenListAtom();

  const [smallBalanceTokenListMap] = useSmallBalanceTokenListMapAtom();

  const [smallBalanceTokensFiatValue] = useSmallBalanceTokensFiatValueAtom();

  const [searchKey] = useSearchKeyAtom();

  const { smallBalanceTokens, keys: smallBalanceTokenKeys } =
    smallBalanceTokenList;

  const isSearchMode = searchKey.length >= SEARCH_KEY_MIN_LENGTH;

  const handleOnPressLowValueTokens = useCallback(() => {
    if (!account || !network || !wallet || smallBalanceTokens.length === 0)
      return;
    navigation.pushModal(EModalRoutes.MainModal, {
      screen: EModalAssetListRoutes.TokenList,
      params: {
        title: intl.formatMessage({ id: ETranslations.low_value_assets }),
        helpText: [
          intl.formatMessage({
            id: ETranslations.low_value_assets_desc_out_of_range,
          }),
          intl.formatMessage({
            id: ETranslations.low_value_assets_desc,
          }),
        ],
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
    </Stack>
  );
}

export { TokenListFooter };
