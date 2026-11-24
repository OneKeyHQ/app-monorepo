import { useMemo } from 'react';

import { noop } from 'lodash';
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

// Phones show the percentage stages in the pay card's label row, as desktop
// does, rather than on a bar above the keyboard. iPad has no percentage entry
// yet, so it stays out.
export const SWAP_PERCENTAGE_STAGE_IN_CARD_ON_NATIVE =
  platformEnv.isNative && !platformEnv.isNativeIOSPad;

const SWAP_PERCENTAGE_STAGE_TOUCH_SLOP = {
  top: 10,
  bottom: 10,
  left: 2,
  right: 2,
} as const;

const SwapInputActions = ({
  showPercentageInput,
  percentageInputOnNative = false,
  percentageInputDisabled = false,
  showActionBuy,
  actionBuyHighlighted = true,
  onDepositClose = noop,
  onSelectStage,
  fromToken,
  accountInfo,
  activeAccount,
}: {
  showPercentageInput: boolean;
  // Native hosts that still use a keyboard bar for the percentage stages
  // leave this off; hosts without that bar show the stages here. The row also
  // holds the top-up chip, so it takes the three desktop stages rather than
  // the bar's four.
  percentageInputOnNative?: boolean;
  percentageInputDisabled?: boolean;
  showActionBuy: boolean;
  // Green when the chip is the recovery action (partial balance); subdued
  // when the main button already reads "Deposit to Trade" (zero balance).
  actionBuyHighlighted?: boolean;
  // Runs when the deposit modal closes so the surface can reload its own
  // balance; surfaces that never show the chip may leave it out.
  onDepositClose?: () => void;
  onSelectStage?: (stage: number) => void;
  fromToken?: ISwapToken;
  // The account resolved for the token network; withheld by callers while the
  // lookup is pending, in which case the chip resolves it from activeAccount.
  accountInfo?: IAccountSelectorActiveAccountInfo;
  activeAccount?: IAccountSelectorActiveAccountInfo;
}) => {
  const intl = useIntl();
  const { gtSm } = useMedia();

  const needSwapPercentageInputStage = useMemo(() => {
    // Native media queries keep phone breakpoints on every screen, so a host
    // that opts in on native is trusted to have room for all three.
    if (platformEnv.isNative || gtSm) {
      return SwapPercentageInputStage;
    }
    return SwapPercentageInputStage.slice(1);
  }, [gtSm]);

  const handleBuyPress = useSwapDepositEntryPress({
    token: fromToken,
    accountInfo,
    activeAccount,
    onClose: onDepositClose,
  });
  const actionBuyColor = actionBuyHighlighted
    ? '$textInteractive'
    : '$textSubdued';

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
            <Button
              testID="swap-btn"
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
                  color={actionBuyColor}
                  mt={platformEnv.isNative ? 2 : undefined}
                />
                <SizableText size="$bodySmMedium" color={actionBuyColor}>
                  {intl.formatMessage({ id: ETranslations.global_top_up })}
                </SizableText>
              </XStack>
            </Button>
          </XStack>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {(!platformEnv.isNative || percentageInputOnNative) &&
        showPercentageInput ? (
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
            // A hit slop only reaches as far as the parent's frame, so the
            // row is padded to hold it and pulled back by the same margin to
            // keep its place.
            {...(platformEnv.isNative
              ? {
                  py: SWAP_PERCENTAGE_STAGE_TOUCH_SLOP.top,
                  my: -SWAP_PERCENTAGE_STAGE_TOUCH_SLOP.top,
                }
              : undefined)}
          >
            <>
              {needSwapPercentageInputStage.map((stage) => (
                <SwapPercentageStageBadge
                  key={`swap-percentage-input-stage-${stage}`}
                  stage={stage}
                  disabled={percentageInputDisabled}
                  onSelectStage={onSelectStage}
                  // The badge is shorter than a finger; widen what a touch
                  // hits without changing how it looks.
                  hitSlop={
                    platformEnv.isNative
                      ? SWAP_PERCENTAGE_STAGE_TOUCH_SLOP
                      : undefined
                  }
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
