import { memo, useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, XStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EModalRoutes, EModalSwapRoutes } from '@onekeyhq/shared/src/routes';
import { sortTokensCommon } from '@onekeyhq/shared/src/utils/tokenUtils';
import {
  ESwapSource,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import { useAccountData } from '../../hooks/useAccountData';
import { useUserWalletProfile } from '../../hooks/useUserWalletProfile';
import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';
import {
  useAggregateTokensListMapAtom,
  useTokenListMapAtom,
} from '../../states/jotai/contexts/tokenList';

import type { XStackProps } from 'tamagui';

type IProps = {
  token: IAccountToken;
} & XStackProps;

function TokenActionsView(props: IProps) {
  const { token, ...rest } = props;
  const intl = useIntl();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const [tokenListMap] = useTokenListMapAtom();
  const [aggregateTokenListMapAtom] = useAggregateTokensListMapAtom();

  const [activeToken, setActiveToken] = useState<IAccountToken>(token);

  const { network, deriveType } = useAccountData({
    accountId: activeToken.accountId,
    networkId: activeToken.networkId,
  });

  useEffect(() => {
    const setActiveAggregateToken = async () => {
      if (token.isAggregateToken) {
        const aggregateTokens = aggregateTokenListMapAtom[token.$key]?.tokens;
        if (aggregateTokens) {
          const sortedAggregateTokens = sortTokensCommon({
            tokens: aggregateTokens,
            tokenListMap,
          });
          if (sortedAggregateTokens[0]) {
            setActiveToken(sortedAggregateTokens[0]);
          }
        }
      }
    };
    void setActiveAggregateToken();
  }, [token, aggregateTokenListMapAtom, tokenListMap]);

  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();
  const navigation = useAppNavigation();

  const handleTokenOnSwap = useCallback(() => {
    defaultLogger.wallet.walletActions.actionTrade({
      walletType: activeAccount?.wallet?.type ?? '',
      networkId: activeToken.networkId ?? activeAccount?.network?.id ?? '',
      source: 'homeTokenList',
      tradeType: ESwapTabSwitchType.SWAP,
      isSoftwareWalletOnlyUser,
    });
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapMainLand,
      params: {
        importNetworkId:
          activeToken.networkId ?? activeAccount?.network?.id ?? '',
        importFromToken: {
          contractAddress: activeToken.address,
          symbol: activeToken.symbol,
          networkId: activeToken.networkId ?? activeAccount?.network?.id ?? '',
          isNative: activeToken.isNative,
          decimals: activeToken.decimals,
          name: activeToken.name,
          logoURI: activeToken.logoURI,
          networkLogoURI: network?.logoURI ?? activeAccount?.network?.logoURI,
        },
        importDeriveType: deriveType,
        swapTabSwitchType: ESwapTabSwitchType.SWAP,
        swapSource: ESwapSource.WALLET_HOME_TOKEN_LIST,
      },
    });
  }, [
    activeAccount,
    activeToken,
    isSoftwareWalletOnlyUser,
    navigation,
    network,
    deriveType,
  ]);

  if (!token) {
    return null;
  }

  return (
    <XStack {...rest}>
      <Button
        size="small"
        variant="secondary"
        cursor="pointer"
        onPress={handleTokenOnSwap}
      >
        {intl.formatMessage({ id: ETranslations.global_swap })}
      </Button>
    </XStack>
  );
}

export default memo(TokenActionsView);
