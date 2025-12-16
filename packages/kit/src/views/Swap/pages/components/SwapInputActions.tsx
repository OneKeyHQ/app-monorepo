import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  AnimatePresence,
  Button,
  Icon,
  SizableText,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalReceiveRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { SwapPercentageInputStage } from '@onekeyhq/shared/types/swap/types';

import SwapPercentageStageBadge from '../../components/SwapPercentageStageBadge';

const SwapInputActions = ({
  showPercentageInput,
  showActionBuy,
  onSelectStage,
  fromToken,
  accountInfo,
}: {
  showPercentageInput: boolean;
  showActionBuy: boolean;
  onSelectStage?: (stage: number) => void;
  fromToken?: ISwapToken;
  accountInfo?: IAccountSelectorActiveAccountInfo;
}) => {
  const intl = useIntl();
  const { gtSm } = useMedia();
  const navigation = useAppNavigation();

  const needSwapPercentageInputStage = useMemo(
    () => (gtSm ? SwapPercentageInputStage : SwapPercentageInputStage.slice(1)),
    [gtSm],
  );

  const handleBuyPress = useCallback(() => {
    if (!fromToken || !accountInfo) return;

    defaultLogger.wallet.walletActions.buyOnLowBalance({
      source: 'swap',
      networkId: fromToken.networkId ?? '',
      tokenSymbol: fromToken.symbol ?? '',
      tokenAddress: fromToken.contractAddress ?? '',
      walletType: accountInfo.wallet?.type ?? '',
    });

    navigation.pushModal(EModalRoutes.ReceiveModal, {
      screen: EModalReceiveRoutes.ReceiveSelector,
      params: {
        accountId: accountInfo.account?.id ?? '',
        networkId: fromToken.networkId ?? '',
        walletId: accountInfo.wallet?.id ?? '',
        indexedAccountId: accountInfo.indexedAccount?.id,
        token: {
          networkId: fromToken.networkId ?? '',
          address: fromToken.contractAddress ?? '',
          name: fromToken.name ?? '',
          symbol: fromToken.symbol ?? '',
          decimals: fromToken.decimals,
          logoURI: fromToken.logoURI,
          isNative: fromToken.isNative,
        },
      },
    });
  }, [navigation, fromToken, accountInfo]);

  return (
    <XStack gap="$0.5">
      <AnimatePresence>
        {showActionBuy ? (
          <XStack
            animation="quick"
            enterStyle={{
              opacity: 0,
            }}
            exitStyle={{
              opacity: 0,
            }}
          >
            <Button
              height="$5"
              px="$1.5"
              py="$0"
              pt={platformEnv.isNativeIOS ? '$1' : '$0'}
              bg="$bgSubdued"
              size="small"
              onPress={handleBuyPress}
            >
              <XStack ai="center" jc="center" gap="$1">
                <Icon
                  name="CreditCardCvvOutline"
                  size="$4"
                  mt={platformEnv.isNative ? 2 : undefined}
                />
                <SizableText size="$bodySmMedium" color="$textSubdued">
                  {intl.formatMessage({ id: ETranslations.global_buy })}
                </SizableText>
              </XStack>
            </Button>
          </XStack>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {!platformEnv.isNative && showPercentageInput ? (
          <XStack
            animation="quick"
            enterStyle={{
              opacity: 0,
              x: 8,
            }}
            exitStyle={{
              opacity: 0,
              x: 4,
            }}
            gap="$0.5"
          >
            <>
              {needSwapPercentageInputStage.map((stage) => (
                <SwapPercentageStageBadge
                  key={`swap-percentage-input-stage-${stage}`}
                  stage={stage}
                  onSelectStage={onSelectStage}
                />
              ))}
            </>
          </XStack>
        ) : null}
      </AnimatePresence>
    </XStack>
  );
};

export default SwapInputActions;
