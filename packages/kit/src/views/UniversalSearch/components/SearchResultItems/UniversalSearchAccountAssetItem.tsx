import { useCallback } from 'react';

import BigNumber from 'bignumber.js';

import { NumberSizeableText, Stack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token, TokenName } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useUniversalSearchActions } from '@onekeyhq/kit/src/states/jotai/contexts/universalSearch';
import {
  useSettingsPersistAtom,
  useSettingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EModalAssetDetailRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { getTokenPriceChangeStyle } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IUniversalSearchAccountAssets } from '@onekeyhq/shared/types/search';

interface IUniversalSearchAccountAssetItemProps {
  item: IUniversalSearchAccountAssets;
}

export function UniversalSearchAccountAssetItem({
  item,
}: IUniversalSearchAccountAssetItemProps) {
  const navigation = useAppNavigation();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const universalSearchActions = useUniversalSearchActions();
  const [settings] = useSettingsPersistAtom();
  const [{ hideValue }] = useSettingsValuePersistAtom();
  const { token, tokenFiat } = item.payload;
  const priceChange = tokenFiat?.price24h ?? 0;
  const { changeColor, showPlusMinusSigns } = getTokenPriceChangeStyle({
    priceChange,
  });
  const fiatValue = new BigNumber(tokenFiat?.fiatValue ?? 0);

  const handlePress = useCallback(() => {
    navigation.pop();
    setTimeout(async () => {
      if (
        !activeAccount ||
        !activeAccount.account ||
        !activeAccount.network ||
        !activeAccount.wallet ||
        !activeAccount.deriveInfo ||
        !activeAccount.deriveType ||
        !activeAccount.indexedAccount
      )
        return;

      navigation.pushModal(EModalRoutes.MainModal, {
        screen: EModalAssetDetailRoutes.TokenDetails,
        params: {
          accountId: token.accountId ?? activeAccount.account?.id ?? '',
          networkId: token.networkId ?? activeAccount.network?.id,
          walletId: activeAccount.wallet?.id,
          deriveInfo: activeAccount.deriveInfo,
          deriveType: activeAccount.deriveType,
          tokenInfo: token,
          isAllNetworks: activeAccount.network?.isAllNetworks,
          indexedAccountId: activeAccount.indexedAccount?.id ?? '',
        },
      });

      // Add to recent search list
      setTimeout(() => {
        universalSearchActions.current.addIntoRecentSearchList({
          id: `${token.symbol}-${token.networkId || ''}-${
            token.accountId || activeAccount.account?.id || ''
          }`,
          text: token.symbol || token.name || '',
          type: item.type,
          timestamp: Date.now(),
          extra: {
            tokenSymbol: token.symbol || '',
            tokenName: token.name || '',
            networkId: token.networkId || '',
            accountId: token.accountId || '',
          },
        });
      }, 10);
    }, 80);
  }, [activeAccount, item.type, navigation, token, universalSearchActions]);

  return (
    <ListItem
      key={token?.$key || token?.name}
      userSelect="none"
      onPress={handlePress}
    >
      <Token
        size="lg"
        tokenImageUri={token?.logoURI}
        networkId={token?.networkId}
        showNetworkIcon
      />
      <Stack flexGrow={1} flexBasis={0} minWidth={96} flexDirection="column">
        <TokenName
          name={token?.name}
          networkId={token?.networkId}
          isNative={token?.isNative}
          isAllNetworks={networkUtils.isAllNetwork({
            networkId: activeAccount?.network?.id,
          })}
          withNetwork={networkUtils.isAllNetwork({
            networkId: activeAccount?.network?.id,
          })}
          textProps={{
            size: '$bodyLgMedium',
            flexShrink: 0,
          }}
        />
        <NumberSizeableTextWrapper
          formatter="balance"
          formatterOptions={{ tokenSymbol: token?.symbol }}
          size="$bodyMd"
          color="$textSubdued"
          hideValue={hideValue}
        >
          {tokenFiat?.balanceParsed ?? '0'}
        </NumberSizeableTextWrapper>
      </Stack>
      <Stack flexDirection="column" alignItems="flex-end" flexShrink={1}>
        <NumberSizeableTextWrapper
          formatter="value"
          formatterOptions={{ currency: settings.currencyInfo.symbol }}
          size="$bodyLgMedium"
          hideValue={hideValue}
        >
          {fiatValue.isNaN() ? 0 : fiatValue.toFixed()}
        </NumberSizeableTextWrapper>
        <NumberSizeableText
          formatter="priceChange"
          formatterOptions={{ showPlusMinusSigns }}
          color={changeColor}
          size="$bodyMd"
        >
          {priceChange}
        </NumberSizeableText>
      </Stack>
    </ListItem>
  );
}
