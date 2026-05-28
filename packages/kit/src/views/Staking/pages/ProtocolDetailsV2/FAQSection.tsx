import { useCallback } from 'react';

import {
  Accordion,
  Icon,
  SizableText,
  Stack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import {
  ANIMATE_ONLY_OPACITY,
  ANIMATE_ONLY_TRANSFORM,
} from '@onekeyhq/components/src/utils/animationConstants';
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

import { EarnText } from '../../components/ProtocolDetails/EarnText';

export function FAQSection({
  faqs,
  tokenInfo,
}: {
  faqs: IStakeEarnDetail['faqs'];
  tokenInfo?: IEarnTokenInfo;
}) {
  const media = useMedia();
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
    <YStack pb="$8">
      <Accordion type="multiple">
        {faqs.items.map((item, index) => (
          <YStack key={String(index)}>
            <Accordion.Item value={String(index)}>
              <Accordion.Trigger
                unstyled
                flexDirection="row"
                alignItems="center"
                justifyContent="space-between"
                borderWidth={0}
                bg="$transparent"
                p={0}
                py="$5"
                m={0}
                cursor="pointer"
              >
                {({ open }: { open: boolean }) => (
                  <>
                    <SizableText
                      textAlign="left"
                      flex={1}
                      size={media.gtMd ? '$headingLg' : '$headingMd'}
                      color="$text"
                      pr="$2"
                    >
                      {item.title.text}
                    </SizableText>
                    <Stack
                      animation="quick"
                      animateOnly={ANIMATE_ONLY_TRANSFORM}
                      rotate={open ? '180deg' : '0deg'}
                    >
                      <Icon
                        name="ChevronDownSmallOutline"
                        color="$iconSubdued"
                        size="$6"
                      />
                    </Stack>
                  </>
                )}
              </Accordion.Trigger>
              <Accordion.HeightAnimator animation="quick">
                <Accordion.Content
                  unstyled
                  p={0}
                  pt="$1"
                  pb="$5"
                  pr="$8"
                  animation="100ms"
                  animateOnly={ANIMATE_ONLY_OPACITY}
                  enterStyle={{ opacity: 0 }}
                  exitStyle={{ opacity: 0 }}
                >
                  <EarnText
                    text={item.description}
                    size="$bodyLg"
                    color="$textSubdued"
                    onAction={handleAction}
                    underlineTextProps={{
                      color: '$textInfo',
                    }}
                  />
                </Accordion.Content>
              </Accordion.HeightAnimator>
            </Accordion.Item>
          </YStack>
        ))}
      </Accordion>
    </YStack>
  ) : null;
}
