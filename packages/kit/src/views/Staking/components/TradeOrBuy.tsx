import { useCallback } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { Button, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IModalSwapParamList } from '@onekeyhq/shared/src/routes';
import { EModalRoutes } from '@onekeyhq/shared/src/routes/modal';
import { EModalSwapRoutes } from '@onekeyhq/shared/src/routes/swap';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';
import type { IToken } from '@onekeyhq/shared/types/token';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { useFiatCrypto } from '../../FiatCrypto/hooks';
import { HomeTokenListProviderMirror } from '../../Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';

function BasicTradeOrBuy({
  token,
  accountId,
  networkId,
}: {
  token: IToken;
  accountId: string;
  networkId: string;
}) {
  const intl = useIntl();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const handleOnSwap = useCallback(() => {
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapMainLand,
      params: {
        importToToken: {
          ...token,
          contractAddress: token.address,
          networkId,
        },
        swapTabSwitchType: ESwapTabSwitchType.SWAP,
      },
    });
  }, [navigation, networkId, token]);

  const { isSupported, handleFiatCrypto } = useFiatCrypto({
    networkId: networkId ?? '',
    accountId,
    fiatCryptoType: 'buy',
  });
  return (
    <XStack
      borderTopColor="$borderSubdued"
      borderTopWidth={StyleSheet.hairlineWidth}
      ai="center"
      jc="space-between"
      py="$5"
    >
      <SizableText>{`Not enough ${token.symbol.toUpperCase()}?`}</SizableText>
      <XStack gap="$2">
        <Button size="small" onPress={handleOnSwap}>
          {intl.formatMessage({ id: ETranslations.global_trade })}
        </Button>
        {isSupported ? (
          <Button size="small" onPress={handleFiatCrypto}>
            {intl.formatMessage({ id: ETranslations.global_buy })}
          </Button>
        ) : null}
      </XStack>
    </XStack>
  );
}

export function TradeOrBuy({
  token,
  accountId,
  networkId,
}: {
  token: IToken;
  accountId: string;
  networkId: string;
}) {
  return (
    <HomeTokenListProviderMirror>
      <BasicTradeOrBuy
        token={token}
        accountId={accountId}
        networkId={networkId}
      />
    </HomeTokenListProviderMirror>
  );
}
