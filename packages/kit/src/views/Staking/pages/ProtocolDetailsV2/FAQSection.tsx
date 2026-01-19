import { useCallback } from 'react';

import { SizableText, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EModalRoutes } from '@onekeyhq/shared/src/routes/modal';
import { EModalSwapRoutes } from '@onekeyhq/shared/src/routes/swap';
import { getImportFromToken } from '@onekeyhq/shared/types/earn/earnProvider.constants';
import type {
  IEarnTokenInfo,
  IStakeEarnDetail,
} from '@onekeyhq/shared/types/staking';
import {
  ESwapSource,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { FAQAccordion } from '../../components/FAQAccordion';
import { EarnText } from '../../components/ProtocolDetails/EarnText';

export function FAQSection({
  faqs,
  tokenInfo,
}: {
  faqs: IStakeEarnDetail['faqs'];
  tokenInfo?: IEarnTokenInfo;
}) {
  const navigation = useAppNavigation();
  const {
    activeAccount: { wallet },
  } = useActiveAccount({ num: 0 });
  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();
  const networkId = tokenInfo?.networkId ?? '';

  const handleAction = useCallback(
    async (actionId: string) => {
      const id = actionId.trim();
      if (id === 'trade_usdf') {
        const { isSupportSwap } =
          await backgroundApiProxy.serviceSwap.checkSupportSwap({
            networkId,
          });
        const network = await backgroundApiProxy.serviceNetwork.getNetwork({
          networkId,
        });
        const { importFromToken, swapTabSwitchType } = getImportFromToken({
          networkId,
          isSupportSwap,
          tokenAddress: tokenInfo?.token?.address ?? '',
        });
        defaultLogger.wallet.walletActions.actionTrade({
          walletType: wallet?.type ?? '',
          networkId,
          source: 'earn',
          tradeType: ESwapTabSwitchType.SWAP,
          isSoftwareWalletOnlyUser,
        });
        navigation.pushModal(EModalRoutes.SwapModal, {
          screen: EModalSwapRoutes.SwapMainLand,
          params: {
            importToToken: {
              ...tokenInfo?.token,
              contractAddress: tokenInfo?.token?.address ?? '',
              networkId,
              networkLogoURI: network.logoURI,
              decimals: tokenInfo?.token?.decimals ?? 0,
              symbol: tokenInfo?.token?.symbol ?? '',
            },
            importFromToken,
            swapTabSwitchType,
            swapSource: ESwapSource.EARN,
          },
        });
      }
    },
    [
      isSoftwareWalletOnlyUser,
      navigation,
      networkId,
      tokenInfo?.token,
      wallet?.type,
    ],
  );
  return faqs?.items?.length ? (
    <YStack gap="$6">
      <EarnText text={faqs.title} size="$headingLg" />
      <YStack>
        <FAQAccordion
          items={faqs.items}
          renderTitle={(item, { open }) => (
            <SizableText
              textAlign="left"
              flex={1}
              size="$bodyLgMedium"
              color={open ? '$text' : '$textSubdued'}
            >
              {item.title.text}
            </SizableText>
          )}
          renderContent={(item) => (
            <EarnText
              text={item.description}
              size="$bodyMd"
              onAction={handleAction}
              underlineTextProps={{
                color: '$textInfo',
              }}
            />
          )}
        />
      </YStack>
    </YStack>
  ) : null;
}
