import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { Divider, Icon, ListItem, Stack } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import useAppNavigation from '../../hooks/useAppNavigation';
import { EModalRoutes } from '../../routes/Modal/type';
import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';
import {
  useSmallBalanceTokenListAtom,
  useSmallBalanceTokenListMapAtom,
} from '../../states/jotai/contexts/token-list';
import { ETokenPages } from '../../views/Token/router/type';

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

  const { smallBalanceTokens, keys: smallBalanceTokenKeys } =
    smallBalanceTokenList;

  const smallBalanceTokensValue = useMemo(() => {
    const value = smallBalanceTokens.reduce((acc, token) => {
      const tokenFiat = smallBalanceTokenListMap[token.$key];
      return acc.plus(tokenFiat.fiatValue ?? 0);
    }, new BigNumber(0));

    return `${settings.currencyInfo.symbol}${value.toFixed(2)}`;
  }, [
    settings.currencyInfo.symbol,
    smallBalanceTokenListMap,
    smallBalanceTokens,
  ]);

  const handleLowValueTokensPress = useCallback(() => {
    if (!account || !network || smallBalanceTokens.length === 0) return;
    navigation.pushModal(EModalRoutes.TokenModal, {
      screen: ETokenPages.TokenList,
      params: {
        title: 'Low-value Assets',
        helpText:
          'Assets valued below 0.1% of your total holdings and less than $1,000 fall into this category.',
        accountId: account.id,
        networkId: network.id,
        tokenList: {
          tokens: smallBalanceTokens,
          keys: smallBalanceTokenKeys,
          tokenMap: smallBalanceTokenListMap,
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
  return (
    <Stack>
      {tableLayout && <Divider mx="$5" />}
      <ListItem mb="$5" onPress={handleLowValueTokensPress} userSelect="none">
        <Stack
          p={tableLayout ? '$1' : '$1.5'}
          borderRadius="$full"
          bg="$bgStrong"
        >
          <Icon
            name="ControllerRoundSolid"
            color="$iconSubdued"
            size={tableLayout ? '$6' : '$7'}
          />
        </Stack>
        <ListItem.Text
          flex={1}
          primary={`${smallBalanceTokens.length} Low-value Assets`}
        />
        <ListItem.Text primary={smallBalanceTokensValue} />
      </ListItem>
    </Stack>
  );
}

export { TokenListFooter };
