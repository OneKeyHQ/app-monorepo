import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  AnimatePresence,
  Button,
  Icon,
  SizableText,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import {
  ANIMATE_ONLY_OPACITY,
  ANIMATE_ONLY_OPACITY_TRANSFORM,
} from '@onekeyhq/components/src/utils/animationConstants';
import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { SwapPercentageInputStage } from '@onekeyhq/shared/types/swap/types';

import SwapPercentageStageBadge from '../../components/SwapPercentageStageBadge';
import { useSwapDepositEntryPress } from '../../hooks/useSwapDepositEntry';

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

  const needSwapPercentageInputStage = useMemo(
    () => (gtSm ? SwapPercentageInputStage : SwapPercentageInputStage.slice(1)),
    [gtSm],
  );

  const handleBuyPress = useSwapDepositEntryPress({
    token: fromToken,
    accountInfo,
  });

  return (
    <XStack gap="$0.5">
      <AnimatePresence>
        {showActionBuy ? (
          <XStack
            transition="quick"
            animateOnly={ANIMATE_ONLY_OPACITY}
            enterStyle={{
              opacity: 0,
            }}
            exitStyle={{
              opacity: 0,
            }}
          >
            {/* Only rendered while the balance cannot cover the input, so
                it reads as the recovery action: same interactive tint as the
                Max control, on a pill that stands out from the input card. */}
            <Button
              testID="swap-btn"
              height="$5"
              px="$1.5"
              py="$0"
              pt={platformEnv.isNativeIOS ? '$1' : '$0'}
              bg="$bgStrong"
              size="small"
              onPress={handleBuyPress}
            >
              <XStack ai="center" jc="center" gap="$1">
                <Icon
                  name="CreditCardCvvOutline"
                  size="$4"
                  color="$textInteractive"
                  mt={platformEnv.isNative ? 2 : undefined}
                />
                <SizableText size="$bodySmMedium" color="$textInteractive">
                  {intl.formatMessage({ id: ETranslations.global_top_up })}
                </SizableText>
              </XStack>
            </Button>
          </XStack>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {!platformEnv.isNative && showPercentageInput ? (
          <XStack
            transition="quick"
            animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
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
