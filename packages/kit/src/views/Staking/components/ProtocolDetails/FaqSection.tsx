import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Accordion,
  Icon,
  SizableText,
  Stack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { HyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EModalRoutes } from '@onekeyhq/shared/src/routes/modal';
import { EModalSwapRoutes } from '@onekeyhq/shared/src/routes/swap';
import { getImportFromToken } from '@onekeyhq/shared/types/earn/earnProvider.constants';
import type { IStakeProtocolDetails } from '@onekeyhq/shared/types/staking';
import {
  ESwapSource,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

type ISolution = {
  question: string;
  answer: string;
};

function FaqInfo({
  solutions,
  token: tokenInfo,
}: {
  solutions: ISolution[];
  token?: IStakeProtocolDetails['token'];
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const {
    activeAccount: { wallet },
  } = useActiveAccount({ num: 0 });
  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();
  const networkId = tokenInfo?.info.networkId ?? '';
  const token = tokenInfo?.info;

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
          tokenAddress: token?.address ?? '',
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
              ...(token ?? {}),
              contractAddress: token?.address ?? '',
              networkId,
              networkLogoURI: network.logoURI,
              decimals: token?.decimals ?? 0,
              symbol: token?.symbol ?? '',
            },
            importFromToken,
            swapTabSwitchType,
            swapSource: ESwapSource.EARN,
          },
        });
      }
    },
    [isSoftwareWalletOnlyUser, navigation, networkId, token, wallet?.type],
  );
  return (
    <YStack gap="$6">
      <SizableText size="$headingLg">
        {intl.formatMessage({ id: ETranslations.global_faqs })}
      </SizableText>
      <YStack>
        <Accordion type="multiple" gap="$2">
          {solutions.map(({ question, answer }, index) => (
            <Accordion.Item value={String(index)} key={String(index)}>
              <Accordion.Trigger
                unstyled
                flexDirection="row"
                alignItems="center"
                borderWidth={0}
                bg="$transparent"
                px="$2"
                py="$1"
                mx="$-2"
                my="$-1"
                hoverStyle={{
                  bg: '$bgHover',
                }}
                pressStyle={{
                  bg: '$bgActive',
                }}
                borderRadius="$2"
              >
                {({ open }: { open: boolean }) => (
                  <>
                    <SizableText
                      textAlign="left"
                      flex={1}
                      size="$bodyLgMedium"
                      color={open ? '$text' : '$textSubdued'}
                    >
                      {question}
                    </SizableText>
                    <Stack animation="quick" rotate={open ? '180deg' : '0deg'}>
                      <Icon
                        name="ChevronDownSmallOutline"
                        color={open ? '$iconActive' : '$iconSubdued'}
                        size="$5"
                      />
                    </Stack>
                  </>
                )}
              </Accordion.Trigger>
              <Accordion.HeightAnimator animation="quick">
                <Accordion.Content
                  unstyled
                  pt="$2"
                  pb="$5"
                  animation="100ms"
                  enterStyle={{ opacity: 0 }}
                  exitStyle={{ opacity: 0 }}
                >
                  <HyperlinkText
                    size="$bodyMd"
                    translationId={answer as ETranslations}
                    defaultMessage={answer}
                    onAction={handleAction}
                    underlineTextProps={{
                      color: '$textInfo',
                    }}
                  />
                </Accordion.Content>
              </Accordion.HeightAnimator>
            </Accordion.Item>
          ))}
        </Accordion>
      </YStack>
    </YStack>
  );
}

export const FaqSection = ({
  details,
}: {
  details?: IStakeProtocolDetails;
}) => {
  const { result: solutions } = usePromiseResult(
    async () =>
      details
        ? backgroundApiProxy.serviceStaking.getFAQList({
            symbol: details.token.info.symbol,
            provider: details.provider.name,
          })
        : Promise.resolve([]),
    [details],
    {
      initResult: [],
    },
  );
  if (solutions.length === 0) return null;
  return <FaqInfo solutions={solutions} token={details?.token} />;
};
