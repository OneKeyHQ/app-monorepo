import { useCallback } from 'react';

import { Divider, Icon, NumberSizeableText, Stack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { SEARCH_KEY_MIN_LENGTH } from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EModalAssetListRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../hooks/useAppNavigation';
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
  const { tableLayout } = props;
  const navigation = useAppNavigation();
  const {
    activeAccount: { account, network },
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

  const isSearchMode = searchKey.length >= SEARCH_KEY_MIN_LENGTH;

  const handleOnPressLowValueTokens = useCallback(() => {
    if (!account || !network || smallBalanceTokens.length === 0) return;
    navigation.pushModal(EModalRoutes.MainModal, {
      screen: EModalAssetListRoutes.TokenList,
      params: {
        title: 'Low-value Assets',
        helpText:
          'Assets valued below 0.1% of your total holdings and less than $1,000 fall into this category.',
        accountId: account.id,
        networkId: network.id,
        tokenList: {
          tokens: smallBalanceTokens,
          keys: smallBalanceTokenKeys,
          map: smallBalanceTokenListMap,
        },
      },
    });
  }, [
    account,
    navigation,
    network,
    smallBalanceTokenKeys,
    smallBalanceTokenListMap,
    smallBalanceTokens,
  ]);

  const handleOnPressBlockedTokens = useCallback(() => {
    if (!account || !network || riskyTokens.length === 0) return;
    navigation.pushModal(EModalRoutes.MainModal, {
      screen: EModalAssetListRoutes.TokenList,
      params: {
        title: 'Blocked Assets',
        accountId: account.id,
        networkId: network.id,
        tokenList: {
          tokens: riskyTokens,
          keys: riskyTokenKeys,
          map: riskyTokenListMap,
        },
        isBlocked: true,
      },
    });
  }, [
    account,
    navigation,
    network,
    riskyTokenKeys,
    riskyTokenListMap,
    riskyTokens,
  ]);
  return (
    <Stack>
      {tableLayout &&
      !isSearchMode &&
      (smallBalanceTokens.length > 0 || riskyTokens.length > 0) ? (
        <Divider mx="$5" my="$2" />
      ) : null}
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
            primary={`${smallBalanceTokens.length} Low-value Assets`}
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
            primary={`${riskyTokens.length} Blocked Assets`}
            {...(tableLayout && {
              primaryTextProps: { size: '$bodyMdMedium' },
            })}
          />
        </ListItem>
      ) : null}
    </Stack>
  );
}

export { TokenListFooter };
