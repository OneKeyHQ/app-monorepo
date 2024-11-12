import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { Button, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IModalSwapParamList } from '@onekeyhq/shared/src/routes';
import { EModalRoutes } from '@onekeyhq/shared/src/routes/modal';
import { EModalSwapRoutes } from '@onekeyhq/shared/src/routes/swap';
import type { ISwapTokenBase } from '@onekeyhq/shared/types/swap/types';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';
import type { IToken } from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import ActionBuy from '../../AssetDetails/pages/TokenDetails/ActionBuy';
import { HomeTokenListProviderMirror } from '../../Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';

const getImportFromToken = async (networkId: string) => {
  const network = await backgroundApiProxy.serviceNetwork.getNetwork({
    networkId,
  });
  return {
    networkId,
    contractAddress: '',
    symbol: network.symbol,
    decimals: network.decimals,
  };
};

function BasicTradeOrBuy({
  token,
  accountId,
  networkId,
}: {
  token: IToken;
  accountId: string;
  networkId: string;
}) {
  const {
    activeAccount: { wallet },
  } = useActiveAccount({ num: 0 });
  const intl = useIntl();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const handleOnSwap = useCallback(async () => {
    // const { isSupportSwap, isSupportCrossChain } =
    //   await backgroundApiProxy.serviceSwap.checkSupportSwap({
    //     networkId,
    //     contractAddress: token.address,
    //   });

    let importFromToken: ISwapTokenBase | undefined;
    // let swapTabSwitchType = isSupportSwap
    let swapTabSwitchType = false
      ? ESwapTabSwitchType.SWAP
      : ESwapTabSwitchType.BRIDGE;
    console.log('---networkId', networkId, token);
    switch (networkId) {
      case 'btc--0':
      case 'tbtc--1':
        importFromToken = await getImportFromToken('evm--1');
        swapTabSwitchType = ESwapTabSwitchType.BRIDGE;
        break;
      case 'evm--1':
      case 'evm--17000':
      case 'evm--11155111': {
        if (token.symbol === 'MATIC') {
          importFromToken = await getImportFromToken('evm--1');
        } else {
          importFromToken = {
            'networkId': 'evm--1',
            'contractAddress': '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            'name': 'USD Coin',
            'symbol': 'USDC',
            'decimals': 6,
          };
        }
        swapTabSwitchType = ESwapTabSwitchType.SWAP;
        break;
      }
      case 'sol--101': {
        importFromToken = {
          'networkId': 'sol--101',
          'contractAddress': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          'name': 'USDC',
          'symbol': 'USDC',
          'decimals': 6,
        };
        swapTabSwitchType = ESwapTabSwitchType.SWAP;
        break;
      }
      case 'aptos--1':
        importFromToken = await getImportFromToken('evm--1');
        swapTabSwitchType = ESwapTabSwitchType.BRIDGE;
        break;
      default:
        break;
    }
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapMainLand,
      params: {
        importToToken: {
          ...token,
          contractAddress: token.address,
          networkId,
        },
        importFromToken,
        swapTabSwitchType,
      },
    });
  }, [navigation, networkId, token]);

  const isShowTradeButton = useMemo(
    () => networkId !== 'cosmos--cosmoshub-4',
    [networkId],
  );

  return (
    <XStack
      borderTopColor="$borderSubdued"
      borderTopWidth={StyleSheet.hairlineWidth}
      ai="center"
      jc="space-between"
      py="$5"
    >
      <SizableText size="$bodyLg" color="$textSubdued">
        {intl.formatMessage(
          { id: ETranslations.earn_not_enough_token },
          { token: token.symbol.toUpperCase() },
        )}
      </SizableText>
      <XStack gap="$2">
        {isShowTradeButton ? (
          <Button size="small" onPress={handleOnSwap}>
            {intl.formatMessage({ id: ETranslations.global_trade })}
          </Button>
        ) : null}
        <ActionBuy
          hiddenIfDisabled
          showButtonStyle
          size="small"
          networkId={networkId}
          accountId={accountId}
          walletType={wallet?.type}
          tokenAddress={token.address}
        />
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
