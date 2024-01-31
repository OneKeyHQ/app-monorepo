import { useCallback } from 'react';

import { Divider, Icon, Stack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import useAppNavigation from '../../hooks/useAppNavigation';
import { EModalRoutes } from '../../routes/Modal/type';
import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';
import {
  useSmallBalanceTokenListAtom,
  useSmallBalanceTokenListMapAtom,
  useSmallBalanceTokensFiatValueAtom,
} from '../../states/jotai/contexts/tokenList';
import { getFormattedNumber } from '../../utils/format';
import { EModalAssetListRoutes } from '../../views/AssetList/router/types';

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

  const { smallBalanceTokens, keys: smallBalanceTokenKeys } =
    smallBalanceTokenList;

  const handleLowValueTokensPress = useCallback(() => {
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
        <ListItem.Text
          primary={`${settings.currencyInfo.symbol}${
            getFormattedNumber(smallBalanceTokensFiatValue, { decimal: 2 }) ??
            '0'
          }`}
        />
      </ListItem>
    </Stack>
  );
}

export { TokenListFooter };
