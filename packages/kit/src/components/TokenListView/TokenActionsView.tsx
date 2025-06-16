import { memo, useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, XStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EModalRoutes, EModalSwapRoutes } from '@onekeyhq/shared/src/routes';
import {
  ESwapSource,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import { useAccountData } from '../../hooks/useAccountData';
import { useUserWalletProfile } from '../../hooks/useUserWalletProfile';
import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';

import type { XStackProps } from 'tamagui';

type IProps = {
  token: IAccountToken;
} & XStackProps;

function TokenActionsView(props: IProps) {
  const { token, ...rest } = props;
  const intl = useIntl();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { network, deriveType } = useAccountData({
    accountId: token.accountId,
    networkId: token.networkId,
  });
  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();
  const navigation = useAppNavigation();

  const handleTokenOnSwap = useCallback(() => {
    defaultLogger.wallet.walletActions.actionTrade({
      walletType: activeAccount?.wallet?.type ?? '',
      networkId: token.networkId ?? activeAccount?.network?.id ?? '',
      source: 'homeTokenList',
      tradeType: ESwapTabSwitchType.SWAP,
      isSoftwareWalletOnlyUser,
    });
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapMainLand,
      params: {
        importNetworkId: token.networkId ?? activeAccount?.network?.id ?? '',
        importFromToken: {
          contractAddress: token.address,
          symbol: token.symbol,
          networkId: token.networkId ?? activeAccount?.network?.id ?? '',
          isNative: token.isNative,
          decimals: token.decimals,
          name: token.name,
          logoURI: token.logoURI,
          networkLogoURI: network?.logoURI ?? activeAccount?.network?.logoURI,
        },
        importDeriveType: deriveType,
        swapTabSwitchType: ESwapTabSwitchType.SWAP,
        swapSource: ESwapSource.WALLET_HOME_TOKEN_LIST,
      },
    });
  }, [
    activeAccount,
    token,
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
